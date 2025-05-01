import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import pg from "pg";

const { Client } = pg;

interface ConnectionOptions extends pg.ConnectionConfig {
  connectionTimeoutMillis?: number;
}

// Connection details from environment variables
const connectionOptions: ConnectionOptions = {
  host: process.env.PGHOST || "localhost",
  port: Number.parseInt(process.env.PGPORT || "5432"),
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "password",
  database: process.env.PGDATABASE || "postgres",
  connectionTimeoutMillis: 10000,
};

// Shared client for all tests in this file
let client: pg.Client;

// Connection retry logic
async function connectWithRetry(
  connectionOptions: ConnectionOptions,
  maxRetries = 5,
  retryInterval = 3000
): Promise<pg.Client> {
  let retries = 0;

  while (retries < maxRetries) {
    const client = new Client(connectionOptions);

    try {
      console.log(`Connection attempt ${retries + 1}/${maxRetries}...`);
      await client.connect();
      console.log("Connected successfully.");
      return client;
    } catch (err) {
      retries++;
      console.log(
        `Connection failed (${retries}/${maxRetries}): ${(err as Error).message}`
      );

      // Always close the client, even if connection failed
      try {
        await client.end();
      } catch (_closeErr) {
        // Ignore errors during client closing
      }

      if (retries >= maxRetries) {
        console.error("Maximum connection attempts reached!");
        throw err;
      }

      console.log(`Waiting ${retryInterval / 1000} seconds before retrying...`);
      await new Promise((resolve) => setTimeout(resolve, retryInterval));
    }
  }

  throw new Error("Failed to connect after retries");
}

describe("pgvector Functionality", () => {
  // Connect and setup before all tests
  beforeAll(async () => {
    console.log("Connecting client for vector test...");
    client = new Client(connectionOptions);
    try {
      await client.connect();
      console.log("Client connected for vector test.");

      console.log("Creating extension and table for vector test...");
      await client.query("CREATE EXTENSION IF NOT EXISTS vector;");
      await client.query("DROP TABLE IF EXISTS movies;");
      await client.query(
        "CREATE TABLE movies (id serial PRIMARY KEY, title TEXT, year INT, embedding vector(3));"
      );
      console.log("Extension and table created for vector test.");

      console.log("Inserting data for vector test...");
      await client.query(`
        INSERT INTO movies (title, year, embedding) VALUES
        ('Napoleon', 2023, '[1,2,3]'),
        ('Black Hawk Down', 2001, '[10,11,12]'),
        ('Gladiator', 2000, '[7,8,9]'),
        ('Blade Runner', 1982, '[4,5,6]');
      `);
      console.log("Data inserted for vector test.");

      console.log("Creating index for vector test...");
      await client.query(
        "CREATE INDEX ON movies USING ivfflat (embedding vector_l2_ops) WITH (lists = 10);"
      );
      console.log("Index created for vector test.");
      await new Promise((resolve) => setTimeout(resolve, 500)); // Allow time for index
    } catch (err) {
      console.error("Failed to connect or setup for vector test:", err);
      if (client) await client.end();
      throw err;
    }
  });

  // Disconnect after all tests
  afterAll(async () => {
    if (client) {
      console.log("Disconnecting client for vector test...");
      await client.end();
      console.log("Client disconnected for vector test.");
    }
  });

  test("should perform vector similarity search", async () => {
    console.log("Performing vector search...");
    const targetVector = "[4,5,6]"; // Embedding for 'Blade Runner'
    const k = 3;
    const result = await client.query(
      "SELECT title, year FROM movies ORDER BY embedding <-> $1 LIMIT $2",
      [targetVector, k]
    );
    console.log("Vector search complete.");

    const expectedTitles = ["Blade Runner", "Gladiator", "Napoleon"];
    const actualTitles = result.rows.map((row) => row.title);

    console.log("Target Vector:", targetVector);
    console.log("Expected Titles (Nearest 3):", expectedTitles);
    console.log("Actual Titles:", actualTitles);

    // Use Bun's expect for array comparison
    expect(actualTitles.sort()).toEqual(expectedTitles.sort());
  });
});
