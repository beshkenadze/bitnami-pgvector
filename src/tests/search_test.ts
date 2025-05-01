import assert from "node:assert";
import pg from "pg";

const { Client } = pg;

interface ConnectionOptions extends pg.ConnectionConfig {
  connectionTimeoutMillis?: number;
}

// Connection retry logic (copied from vector_test.ts for standalone execution)
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

async function runSearchTest(): Promise<void> {
  console.log("Test environment variables for pg_search:");
  console.log(`PGHOST: ${process.env.PGHOST || "localhost"}`);
  console.log(`PGPORT: ${process.env.PGPORT || 5432}`);
  console.log(`PGUSER: ${process.env.PGUSER || "postgres"}`);
  console.log(`PGDATABASE: ${process.env.PGDATABASE || "postgres"}`);
  console.log(`Password is ${process.env.PGPASSWORD ? "set" : "not set"}`);

  const connectionOptions: ConnectionOptions = {
    host: process.env.PGHOST || "localhost",
    port: Number.parseInt(process.env.PGPORT || "5432"),
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "password",
    database: process.env.PGDATABASE || "postgres",
    connectionTimeoutMillis: 10000,
  };

  let client: pg.Client | undefined;
  try {
    console.log("Connecting to database for pg_search test...");
    client = await connectWithRetry(connectionOptions);

    console.log("Creating pg_search extension and test table...");
    // pg_search requires Postgres 14+ on Neon, ensure compatibility
    // Using IF NOT EXISTS for robustness
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
    // Index relevant text fields for searching
    // Using name as the key_field for potential JOINs later, although not used in this basic test
    await client.query(`
      CREATE INDEX products_bm25_idx ON products
      USING bm25 (id, name, description, category)
      WITH (key_field='id');
    `);
    console.log("BM25 index created.");

    // Allow some time for index build, though likely fast here
    await new Promise((resolve) => setTimeout(resolve, 500));

    console.log("Performing pg_search full-text search...");
    // Search for products related to 'ergonomic'
    const searchTerm = "ergonomic";
    const result = await client.query(
      "SELECT id, name, description FROM products WHERE description @@@ $1 ORDER BY id", // Order by ID for deterministic results
      [searchTerm]
    );
    console.log("Search complete.");

    console.log("Verifying search results...");
    const expectedNames = ["Wireless Mouse", "Office Chair"];
    const actualNames = result.rows.map((row) => row.name);

    console.log("Search Term:", searchTerm);
    console.log("Expected Names:", expectedNames);
    console.log("Actual Names:", actualNames);

    assert.deepStrictEqual(
      actualNames.sort(),
      expectedNames.sort(),
      "pg_search results do not match expected names for 'ergonomic'."
    );

    // Test another search
    console.log("Performing another search for 'monitor'...");
    const searchTerm2 = "monitor";
    const result2 = await client.query(
        "SELECT id, name FROM products WHERE description @@@ $1 OR name @@@ $1 ORDER BY id",
        [searchTerm2]
    );
    console.log("Second search complete.");

    const expectedNames2 = ["Gaming Monitor"];
    const actualNames2 = result2.rows.map(row => row.name);

    console.log("Search Term:", searchTerm2);
    console.log("Expected Names:", expectedNames2);
    console.log("Actual Names:", actualNames2);

    assert.deepStrictEqual(
        actualNames2.sort(),
        expectedNames2.sort(),
        "pg_search results do not match expected names for 'monitor'."
    );


    console.log("pg_search tests passed successfully!");
  } catch (err) {
    console.error("pg_search test failed:", err);
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
      console.log("Database connection closed.");
    }
  }
}

// Allow running the test directly
if (import.meta.main) {
    runSearchTest();
}

export { runSearchTest };
