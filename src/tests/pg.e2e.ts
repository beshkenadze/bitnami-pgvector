import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import pg from "pg";

const { Client } = pg;

// Shared client for all tests in this file
let pgclient: pg.Client;

// Connection details from environment variables
const connectionOptions: pg.ConnectionConfig = {
  host: process.env.PGHOST || "localhost",
  port: Number.parseInt(process.env.PGPORT || "5432"),
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "password", // Use a default/fallback
  database: process.env.PGDATABASE || "postgres",
  connectionTimeoutMillis: 10000, // Add a timeout
};

describe("Basic PostgreSQL Operations", () => {
  // Connect before all tests
  beforeAll(async () => {
    console.log("Connecting client for pgtest...");
    pgclient = new Client(connectionOptions);
    try {
      await pgclient.connect();
      console.log("Client connected for pgtest.");
      // Reset table if it exists from a previous failed run
      await pgclient.query("DROP TABLE IF EXISTS student;");
      console.log("Dropped existing student table (if any).");
    } catch (err) {
      console.error("Failed to connect or setup client for pgtest:", err);
      throw err; // Fail fast if connection fails
    }
  });

  // Disconnect after all tests
  afterAll(async () => {
    if (pgclient) {
      console.log("Disconnecting client for pgtest...");
      await pgclient.end();
      console.log("Client disconnected for pgtest.");
    }
  });

  test("should create the student table", async () => {
    const createTableQuery = `
      CREATE TABLE student(
        id SERIAL PRIMARY KEY,
        firstName VARCHAR(40) NOT NULL,
        lastName VARCHAR(40) NOT NULL,
        age INT,
        address VARCHAR(80),
        email VARCHAR(40)
      );
    `;
    await expect(pgclient.query(createTableQuery)).resolves.toBeDefined();
    console.log("Student table created successfully.");
  });

  test("should insert a student record", async () => {
    const insertQuery =
      "INSERT INTO student(firstName, lastName, age, address, email) VALUES($1, $2, $3, $4, $5) RETURNING *";
    const values = [
      "Mona the",
      "Octocat",
      9,
      "88 Colin P Kelly Jr St, San Francisco, CA 94107, United States",
      "octocat@github.com",
    ];
    const res = await pgclient.query(insertQuery, values);
    expect(res.rowCount).toBe(1);
    expect(res.rows[0].firstname).toBe("Mona the");
    expect(res.rows[0].lastname).toBe("Octocat");
    console.log("Student record inserted successfully:", res.rows[0]);
  });

  test("should retrieve the inserted student record", async () => {
    const selectQuery = "SELECT * FROM student WHERE email = $1";
    const values = ["octocat@github.com"];
    const res = await pgclient.query(selectQuery, values);
    expect(res.rowCount).toBe(1);
    expect(res.rows[0].firstname).toBe("Mona the");
    expect(res.rows[0].age).toBe(9);
    console.log("Student record retrieved successfully:", res.rows[0]);
  });
});
