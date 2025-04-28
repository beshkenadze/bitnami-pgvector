#!/usr/bin/env bun
/**
 * CI/CD setup script for bitnami-pgvector
 * This script is used to set up the CI/CD environment for testing
 * and deploying the bitnami-pgvector image.
 */

import { $ } from "bun";

/**
 * Check if Bun and necessary dependencies are installed
 */
async function checkPrerequisites(): Promise<boolean> {
  try {
    // Check Bun version
    const bunVersion = await $`bun --version`.text();
    console.log(`✅ Bun installed: ${bunVersion.trim()}`);

    // Check PostgreSQL client tools
    try {
      const pgVersionResult = await $`psql --version`.quiet().nothrow();
      if (pgVersionResult.exitCode === 0) {
        console.log(
          `✅ PostgreSQL client tools installed: ${pgVersionResult.stdout.toString().trim()}`
        );
      } else {
        console.log("⚠️ PostgreSQL client tools not installed (optional)");
      }
    } catch (_error) {
      console.log("⚠️ PostgreSQL client tools not installed (optional)");
    }

    return true;
  } catch (error) {
    console.error(`❌ Error checking prerequisites: ${error}`);
    return false;
  }
}

/**
 * Setup environment variables for testing
 */
async function setupEnvironment(
  pgHost: string = process.env.PGHOST || "localhost",
  pgPort: string = process.env.PGPORT || "5432",
  pgUser: string = process.env.PGUSER || "postgres",
  pgPassword: string = process.env.PGPASSWORD || "password",
  pgDatabase: string = process.env.PGDATABASE || "postgres"
): Promise<void> {
  console.log("Setting up environment for testing...");

  // Log environment variables for debugging
  console.log(`
Environment:
- PGHOST: ${pgHost}
- PGPORT: ${pgPort}
- PGUSER: ${pgUser}
- PGDATABASE: ${pgDatabase}
- PGPASSWORD: ${pgPassword ? "******" : "not set"}
  `);

  // Verify database connection if possible
  try {
    // Only try to connect if pg client is installed
    const pgVersionResult = await $`psql --version`.quiet().nothrow();
    if (pgVersionResult.exitCode === 0) {
      console.log("Attempting to connect to database...");

      // Set temporary environment variables for connection test
      process.env.PGHOST = pgHost;
      process.env.PGPORT = pgPort;
      process.env.PGUSER = pgUser;
      process.env.PGPASSWORD = pgPassword;
      process.env.PGDATABASE = pgDatabase;

      const connectionTest = await $`psql -c "SELECT 1 as connection_test;"`
        .quiet()
        .nothrow();

      if (connectionTest.exitCode === 0) {
        console.log("✅ Successfully connected to database");
      } else {
        console.log("⚠️ Could not connect to database - tests may fail");
      }
    }
  } catch (_error) {
    console.log("Skipping database connection test (psql not available)");
  }
}

/**
 * Main function to run setup
 */
async function main(): Promise<void> {
  console.log("🚀 Starting CI/CD setup...");

  const prereqsOk = await checkPrerequisites();
  if (!prereqsOk) {
    console.error("❌ Prerequisites check failed");
    process.exit(1);
  }

  await setupEnvironment();

  console.log("✅ CI/CD setup complete");
}

// Run the main function if this script is executed directly
if (import.meta.main) {
  main().catch((err) => {
    console.error("❌ Setup failed:", err);
    process.exit(1);
  });
}

export { checkPrerequisites, setupEnvironment };
