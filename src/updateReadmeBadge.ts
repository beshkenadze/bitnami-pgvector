#!/usr/bin/env bun
import { Command } from "commander";
import { readFileSync, writeFileSync } from "node:fs";
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
 * Updates a generic badge in the README.md file
 */
async function updateBadge(
  readmeContent: string,
  badgeName: string,
  version: string,
  color: string,
  readmeFile: string,
  dryRun: boolean,
  silent: boolean
): Promise<{ updatedContent: string; changed: boolean }> {
  if (!version) {
    if (!silent) console.warn(`Warning: Could not determine version for ${badgeName} badge. Skipping update.`);
    return { updatedContent: readmeContent, changed: false };
  }
  if (!silent) console.log(`Updating ${badgeName} badge to version ${version}...`);

  
  // Update the badge using regex
  const pattern = new RegExp(
    // Simplified pattern: Match badge name, anything up to the last hyphen before color, then color.svg
    `img\.shields\.io\/badge\/${badgeName}-.*-${color}\.svg`,
    "i" // Case-insensitive match for badge name
  );

  // Escape hyphens for shields.io message format, then URL encode
  const escapedVersion = version.replace(/-/g, "--"); // Replace - with --
  const encodedVersion = encodeURIComponent(escapedVersion); // URL-encode the escaped version
  const escapedBadgeName = badgeName.replace(/-/g, "--");
  const replacement = `img.shields.io/badge/${escapedBadgeName}-${encodedVersion}-${color}.svg?logo=postgresql&logoColor=white`; // Use encoded version

  // Check if replacement is needed
  if (!pattern.test(readmeContent)) {
    if (!silent) console.warn(`Warning: Pattern for ${badgeName} badge not found in ${readmeFile}. Skipping update.`);
    return { updatedContent: readmeContent, changed: false };
  }

  const updatedContent = readmeContent.replace(pattern, replacement);
  const changed = updatedContent !== readmeContent;

  if (changed && !dryRun) {
    // Write updated content back to README.md immediately if changed and not dry run
    // Note: This means intermediate writes happen per badge. Could optimize later if needed.
    writeFileSync(readmeFile, updatedContent);
    if (!silent) console.log(`${badgeName} badge updated successfully.`);
  } else if (changed && dryRun && !silent) {
    console.log(`[Dry Run] Would update ${badgeName} badge.`);
  } else if (!changed && !silent) {
    if (!silent) console.log(`${badgeName} badge already up-to-date.`);
  }

  return { updatedContent, changed };
}

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
    tagsMarkdown += `*   \`${primaryVars.versionsHashTag.split('/').pop()}\`: SHA256 hash tag representing the specific combination of PG, pgvector, and pg_search versions used in the latest build.\n`;
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
    const pgSearchVer = pgSearchName?.split(':').pop() ?? 'unknown';

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
  dryRun: boolean,
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

  // If it's a dry run, just return the updated content
  if (dryRun) {
    return updatedContent;
  }

  // Write updated content back to README.md
  writeFileSync(readmeFile, updatedContent);
  if (!silent) console.log("Available tags section updated successfully.");

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

    // Read the initial content only once if not doing dry run or verbose output required later
    let readmeContent = "";
    try {
      readmeContent = readFileSync(readmeFile, "utf-8");
    } catch (err) {
      console.error(`Error reading README file "${readmeFile}":`, err);
      process.exit(1);
    }
    let contentChangedOverall = false;

    // Determine primary versions for badges
    const primaryVars = await getVars(primaryVersion.toString());
    // Extract version number (e.g., "0.7.0") from base version (e.g., "pgvector-0.7.0")
    const pgvectorVersion = primaryVars.pgvectorBaseVersion?.split('-').pop();
    // Extract pg_search version (e.g., 0.15.18) from name (e.g., owner/repo:0.15.18-pg17)
    let pgSearchVersion = undefined;
    if (primaryVars.pgSearchName) {
      const namePart = primaryVars.pgSearchName.includes(':')
        ? primaryVars.pgSearchName.split(':').pop()
        : primaryVars.pgSearchName;
      // Take the part before the first hyphen (if any)
      pgSearchVersion = namePart?.split('-')[0];
    }

    // Update badges if not tags-only
    if (!options.tagsOnly) {
      // Update pgvector badge
      const pgvectorResult = await updateBadge(
        readmeContent,
        "pgvector", // badge name in URL path
        pgvectorVersion ?? "", // Pass empty string if undefined
        "green",
        readmeFile,
        dryRun,
        silent
      );
      if (pgvectorResult.changed) {
        readmeContent = pgvectorResult.updatedContent; // Update content for next step
        contentChangedOverall = true;
      }

      // Determine the string to use for the pg_search badge message
      let pgSearchStringForBadge = undefined;
      if (primaryVars.pgSearchName) {
        // Example pgSearchName: 'owner/repo:0.15.18-pg17' or '0.15.18-pg17' or 'latest-pg17'
        pgSearchStringForBadge = primaryVars.pgSearchName.includes(':')
          ? primaryVars.pgSearchName.split(':').pop() ?? '' // Get '0.15.18-pg17' or 'latest-pg17'
          : primaryVars.pgSearchName;
      }

      // Update pg_search badge
      if (!silent) console.log(`>>> Determined pg_search version string for badge: ${pgSearchStringForBadge ?? 'undefined'}`);
      const pgSearchResult = await updateBadge(
        readmeContent,
        "pg_search", // badge name in URL path
        pgSearchStringForBadge ?? "", // Pass the full string like '0.15.18-pg17'
        "blue",
        readmeFile,
        dryRun,
        silent
      );
      if (pgSearchResult.changed) {
        readmeContent = pgSearchResult.updatedContent; // Update content for next step
        contentChangedOverall = true;
      }
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
      const tagsResult = await updateAvailableTagsSection(
        readmeContent, // Use potentially updated content
        tagsMarkdown,
        readmeFile,
        dryRun,
        silent
      );
      // Note: updateAvailableTagsSection writes the file itself if not dryRun
      if (tagsResult !== readmeContent) { // Compare with content *before* tag update
        contentChangedOverall = true;
        // readmeContent = tagsResult; // updateAvailableTagsSection handles the write
      }
    }

    if (dryRun && !silent) {
      console.log("--- DRY RUN COMPLETE ---");
      if (!contentChangedOverall) {
        console.log("No changes detected.");
      }
    } else if (!silent) {
      if (contentChangedOverall) {
        console.log(`README update complete. File "${readmeFile}" modified.`);
      } else {
        console.log(`README update complete. File "${readmeFile}" already up-to-date.`);
      }
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

// Export for testing
export {
  generateAvailableTagsMarkdown, main, updateAvailableTagsSection, updateBadge
};

