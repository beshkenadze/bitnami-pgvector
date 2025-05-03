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

describe("pg_search Functionality", () => {
  // Connect and setup before all tests
  beforeAll(async () => {
    console.log("Connecting client for pg_search test...");
    client = new Client(connectionOptions);
    try {
      await client.connect();
      console.log("Client connected for pg_search test.");

      console.log("Creating pg_search extension and test table...");
      await client.query("CREATE EXTENSION IF NOT EXISTS pg_search;");
      await client.query("DROP TABLE IF EXISTS products;");
      await client.query(`
        CREATE TABLE products (
          id serial PRIMARY KEY,
          name TEXT,
          description TEXT,
          category TEXT
        );
      `);
      console.log("pg_search extension and table created.");

      console.log("Inserting data for pg_search test...");
      await client.query(`
        INSERT INTO products (name, description, category) VALUES
        ('Laptop Pro', 'High performance laptop for professionals', 'Electronics'),
        ('Wireless Mouse', 'Ergonomic wireless mouse with long battery life', 'Accessories'),
        ('Mechanical Keyboard', 'RGB Mechanical Keyboard with blue switches', 'Accessories'),
        ('Gaming Monitor', '27 inch high refresh rate gaming monitor', 'Electronics'),
        ('Office Chair', 'Ergonomic office chair for long working hours', 'Furniture');
      `);
      console.log("Data inserted.");

      console.log("Creating BM25 index...");
      await client.query(`
        CREATE INDEX products_bm25_idx ON products
        USING bm25 (id, name, description, category)
        WITH (key_field='id');
      `);
      console.log("BM25 index created.");
      // Allow some time for index build if necessary
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      console.error("Failed to connect or setup for pg_search test:", err);
      // Ensure client is cleaned up even if setup fails partially
      if (client) await client.end();
      throw err; // Fail fast
    }
  });

  // Disconnect after all tests
  afterAll(async () => {
    if (client) {
      console.log("Disconnecting client for pg_search test...");
      await client.end();
      console.log("Client disconnected for pg_search test.");
    }
  });

  test("should find 'ergonomic' products with pg_search", async () => {
    console.log("Performing pg_search for 'ergonomic'...");
    const searchTerm = "ergonomic";
    const result = await client.query(
      "SELECT id, name, description FROM products WHERE description @@@ $1 ORDER BY id",
      [searchTerm]
    );
    console.log("Search for 'ergonomic' complete.");

    const expectedNames = ["Wireless Mouse", "Office Chair"];
    const actualNames = result.rows.map((row) => row.name);

    console.log("Search Term:", searchTerm);
    console.log("Expected Names:", expectedNames);
    console.log("Actual Names:", actualNames);

    // Using Bun's expect for array comparison
    expect(actualNames.sort()).toEqual(expectedNames.sort());
  });

  test("should find 'monitor' products with pg_search", async () => {
    console.log("Performing pg_search for 'monitor'...");
    const searchTerm = "monitor";
    const result = await client.query(
      "SELECT id, name FROM products WHERE description @@@ $1 OR name @@@ $1 ORDER BY id",
      [searchTerm]
    );
    console.log("Search for 'monitor' complete.");

    const expectedNames = ["Gaming Monitor"];
    const actualNames = result.rows.map((row) => row.name);

    console.log("Search Term:", searchTerm);
    console.log("Expected Names:", expectedNames);
    console.log("Actual Names:", actualNames);

    expect(actualNames.sort()).toEqual(expectedNames.sort());
  });
});
