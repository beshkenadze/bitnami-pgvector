#!/usr/bin/env bun
import { $ } from "bun";

interface DockerHubTag {
  name: string;
  last_updated: string;
}

interface DockerHubResponse {
  results: DockerHubTag[];
}

interface ImageVars {
  bitnamiName: string;
  pgvectorName: string;
  fullImageTag: string;
  tagShort: string;
  tagFullPgvectorPostgres: string;
  imageExists: boolean;
}

// Default values
const DEFAULT_PGVECTOR_VERSION = "0.8.0";
const DEFAULT_BITNAMI_POSTGRES_VERSION = "17.2.0-debian-12-r1"; // Example, adjust as needed

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
  pgMajorVersionInput?: string
): Promise<ImageVars> {
  const pgMajorVersion = pgMajorVersionInput ?? Bun.env.PG_MAJOR_VERSION;

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

  const pgvectorName = Bun.env.PGVECTOR_VERSION ?? DEFAULT_PGVECTOR_VERSION;

  const registry = Bun.env.REGISTRY ?? "ghcr.io";
  // Use Bun.$ to get git repo root and name
  const repoRoot = (await $`git rev-parse --show-toplevel`.text()).trim();
  const repoName =
    Bun.env.REPO_NAME ?? repoRoot.split("/").pop() ?? "unknown-repo";

  const fullImageTag = `${registry}/${repoName}:${pgvectorName}-pg${pgMajorVersion}-${bitnamiName}`;
  const tagShort = `${registry}/${repoName}:${pgvectorName}-pg${pgMajorVersion}`;
  // Construct the tag using only major versions for postgres part
  const tagFullPgvectorPostgres = `${registry}/${repoName}:${pgvectorName}-postgres${pgMajorVersion}`;

  console.log(`Bitnami Base Image: ${bitnamiName}`);
  console.log(`PGVector Version: ${pgvectorName}`);
  console.log(`Full Image Tag: ${fullImageTag}`);
  console.log(`Short Tag: ${tagShort}`);
  console.log(`Full PGVector Postgres Tag: ${tagFullPgvectorPostgres}`);

  const imageExists = await checkImageExists(fullImageTag);

  const vars: ImageVars = {
    bitnamiName,
    pgvectorName,
    fullImageTag,
    tagShort,
    tagFullPgvectorPostgres,
    imageExists,
  };

  // Output for GitHub Actions or export locally
  if (Bun.env.GITHUB_OUTPUT) {
    const outputFile = Bun.file(Bun.env.GITHUB_OUTPUT);
    const writer = outputFile.writer();
    writer.write(`BITNAMI_NAME=${vars.bitnamiName}
`);
    writer.write(`PGVECTOR_NAME=${vars.pgvectorName}
`);
    writer.write(`FULL_IMAGE_TAG=${vars.fullImageTag}
`);
    writer.write(`TAG_SHORT=${vars.tagShort}
`);
    writer.write(`TAG_FULL_PGVECTOR_POSTGRES=${vars.tagFullPgvectorPostgres}
`);
    writer.write(`IMAGE_EXISTS=${vars.imageExists}
`);
    await writer.flush();
    console.log("Variables written to GITHUB_OUTPUT.");
  } else {
    // For local execution, just log or potentially set env vars if needed
    // Note: Directly exporting isn't feasible like in shell.
    // Consumers would import and use the returned object.
    console.log("Variables determined (local run):", vars);
  }

  return vars;
}

// Allow running the script directly
// bun run scripts/getVars.ts
// PG_MAJOR_VERSION=16 bun run scripts/getVars.ts
if (import.meta.main) {
  getVars().catch((err) => {
    console.error("Script failed:", err);
    process.exit(1);
  });
}
