#!/usr/bin/env bun
import { Command } from "commander";
import { readFileSync, writeFileSync } from "node:fs";
import { ShieldsBadgeManager } from "./badge-manager";
import { getVars } from "./getVars";

// Default configuration
const DEFAULT_PRIMARY_PG_VERSION = 17;
const DEFAULT_SUPPORTED_PG_VERSIONS = [16, 17];
const DEFAULT_README_FILE = "README.md";

// Setup CLI program
const program = new Command();

program
  .name("update-readme-badge")
  .description(
    "Updates README.md badges and available tags for a bitnami-pgvector project"
  )
  .version("1.0.0")
  .option(
    "-p, --primary <version>",
    "Primary PostgreSQL version",
    DEFAULT_PRIMARY_PG_VERSION.toString()
  )
  .option(
    "-v, --versions <versions>",
    "Comma-separated list of supported PostgreSQL versions",
    DEFAULT_SUPPORTED_PG_VERSIONS.join(",")
  )
  .option("-r, --readme <file>", "Path to README.md file", DEFAULT_README_FILE)
  .option("--badge-only", "Update only the pgvector badge")
  .option("--tags-only", "Update only the available tags section")
  .option("-d, --dry-run", "Show changes without writing to file")
  .option("-s, --silent", "Suppress non-essential output");

/**
 * Generates markdown for the available tags section
 */
async function generateAvailableTagsMarkdown(
  primaryVersion: number,
  supportedVersions: number[],
  silent: boolean
): Promise<string> {
  if (!silent) console.log("Generating available tags list...");

  let tagsMarkdown = "";

  // Add the 'latest' tag first
  tagsMarkdown += `*   \`latest\`: Latest build based on PostgreSQL ${primaryVersion}.\n`;

  // Get vars for the primary version to add the hash tag once
  const primaryVars = await getVars(primaryVersion.toString());
  if (primaryVars.versionsHashTag) {
    tagsMarkdown += `*   \`${primaryVars.versionsHashTag
      .split("/")
      .pop()}\`: SHA256 hash tag representing the specific combination of PG, pgvector, and pg_search versions used in the latest build.\n`;
  }

  // Loop through supported versions to generate tags
  for (const version of supportedVersions) {
    if (!silent) console.log(`- Processing PG ${version}...`);

    // Get variables for this version
    const vars = await getVars(version.toString());

    // Extract the necessary tags
    const fullImageTag = vars.fullImageTag;
    const tagShort = vars.tagShort;
    const tagWithFullPostgresVersion = vars.tagWithFullPostgresVersion;
    const tagLatestPg = vars.tagLatestPg;
    const pgSearchName = vars.pgSearchName; // Get pg_search name

    // Extract tag names from full references
    const tagPrimary = fullImageTag.split("/").pop();
    const shortTagName = tagShort.split("/").pop();
    const fullPgvectorTag = tagWithFullPostgresVersion.split("/").pop();
    const latestPgTagName = tagLatestPg.split("/").pop();

    if (!tagPrimary || !shortTagName || !fullPgvectorTag || !latestPgTagName) {
      console.error(`Error: Failed to extract tags for PG ${version}.`);
      process.exit(1);
    }

    // Extract PostgreSQL full version (e.g., 17.2.0) from Bitnami name
    const postgresFullVer = vars.bitnamiName.split("-")[0];
    // Extract pg_search version/identifier if available
    const pgSearchVer = pgSearchName?.split(":").pop() ?? "unknown";

    // Append tags to markdown string
    tagsMarkdown += `*   \`${tagPrimary}\`: Specific pgvector, pg_search (${pgSearchVer}), and PostgreSQL ${version} version.\n`;
    tagsMarkdown += `*   \`${shortTagName}\`: Latest build for PostgreSQL ${version} (includes pgvector & pg_search).\n`;
    tagsMarkdown += `*   \`${fullPgvectorTag}\`: Specific pgvector, pg_search (${pgSearchVer}), PostgreSQL full version (${postgresFullVer}).\n`;
    tagsMarkdown += `*   \`${latestPgTagName}\`: Alias for the latest build for PostgreSQL ${version}.\n`;
  }

  return tagsMarkdown.trimEnd();
}

/**
 * Updates the 'Available tags' section in the README.md file
 */
async function updateAvailableTagsSection(
  readmeContent: string,
  tagsMarkdown: string,
  readmeFile: string,
  silent: boolean
): Promise<string> {
  if (!silent)
    console.log(`Updating 'Available tags' section in ${readmeFile}...`);

  // Use regex to replace content between markers
  const startMarker = "<!-- AVAILABLE_TAGS_START -->";
  const endMarker = "<!-- AVAILABLE_TAGS_END -->";

  const pattern = new RegExp(
    `${startMarker}\\s*[\\s\\S]*?\\s*${endMarker}`,
    "g"
  );

  const replacement = `${startMarker}\n\n${tagsMarkdown}\n${endMarker}`;

  if (!pattern.test(readmeContent)) {
    console.error(
      `Error: Could not find start and end markers in ${readmeFile}.`
    );
    process.exit(1);
  }

  // Replace the content between markers
  const updatedContent = readmeContent.replace(pattern, replacement);

  if (!silent)
    console.log("Available tags section updated successfully (in memory).");

  return updatedContent;
}

/**
 * Main function to update the README.md file
 */
async function main(): Promise<void> {
  try {
    program.parse(process.argv); // Parse within try
    const options = program.opts(); // Get options within try

    // Parse command line options
    const primaryVersion = Number.parseInt(options.primary);
    const supportedVersions = options.versions
      .split(",")
      .map((v: string) => Number.parseInt(v.trim()));
    const readmeFile = options.readme;
    const dryRun = options.dryRun;
    const silent = options.silent;

    // Validate inputs
    if (Number.isNaN(primaryVersion)) {
      console.error(`Error: Invalid primary version: ${options.primary}`);
      process.exit(1);
    }

    if (supportedVersions.some((v: number) => Number.isNaN(v))) {
      console.error(`Error: Invalid supported versions: ${options.versions}`);
      process.exit(1);
    }

    // If it's a dry run, show a banner
    if (dryRun && !silent) {
      console.log("--- DRY RUN MODE - No files will be modified ---");
    }

    // Instantiate the badge manager
    const badgeManager = new ShieldsBadgeManager();

    // Read the initial content only once
    let readmeContent = "";
    try {
      readmeContent = readFileSync(readmeFile, "utf-8");
    } catch (err) {
      console.error(`Error reading README file "${readmeFile}":`, err);
      process.exit(1);
    }
    let originalReadmeContent = readmeContent; // Keep original for comparison
    let contentChangedOverall = false;

    // Determine primary versions for badges
    const primaryVars = await getVars(primaryVersion.toString());
    // Extract version number (e.g., "0.7.0") from base version (e.g., "pgvector-0.7.0")
    const pgvectorVersion = primaryVars.pgvectorBaseVersion?.split("-").pop();
    // Extract pg_search version (e.g., 0.15.18) from name (e.g., owner/repo:0.15.18-pg17)
    let pgSearchVersion = undefined;
    if (primaryVars.pgSearchName) {
      const namePart = primaryVars.pgSearchName.includes(":")
        ? primaryVars.pgSearchName.split(":").pop()
        : primaryVars.pgSearchName;
      // Take the part before the first hyphen (if any)
      pgSearchVersion = namePart?.split("-")[0];
    }

    // Update badges if not tags-only
    if (!options.tagsOnly) {
      let currentReadmeContent = readmeContent; // Use a temporary variable for updates

      // --- Update pgvector badge ---
      if (pgvectorVersion) {
        if (!silent)
          console.log(
            `Attempting to update pgvector badge to version ${pgvectorVersion}...`
          );
        try {
          const badges =
            badgeManager.parseBadgesFromMarkdown(currentReadmeContent);
          const pgvectorBadgeIndex = badges.findIndex(
            (b) => b.label.toLowerCase() === "pgvector"
          ); // Case-insensitive find

          if (pgvectorBadgeIndex !== -1) {
            const updatedContent = badgeManager.updateBadgeInMarkdown(
              currentReadmeContent,
              pgvectorBadgeIndex,
              {
                message: pgvectorVersion,
                color: "green", // Keep original color logic or define here
              }
            );
            if (updatedContent !== currentReadmeContent) {
              if (!silent)
                console.log(
                  `pgvector badge updated successfully to ${pgvectorVersion}.`
                );
              currentReadmeContent = updatedContent; // Update the working content
            } else if (!silent) {
              if (!silent) console.log("pgvector badge already up-to-date.");
            }
          } else if (!silent) {
            console.warn("Warning: pgvector badge not found in README.");
          }
        } catch (error) {
          console.error("Error updating pgvector badge:", error);
          // Decide if we should exit or continue
        }
      } else if (!silent) {
        console.warn(
          "Warning: Could not determine pgvector version. Skipping update."
        );
      }

      // --- Update pg_search badge ---
      // Determine the string to use for the pg_search badge message
      let pgSearchStringForBadge = undefined;
      if (pgSearchVersion) {
        // Use the extracted version number
        // Construct the message with double hyphen for shields.io escaping
        pgSearchStringForBadge = `${pgSearchVersion}--pg${primaryVersion}`;
      }

      if (pgSearchStringForBadge) {
        if (!silent)
          console.log(
            `Attempting to update pg_search badge to version ${pgSearchStringForBadge}...`
          );
        try {
          const badges =
            badgeManager.parseBadgesFromMarkdown(currentReadmeContent);
          const pgSearchBadgeIndex = badges.findIndex(
            (b) => b.label.toLowerCase() === "pg_search"
          ); // Case-insensitive find

          if (pgSearchBadgeIndex !== -1) {
            const updatedContent = badgeManager.updateBadgeInMarkdown(
              currentReadmeContent,
              pgSearchBadgeIndex,
              {
                message: pgSearchStringForBadge, // Use the constructed string with '--'
                color: "blue", // Keep color consistent
              }
            );
            if (updatedContent !== currentReadmeContent) {
              if (!silent) console.log("pg_search badge updated.");
              currentReadmeContent = updatedContent;
              contentChangedOverall = true;
            } else if (!silent) {
              console.log("pg_search badge already up-to-date.");
            }
          } else if (!silent) {
            console.warn("pg_search badge not found in README.");
          }
        } catch (error) {
          console.error("Error updating pg_search badge:", error);
          // Decide if we should exit or continue
        }
      } else if (!silent) {
        console.warn("Could not determine pg_search version to update badge.");
      }

      // Update the main readmeContent if changes occurred in badges
      if (currentReadmeContent !== readmeContent) {
        readmeContent = currentReadmeContent;
        contentChangedOverall = true;
      }

      // Remove old updateBadge calls
      // const pgvectorResult = await updateBadge(...)
      // const pgSearchResult = await updateBadge(...)
    }

    // Update available tags section if not badge-only
    if (!options.badgeOnly) {
      // Generate markdown for available tags
      const tagsMarkdown = await generateAvailableTagsMarkdown(
        primaryVersion,
        supportedVersions,
        silent
      );

      // Update the tags section using the potentially modified readmeContent
      const updatedTagsContent = await updateAvailableTagsSection(
        readmeContent, // Use potentially updated content
        tagsMarkdown,
        readmeFile,
        silent
      );
      // Check if tags section changed
      if (updatedTagsContent !== readmeContent) {
        readmeContent = updatedTagsContent; // Update content with tags changes
        contentChangedOverall = true;
      }
    }

    // Final check and write file if needed
    if (contentChangedOverall && !dryRun) {
      try {
        writeFileSync(readmeFile, readmeContent);
        if (!silent)
          console.log(`README update complete. File "${readmeFile}" modified.`);
      } catch (err) {
        console.error(
          `Error writing updated README file "${readmeFile}":`,
          err
        );
        process.exit(1);
      }
    } else if (dryRun && !silent) {
      console.log("--- DRY RUN COMPLETE ---");
      if (!contentChangedOverall) {
        console.log("No changes detected.");
      } else {
        // Optionally show diff or final content in dry run
        console.log("[Dry Run] Changes detected. Final content would be:");
        console.log("--------------------------------------------------");
        // console.log(readmeContent); // Be careful with large files
        console.log("(Content omitted for brevity in dry run output)");
        console.log("--------------------------------------------------");
      }
    } else if (!silent) {
      // Not dry run, no changes
      console.log(
        `README update complete. File "${readmeFile}" already up-to-date.`
      );
    }
  } catch (error) {
    console.error("Error updating README:", error);
    process.exit(1);
  }
}

// Run the main function if this script is executed directly
if (import.meta.main) {
  main();
}

// Export for testing - remove updateBadge
export { generateAvailableTagsMarkdown, main, updateAvailableTagsSection };
