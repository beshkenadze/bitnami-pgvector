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
 * Updates the pgvector badge in the README.md file
 */
async function updatePgvectorBadge(
  readmeFile: string,
  primaryVersion: number,
  dryRun: boolean,
  silent: boolean
): Promise<string> {
  if (!silent)
    console.log(
      `Determining pgvector version for PostgreSQL ${primaryVersion}...`
    );

  // Get variables from getVars for the primary PG version
  const vars = await getVars(primaryVersion.toString());
  // Extract version number (e.g., "0.7.0") from base version (e.g., "pgvector-0.7.0")
  const baseVersion = vars.pgvectorBaseVersion;
  const versionParts = baseVersion?.split('-');
  const pgvectorVersion = versionParts?.[versionParts.length - 1];

  if (!pgvectorVersion) {
    console.error(
      `Error: Could not determine pgvector version for PG ${primaryVersion}`
    );
    process.exit(1);
  }

  if (!silent)
    console.log(`Found primary pgvector version: ${pgvectorVersion}`);

  // Read README.md content
  const readmeContent = readFileSync(readmeFile, "utf-8");

  // Update the badge using regex, similar to the sed command in the shell script
  const updatedContent = readmeContent.replace(
    /img\.shields\.io\/badge\/pgvector-[0-9.]*-green\.svg/,
    `img.shields.io/badge/pgvector-${pgvectorVersion}-green.svg`
  );

  // If it's a dry run, just return the updated content
  if (dryRun) {
    return updatedContent;
  }

  // Write updated content back to README.md
  writeFileSync(readmeFile, updatedContent);
  if (!silent) console.log("pgvector badge updated successfully.");

  return updatedContent;
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

    let readmeContent = "";

    // Update pgvector badge if not tags-only
    if (!options.tagsOnly) {
      readmeContent = await updatePgvectorBadge(
        readmeFile,
        primaryVersion,
        dryRun,
        silent
      );
    } else if (!dryRun) {
      // If we're only updating tags but need the readme content for that
      readmeContent = readFileSync(readmeFile, "utf-8");
    }

    // Update available tags section if not badge-only
    if (!options.badgeOnly) {
      // Generate markdown for available tags
      const tagsMarkdown = await generateAvailableTagsMarkdown(
        primaryVersion,
        supportedVersions,
        silent
      );

      // If we have the readme content (from badge update or reading it), use that
      if (readmeContent) {
        await updateAvailableTagsSection(
          readmeContent,
          tagsMarkdown,
          readmeFile,
          dryRun,
          silent
        );
      } else {
        // Otherwise read the readme content first
        const content = readFileSync(readmeFile, "utf-8");
        await updateAvailableTagsSection(
          content,
          tagsMarkdown,
          readmeFile,
          dryRun,
          silent
        );
      }
    }

    if (dryRun && !silent) {
      console.log("--- DRY RUN COMPLETE - No files were modified ---");
    } else if (!silent) {
      console.log("README update complete.");
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
  generateAvailableTagsMarkdown, main, updateAvailableTagsSection, updatePgvectorBadge
};

