import assert from 'assert';
import pg from 'pg';

const { Client } = pg;

// Connection retry logic
async function connectWithRetry(connectionOptions, maxRetries = 5, retryInterval = 3000) {
  let retries = 0;
  
  while (retries < maxRetries) {
    const client = new pg.Client(connectionOptions);
    
    try {
      console.log(`Connection attempt ${retries + 1}/${maxRetries}...`);
      await client.connect();
      console.log("Connected successfully.");
      return client;
    } catch (err) {
      retries++;
      console.log(`Connection failed (${retries}/${maxRetries}): ${err.message}`);
      
      // Always close the client, even if connection failed
      try {
        await client.end();
      } catch (closeErr) {
        // Ignore errors during client closing
      }
      
      if (retries >= maxRetries) {
        console.error("Maximum connection attempts reached!");
        throw err;
      }
      
      console.log(`Waiting ${retryInterval/1000} seconds before retrying...`);
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
  }
  
  throw new Error("Failed to connect after retries");
}

async function runTest() {
  console.log("Test environment variables:");
  console.log(`PGHOST: ${process.env.PGHOST || 'localhost'}`);
  console.log(`PGPORT: ${process.env.PGPORT || 5432}`);
  console.log(`PGUSER: ${process.env.PGUSER || 'postgres'}`);
  console.log(`PGDATABASE: ${process.env.PGDATABASE || 'postgres'}`);
  console.log(`Password is ${process.env.PGPASSWORD ? 'set' : 'not set'}`);

  const connectionOptions = {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432'),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'password',
    database: process.env.PGDATABASE || 'postgres',
    // Add connection timeout
    connectionTimeoutMillis: 10000,
  };

  let client;
  try {
    console.log("Connecting to database with retry...");
    client = await connectWithRetry(connectionOptions);

    console.log("Creating extension and table...");
    // pgvector might already be created by the base image, handle potential error
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    await client.query('DROP TABLE IF EXISTS movies;');
    await client.query('CREATE TABLE movies (id serial PRIMARY KEY, title TEXT, year INT, embedding vector(3));');
    console.log("Extension and table created.");

    console.log("Inserting data...");
    await client.query(`
      INSERT INTO movies (title, year, embedding) VALUES
      ('Napoleon', 2023, '[1,2,3]'),
      ('Black Hawk Down', 2001, '[10,11,12]'),
      ('Gladiator', 2000, '[7,8,9]'),
      ('Blade Runner', 1982, '[4,5,6]');
    `);
    console.log("Data inserted.");

    console.log("Creating index...");
    // Using ivfflat for simplicity and speed on small datasets, though hnsw is also common
    await client.query('CREATE INDEX ON movies USING ivfflat (embedding vector_l2_ops) WITH (lists = 10);');
    console.log("Index created.");

    // Allow some time for index creation if needed, though usually fast for small data
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log("Performing vector search...");
    const targetVector = '[4,5,6]'; // Embedding for 'Blade Runner'
    const k = 3;
    const result = await client.query('SELECT title, year FROM movies ORDER BY embedding <-> $1 LIMIT $2', [targetVector, k]);
    console.log("Search complete.");

    console.log("Verifying results...");
    const expectedTitles = ['Blade Runner', 'Gladiator', 'Napoleon'];
    const actualTitles = result.rows.map(row => row.title);

    console.log("Expected:", expectedTitles);
    console.log("Actual:", actualTitles);

    assert.deepStrictEqual(actualTitles.sort(), expectedTitles.sort(), "Vector search results do not match expected order.");
    console.log("Test passed successfully!");

  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  } finally {
    await client.end();
    console.log("Connection closed.");
  }
}

runTest();