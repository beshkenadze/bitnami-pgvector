#!/usr/bin/env bun
import { $ as defaultShellExecutor } from "bun";
import { Command } from "commander";
import { getVars } from "./getVars"; // Assuming getVars can be imported

const ROOT_DIR = process.cwd();
const DOCKER_FILE = `${ROOT_DIR}/Dockerfile`;

interface BuildOptions {
  push?: boolean;
  platform?: string;
  pgMajorVersion: string;
}

async function runBuild(options: BuildOptions, shellExecutor: any = defaultShellExecutor, logger: (message?: any, ...optionalParams: any[]) => void = console.log) {
  logger(`Starting build for PG ${options.pgMajorVersion}...`);

  if (options.push) {
    logger("Push flag enabled.");
  }
  if (options.platform) {
    logger(`Platform specified: ${options.platform}`);
  } else {
    logger("Platform not specified, building for current architecture.");
  }

  // --- Get Variables ---
  logger("Fetching build variables...");
  let buildVars;
  try {
    buildVars = await getVars(options.pgMajorVersion, { suppressExports: true });
   
    if (!buildVars) {
        throw new Error("Build variables could not be determined.");
    }
  } catch (error) {
    console.error(`Error getting variables: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }

  // Check if image exists
  if (buildVars.imageExists && options.push) {
    logger("Image already exists in registry (detected by getVars). Skipping build and push.");
    return; // Exit successfully
  } else if (buildVars.imageExists) {
    logger("Image already exists locally or in registry (detected by getVars), but continuing with local build as --push was not specified.");
  }

  // --- Docker Build ---
  // Enable Docker BuildKit (usually set in environment, but good practice)
  process.env.DOCKER_BUILDKIT = "1";

  // Create and use a new builder instance (optional, consider if necessary)
  logger("Ensuring buildx builder instance exists...");
  try {
    await shellExecutor`docker buildx create --name multiarch-builder --use`;
  } catch (error) {
    console.warn(`Ignoring error during buildx create (likely already exists): ${error}`);
  }

  logger("Building Docker image...");

  const buildArgs = [
    `--build-arg BITNAMI_TAG='${buildVars.bitnamiName}'`,
    `--build-arg PGVECTOR_BUILDER_TAG='${buildVars.pgvectorBuilderTag}'`,
    `--build-arg PG_MAJOR_VERSION='${options.pgMajorVersion}'`,
    `--build-arg PG_SEARCH_TAG='${buildVars.pgSearchName}'`,
  ];

  const tags = [
    `--tag '${buildVars.tagShort}'`, // Use tagShort from getVars
    `--tag '${buildVars.tagLatestPg}'`, // Use tagLatestPg from getVars
  ];

  const platformArg = options.platform ? `--platform ${options.platform}` : "";
  const pushArg = options.push ? "--push" : "";

  // Constructing command string for logging (easier to read)
  const commandStringLog = `docker buildx build ${platformArg} ${buildArgs.join(" ")} ${tags.join(" ")} ${pushArg} .`;

  logger("Running command:");
  logger(commandStringLog); // Log the command string

  // Construct parts of the command
  const baseCmd = ["docker", "buildx", "build"];
  const platformCmd = options.platform ? ["--platform", options.platform] : [];
  const buildArgsCmd = [
    "--build-arg", `BITNAMI_TAG=${buildVars.bitnamiName}`,
    "--build-arg", `PGVECTOR_BUILDER_TAG=${buildVars.pgvectorBuilderTag}`,
    "--build-arg", `PG_MAJOR_VERSION=${options.pgMajorVersion}`,
    "--build-arg", `PG_SEARCH_TAG=${buildVars.pgSearchName}`,
  ];
  const tagsCmd = [
    "--tag", buildVars.tagShort,
    "--tag", buildVars.tagLatestPg, // Use tagLatestPg from getVars
  ];
  const pushCmd = options.push ? ["--push"] : [];
  const context = ["."];
  const fileArg = ["-f", "Dockerfile"]; // Specify Dockerfile path

  // Construct the command string for the tagged template
  const commandString = `docker buildx build ${platformCmd.join(" ")} ${buildArgsCmd.join(" ")} ${tagsCmd.join(" ")} ${pushCmd.join(" ")} ${fileArg.join(" ")} ${context.join(" ")}`.trim();

  // Log the command string for verification
  logger("Executing command string:", commandString); 

  // Use tagged template literal syntax
  await shellExecutor`${commandString}`;

  logger("Build completed successfully!");
  const latestTag = buildVars.tagLatestPg; // Use tagLatestPg from getVars
  if (options.push) {
    logger(`Image tagged and pushed as: ${buildVars.tagShort}`);
    logger(`Image also tagged and pushed as: ${latestTag}`);
  } else {
    logger(`Image tagged locally as: ${buildVars.tagShort}`);
    logger(`Image also tagged locally as: ${latestTag}`);
  }
}

// --- Main Execution ---
if (import.meta.main) {
  const program = new Command();

  program
    .name("bun run src/build.ts")
    .description("Build the pgvector Docker image")
    .requiredOption("--pg <version>", "Required: PostgreSQL major version (e.g., 16)")
    .option("--push", "Push the image to the registry after building")
    .option("--platform <platforms>", "Set target platforms for build (e.g., linux/amd64,linux/arm64)")
    .action(async (options) => {
        // Basic validation: Ensure pg is a number-like string
        if (isNaN(parseInt(options.pg, 10))) {
            console.error(`Error: Invalid PostgreSQL version provided: '${options.pg}'. Must be a number.`);
            process.exit(1);
        }
        
        const buildOptions: BuildOptions = {
            pgMajorVersion: options.pg, // Use options.pg
            push: options.push,
            platform: options.platform,
        };
       await runBuild(buildOptions);
    });

  program.parse(process.argv);
}

// Export for testing
export { runBuild };
