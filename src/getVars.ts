#!/usr/bin/env bun
import { $ } from "bun";
import { Command } from "commander";

interface DockerHubTag {
  name: string;
  last_updated: string;
}

interface DockerHubResponse {
  results: DockerHubTag[];
}

// Interface for the variables returned
export interface ImageVars {
  bitnamiName: string;
  pgvectorBaseVersion: string;
  pgSearchName: string;
  fullImageTag: string;
  tagShort: string;
  tagWithFullPostgresVersion: string;
  pgvectorBuilderTag: string;
  imageExists: boolean;
  repoName: string;
  tagLatestPg: string;
}

// Default values
const DEFAULT_PGVECTOR_VERSION = "0.8.0"; // Base version, will append -pgX
const DEFAULT_BITNAMI_POSTGRES_VERSION = "17.2.0-debian-12-r1"; // Example, adjust as needed
const DEFAULT_PG_SEARCH_VERSION = "latest"; // Example stable version

async function fetchLatestBitnamiTag(
  pgMajorVersion: string
): Promise<string | null> {
  const bitnamiRepo = "bitnami/postgresql";
  const tagPrefix = `${pgMajorVersion}.`;
  // Using v2 API, filtering server-side might not be perfect, doing client-side filtering too
  const url = `https://hub.docker.com/v2/repositories/${bitnamiRepo}/tags/?page_size=100&name=${tagPrefix}`;

  try {
    console.log(
      `Fetching latest Bitnami tag for PostgreSQL ${pgMajorVersion} from ${url}...`
    );
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(
        `Failed to fetch tags from Docker Hub: ${response.statusText}`
      );
      return null;
    }
    const data = (await response.json()) as DockerHubResponse;

    const debianTags = data.results
      .filter(
        (tag) => tag.name.startsWith(tagPrefix) && tag.name.includes("-debian-")
      )
      // Simple version sort might be needed if last_updated isn't reliable
      .sort(
        (a, b) =>
          new Date(b.last_updated).getTime() -
          new Date(a.last_updated).getTime()
      );

    if (debianTags.length > 0) {
      console.log(`Latest Bitnami tag found: ${debianTags[0]?.name}`);
      return debianTags[0]?.name ?? null;
    }
    console.warn(`No matching Debian tags found for prefix ${tagPrefix}.`);
    return null;
  } catch (error) {
    console.error(`Error fetching or parsing Docker Hub tags: ${error}`);
    return null;
  }
}

async function fetchLatestPgSearchTag(
  pgMajorVersion: string
): Promise<string | null> {
  const paradeDbRepo = "paradedb/paradedb";
  // Construct tag suffix like "-pg16", "-pg17"
  const tagSuffix = `-pg${pgMajorVersion}`;
  // Fetch more tags and filter client-side
  const url = `https://hub.docker.com/v2/repositories/${paradeDbRepo}/tags/?page_size=100&ordering=last_updated&name=-pg${pgMajorVersion}`;

  try {
    console.log(
      `Fetching latest ParadeDB tags for PG ${pgMajorVersion} from ${url}...`
    );
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(
        `Failed to fetch ParadeDB tags from Docker Hub: ${response.statusText} (URL: ${url})`
      );
      return null;
    }
    const data = (await response.json()) as DockerHubResponse;

    // Filter tags ending with the specific suffix first
    const relevantTags = data.results.filter(tag => tag.name.endsWith(tagSuffix));

    // Find the latest stable versioned tag (semver like pattern, excluding -rc)
    const versionedStableTag = relevantTags.find(
      (tag) => /^\d+\.\d+\.\d+.*-pg\d+$/.test(tag.name) && !tag.name.includes("-rc")
    );

    if (versionedStableTag) {
      console.log(`Latest stable versioned ParadeDB tag found: ${versionedStableTag.name}`);
      return versionedStableTag.name;
    }
    console.log(`No stable versioned ParadeDB tag found ending with ${tagSuffix}. Checking for 'latest' tag.`);

    // Fallback: Find the 'latest' tag for the PG version
    const latestTag = relevantTags.find(tag => tag.name === `latest-pg${pgMajorVersion}`);

    if (latestTag) {
        console.log(`Using fallback 'latest' ParadeDB tag: ${latestTag.name}`);
        return latestTag.name;
    }

    console.warn(
      `No stable versioned or 'latest' ParadeDB tags found ending with ${tagSuffix}.`
    );
    return null;
  } catch (error) {
    console.error(`Error fetching or parsing ParadeDB Docker Hub tags: ${error}`);
    return null;
  }
}

async function checkImageExists(fullImageTag: string): Promise<boolean> {
  console.log(`Checking if image ${fullImageTag} exists in registry...`);
  try {
    // Use Bun Shell to run docker manifest inspect
    const result = await $`docker manifest inspect ${fullImageTag}`
      .quiet()
      .nothrow();

    // Check exit code to determine if the image exists
    if (result.exitCode === 0) {
      console.log(`Image ${fullImageTag} found in registry.`);
      return true;
    }
    console.log(
      `Image ${fullImageTag} not found in registry (exit code: ${result.exitCode}).`
    );
    return false;
  } catch (error: unknown) {
    // This should rarely happen with nothrow(), but handle it just in case
    console.error(
      `Error checking image existence for ${fullImageTag}: ${error}`
    );
    return false;
  }
}

export async function getVars(
  pgMajorVersionInput?: string,
  options?: { suppressExports?: boolean }
): Promise<ImageVars> {
  const pgMajorVersion = pgMajorVersionInput ?? Bun.env.PG_MAJOR_VERSION;
  const suppressExports = options?.suppressExports ?? false;

  if (!pgMajorVersion) {
    console.error(
      "Error: PG_MAJOR_VERSION environment variable is not set and no argument provided."
    );
    process.exit(1);
  }

  let bitnamiName: string;
  const latestBitnamiTag = await fetchLatestBitnamiTag(pgMajorVersion);

  if (latestBitnamiTag) {
    bitnamiName = latestBitnamiTag;
  } else {
    console.warn(
      `Warning: Could not automatically determine the latest Bitnami tag for PG ${pgMajorVersion}. Using default: ${DEFAULT_BITNAMI_POSTGRES_VERSION}`
    );
    bitnamiName = DEFAULT_BITNAMI_POSTGRES_VERSION;
  }

  const pgvectorBaseVersion = Bun.env.PGVECTOR_VERSION ?? DEFAULT_PGVECTOR_VERSION;
  const pgvectorBuilderTag = `${pgvectorBaseVersion}-pg${pgMajorVersion}`; // Construct tag with PG version

  // Fetch latest stable ParadeDB tag
  let pgSearchName: string;
  const latestPgSearchTag = await fetchLatestPgSearchTag(pgMajorVersion);
  if (latestPgSearchTag) {
    pgSearchName = latestPgSearchTag;
  } else {
    console.warn(
      `Warning: Could not automatically determine the latest stable ParadeDB tag for PG ${pgMajorVersion}. Using default: ${DEFAULT_PG_SEARCH_VERSION}-pg${pgMajorVersion}`
    );
    // Construct a plausible default tag name
    pgSearchName = `${DEFAULT_PG_SEARCH_VERSION}-pg${pgMajorVersion}`;
  }

  const registry = Bun.env.REGISTRY ?? "ghcr.io";
  // Use Bun.$ to get git repo root and name
  const repoRoot = (await $`git rev-parse --show-toplevel`.text()).trim();
  const repoName =
    Bun.env.REPO_NAME ?? repoRoot.split("/").pop() ?? "unknown-repo";

  const fullImageTag = `${registry}/${repoName}:${pgvectorBuilderTag}-${bitnamiName}`;
  const tagShort = `${registry}/${repoName}:${pgvectorBuilderTag}`;
  // Construct the tag using only major versions for postgres part
  const tagWithFullPostgresVersion = `${registry}/${repoName}:${pgvectorBuilderTag}-postgres${pgMajorVersion}`;
  const tagLatestPg = `${registry}/${repoName}:latest-pg${pgMajorVersion}`;

  console.log(`Bitnami Base Image: ${bitnamiName}`);
  console.log(`PGVector Base Version: ${pgvectorBaseVersion}`);
  console.log(`Full Image Tag: ${fullImageTag}`);
  console.log(`Short Tag: ${tagShort}`);
  console.log(`Full PGVector Postgres Tag: ${tagWithFullPostgresVersion}`);
  console.log(`ParadeDB/pg_search Tag: ${pgSearchName}`);
  console.log(`PGVector Builder Tag Used: ${pgvectorBuilderTag}`);

  const imageExists = await checkImageExists(fullImageTag);

  const vars: ImageVars = {
    bitnamiName,
    pgvectorBaseVersion,
    pgSearchName,
    fullImageTag,
    tagShort,
    tagWithFullPostgresVersion,
    pgvectorBuilderTag,
    imageExists,
    repoName,
    tagLatestPg,
  };

  // Output for GitHub Actions or export locally
  if (Bun.env.GITHUB_OUTPUT) {
    const outputFile = Bun.file(Bun.env.GITHUB_OUTPUT);
    const writer = outputFile.writer();
    writer.write(`BITNAMI_NAME=${vars.bitnamiName}
`);
    writer.write(`PGVECTOR_BASE_VERSION=${vars.pgvectorBaseVersion}
`);
    writer.write(`FULL_IMAGE_TAG=${vars.fullImageTag}
`);
    writer.write(`TAG_SHORT=${vars.tagShort}
`);
    writer.write(`TAG_WITH_FULL_POSTGRES_VERSION=${vars.tagWithFullPostgresVersion}
`);
    writer.write(`IMAGE_EXISTS=${vars.imageExists}
`);
    writer.write(`PG_SEARCH_NAME=${vars.pgSearchName}
`);
    writer.write(`PGVECTOR_BUILDER_TAG=${vars.pgvectorBuilderTag}
`);
    writer.write(`TAG_LATEST_PG=${vars.tagLatestPg}
`);
    await writer.flush();
    console.log("Variables written to GITHUB_OUTPUT.");
  } else if (!suppressExports) {
    // For local execution, print KEY=VALUE pairs for sourcing
    // Note: Directly exporting isn't feasible like in shell.
    // Consumers would import and use the returned object.
    // console.log("Variables determined (local run):", vars);
    console.log(`export BITNAMI_NAME='${vars.bitnamiName}'`);
    console.log(`export PGVECTOR_BASE_VERSION='${vars.pgvectorBaseVersion}'`);
    console.log(`export PG_SEARCH_NAME='${vars.pgSearchName}'`);
    console.log(`export PGVECTOR_BUILDER_TAG='${vars.pgvectorBuilderTag}'`);
    console.log(`export FULL_IMAGE_TAG='${vars.fullImageTag}'`);
    console.log(`export TAG_SHORT='${vars.tagShort}'`);
    console.log(`export TAG_WITH_FULL_POSTGRES_VERSION='${vars.tagWithFullPostgresVersion}'`);
    console.log(`export IMAGE_EXISTS='${vars.imageExists}'`); // Export image existence status
    const repoRoot = (await $`git rev-parse --show-toplevel`.text()).trim();
    const repoName = Bun.env.REPO_NAME ?? repoRoot.split("/").pop() ?? "unknown-repo";
    console.log(`export REPO_NAME='${repoName}'`);
  }

  return vars;
}

// Allow running the script directly
// bun run scripts/getVars.ts
// PG_MAJOR_VERSION=16 bun run scripts/getVars.ts
if (import.meta.main) {
  const program = new Command();
  program
    .name("get-vars")
    .description("Get variables for building the pgvector image")
    .option(
      "-p, --pg-version <version>",
      "Major PostgreSQL version (e.g., 16, 17)"
    )
    .parse(process.argv);

  const options = program.opts();
  const pgMajorVersionArg = options.pgVersion; // Use parsed option

  // Get PG major version from the first command line argument
  // const pgMajorVersionArg = process.argv[2]; // Removed original argument parsing

  getVars(pgMajorVersionArg).catch((err) => { // Pass the parsed version or undefined
    console.error("Script failed:", err);
    process.exit(1);
  });
}
