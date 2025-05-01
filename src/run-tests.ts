#!/usr/bin/env bun
import { $ } from "bun";
import { Command } from "commander";
import { getVars } from "./getVars";

const DEFAULT_PG_VERSION = "16"; // Default to a generally available version
const TEST_DB_USER = "testuser";
const TEST_DB_PASSWORD = "testpassword";
const TEST_DB_NAME = "testdb";
const TEST_DB_PORT = 5433; // Use a non-default port to avoid conflicts

async function waitForDbReady(containerName: string, timeoutSeconds: number = 60): Promise<boolean> {
  console.log(`Waiting for database in container ${containerName} to be ready...`);
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutSeconds * 1000) {
    const check = await $`docker exec ${containerName} pg_isready -U ${TEST_DB_USER} -d ${TEST_DB_NAME} -h localhost -p 5432`.nothrow().quiet();
    if (check.exitCode === 0) {
      console.log("Database is ready.");
      return true;
    }
    await Bun.sleep(2000); // Wait 2 seconds before retrying
  }
  console.error(`Database readiness timed out after ${timeoutSeconds} seconds.`);
  return false;
}

async function runTests(pgMajorVersion: string) {
  const containerName = `pgvector-test-db-pg${pgMajorVersion}`;
  let testExitCode = 1; // Default to failure

  try {
    console.log(`Fetching variables for PG ${pgMajorVersion}...`);
    const vars = await getVars(pgMajorVersion, { suppressExports: true });
    // Use tagShort which is reliably loaded locally by buildx build without --load
    const imageTag = vars.tagShort;
    if (!imageTag) {
        console.error(`Could not determine a valid image tag (tagShort) for PG ${pgMajorVersion}.`);
        process.exit(1);
    }
    console.log(`Using image tag: ${imageTag}`);

    // --- Cleanup previous run (if any) ---
    console.log(`Cleaning up previous container (if exists): ${containerName}`);
    await $`docker stop ${containerName}`.nothrow().quiet();
    await $`docker rm ${containerName}`.nothrow().quiet();

    // --- Start Test Database Container ---
    console.log(`Starting test database container ${containerName}...`);
    const runResult = await $`docker run -d --name ${containerName} \
        -e POSTGRES_USER=${TEST_DB_USER} \
        -e POSTGRES_PASSWORD=${TEST_DB_PASSWORD} \
        -e POSTGRES_DB=${TEST_DB_NAME} \
        -p ${TEST_DB_PORT}:5432 \
        ${imageTag}`.nothrow();

    if (runResult.exitCode !== 0) {
        console.error(`Failed to start container ${containerName}. Exit code: ${runResult.exitCode}`);
        console.error("Stderr:", runResult.stderr.toString());
        process.exit(1);
    }
    console.log(`Container ${containerName} started.`);

    // --- Wait for DB ---
    if (!await waitForDbReady(containerName)) {
        throw new Error("Database failed to become ready.");
    }

    // --- Set Environment Variables for Tests ---
    process.env.PGHOST = "localhost";
    process.env.PGPORT = String(TEST_DB_PORT);
    process.env.PGUSER = TEST_DB_USER;
    process.env.PGPASSWORD = TEST_DB_PASSWORD;
    process.env.PGDATABASE = TEST_DB_NAME;
    console.log("Database connection environment variables set for tests.");

    // --- Run Tests ---
    console.log("Running tests...");
    // Use the directory path directly, bun test handles discovery
    const testResult = await $`bun test src/tests`.nothrow();
    testExitCode = testResult.exitCode ?? 1; // Use exit code from test run

    console.log(`Tests finished with exit code: ${testExitCode}`);

  } catch (error) {
      console.error("An error occurred during the test process:", error);
      testExitCode = 1; // Ensure failure exit code on error
  } finally {
      // --- Cleanup ---
      console.log(`Stopping and removing container ${containerName}...`);
      await $`docker stop ${containerName}`.nothrow().quiet();
      // Re-enable container removal
      await $`docker rm ${containerName}`.nothrow().quiet();
      console.log("Cleanup complete."); // Reverted log message
  }

  process.exit(testExitCode);
}

// --- Main Execution ---
if (import.meta.main) {
  const program = new Command();

  program
    .name("bun run src/run-tests.ts")
    .description("Start a test DB container, run tests, and clean up.")
    .option("--pg <version>", "PostgreSQL major version for the test database", DEFAULT_PG_VERSION)
    .action(async (options) => {
        if (Number.isNaN(Number.parseInt(options.pg, 10))) {
            console.error(`Error: Invalid PostgreSQL version provided: '${options.pg}'. Must be a number.`);
            process.exit(1);
        }
        await runTests(options.pg);
    });

  program.parse(process.argv);
} 