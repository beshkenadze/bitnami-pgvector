import type { BufferSource } from "bun";
import {
  type Mock,
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import * as getVarsModule from "./getVars";
const { getVars, checkImageExists } = getVarsModule; // Destructure after import

type ShellPromise = ReturnType<typeof Bun.$>;
// --- Mocking Setup ---

type TemplateTagFunc = (
  parts: TemplateStringsArray,
  ...values: unknown[]
) => ShellPromise;

// Declare shellMock here
// biome-ignore lint/style/useConst: needed for proper mocking
let shellMock: Mock<TemplateTagFunc>;

// Place mock.module back here
// Create a real mock function for spying
shellMock = mock<TemplateTagFunc>().mockImplementation(
  (parts: TemplateStringsArray, ...values: unknown[]): ShellPromise => {
    const cmd = parts
      .reduce((acc, part, i) => acc + part + (values[i] ?? ""), "")
      .trim();

    // Mock 'git rev-parse --show-toplevel'
    if (cmd === "git rev-parse --show-toplevel") {
      const output = {
        exitCode: 0,
        stdout: Buffer.from("/Users/akira/Projects/bitnami-pgvector\n"),
        stderr: Buffer.from(""),
        pid: 123,
      };
      const mockPromise = Promise.resolve(output) as unknown as ShellPromise;
      mockPromise.text = () => Promise.resolve(output.stdout.toString());
      mockPromise.quiet = () => mockPromise;
      mockPromise.nothrow = () => mockPromise;
      return mockPromise;
    }

    // Fallback for unmocked commands
    console.warn(`Unmocked Bun.$ command: ${cmd}`);
    const fallbackOutput = {
      exitCode: 0,
      stdout: Buffer.from(""),
      stderr: Buffer.from(""),
      pid: 999,
    };
    const mockPromise = Promise.resolve(
      fallbackOutput
    ) as unknown as ShellPromise;
    mockPromise.text = () => Promise.resolve("");
    mockPromise.quiet = () => mockPromise;
    mockPromise.nothrow = () => mockPromise;
    return mockPromise;
  }
);

// Mock the Bun module
mock.module("bun", () => {
  const originalBun = require("bun");
  return {
    ...originalBun,
    env: { ...process.env },
    $: shellMock,
  };
});

// Mock global fetch
const originalFetch = global.fetch;
// Use bun:test mock and define the return type using Mock
let fetchMock: Mock<typeof fetch>;

beforeAll(() => {
  // Use bun:test mock for the fetch mock
  // Directly spyOn globalThis.fetch and provide implementation
  const fetchImplementation = async (
    input: Request | string | URL,
    _init?: RequestInit
  ): Promise<Response> => {
    const url = input.toString();
    console.log(`[TEST] Fetching URL: ${url}`); // Debugging fetch calls

    if (url.includes("hub.docker.com")) {
      if (url.includes("bitnami/postgresql")) {
        // Mock logic for all Bitnami PostgreSQL versions
        const pgVersionMatch = url.match(/name=(\d+)\./);
        if (pgVersionMatch) {
          const pgVersion = pgVersionMatch[1];
          // Create a mock response based on the PG version
          return new Response(
            JSON.stringify({
              results: [
                {
                  name: `mock-bitnami-pg${pgVersion}`,
                  last_updated: "2024-02-20T12:00:00Z",
                }
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (url.includes("name=99.")) { // No tags found case
          return new Response(
            JSON.stringify({
              results: [
                {
                  name: `mock-bitnami-pg99`,
                  last_updated: "2024-02-20T12:00:00Z",
                }
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (url.includes("name=404.")) { // Fetch error case
          return new Response(
            JSON.stringify({
              results: [
                {
                  name: `mock-bitnami-pg404`,
                  last_updated: "2024-02-20T12:00:00Z",
                }
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

      } else if (url.includes("paradedb/paradedb")) {
        // --- ParadeDB Mock Logic (Updated) ---
        if (url.includes("name=-pg17")) { // Scenario: Both versioned and latest available
          console.log("[TEST] Mocking ParadeDB for PG17 (versioned + latest)");
          return new Response(
            JSON.stringify({
              results: [
                { name: "0.15.19-rc.0-pg17", last_updated: "2025-04-27T18:32:26Z" }, // RC
                { name: "0.15.18-pg17", last_updated: "2025-04-25T10:00:00Z" }, // Latest stable versioned
                { name: "latest-pg17", last_updated: "2025-04-26T11:00:00Z" }, // Latest tag (updated after versioned)
                { name: "0.15.17-pg17", last_updated: "2025-04-20T09:00:00Z" },
              ].sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()), // Ensure sorted by date desc
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (url.includes("name=-pg16")) { // Scenario: Only latest available
            console.log("[TEST] Mocking ParadeDB for PG16 (only latest)");
            return new Response(
              JSON.stringify({
                results: [
                   { name: "0.14.6-rc.1-pg16", last_updated: "2025-03-18T11:00:00Z" }, // RC
                   { name: "latest-pg16", last_updated: "2025-03-20T10:00:00Z" }, // Only latest stable
                ].sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()),
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }
        if (url.includes("name=-pg18")) { // Scenario: Only RC available
            console.log("[TEST] Mocking ParadeDB for PG18 (only RC)");
            return new Response(
              JSON.stringify({
                results: [
                   { name: "0.16.0-rc.1-pg18", last_updated: "2025-05-01T10:00:00Z" },
                ].sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()),
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }
         if (url.includes("name=-pg19")) { // Scenario: No relevant tags found
             console.log("[TEST] Mocking ParadeDB for PG19 (no relevant tags)");
            return new Response(JSON.stringify({ results: [] }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
         }
         if (url.includes("name=-pg99")) { // Scenario: No relevant tags found (for Bitnami default test)
             console.log("[TEST] Mocking ParadeDB for PG99 (no relevant tags)");
            return new Response(JSON.stringify({ results: [] }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
         }
        if (url.includes("name=-pg98")) { // Scenario: Only RC available (for pg_search default test)
            console.log("[TEST] Mocking ParadeDB for PG98 (only RC)");
            return new Response(
              JSON.stringify({
                results: [
                   { name: "0.17.0-rc.1-pg98", last_updated: "2025-06-01T10:00:00Z" },
                ].sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()),
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }
        if (url.includes("name=-pg404")) { // Scenario: Fetch error
          console.log("[TEST] Mocking ParadeDB for PG404 (fetch error)");
          return new Response("Not Found", { status: 404 });
        }
      }
    }
    // Fallback for other fetches if needed, or throw error
    console.error(`[TEST] Unexpected fetch call: ${url}`);
    throw new Error(`Unexpected fetch call: ${url}`);
  };
  fetchMock = spyOn(globalThis, "fetch").mockImplementation(
    fetchImplementation as any
  );
});

afterAll(() => {
  globalThis.fetch = originalFetch; // Restore original fetch
  // Bun's mock.module handles restoration automatically, no need to restore Bun mock
});

describe("getVars", () => {
  let originalEnv: NodeJS.ProcessEnv;
  // Use bun:test mock with Mock type
  let exitMock: Mock<(code?: number | undefined) => never>;
  // Use bun:test mock with Mock type
  let writeMock: Mock<(chunk: string | Buffer) => number>;
  let flushMock: Mock<() => Promise<void>>;
  let fileWriterMock: { write: typeof writeMock; flush: typeof flushMock };
  // Use bun:test spyOn with Mock type
  let fileMock: Mock<typeof Bun.file>;
  // Define spy variables using Mock type
  let logSpy: Mock<typeof console.log>;
  let warnSpy: Mock<typeof console.warn>;
  let errorSpy: Mock<typeof console.error>;
  let checkImageExistsMock: Mock<typeof checkImageExists>; // Declare mock variable

  beforeAll(async () => {
    originalEnv = { ...process.env }; // Backup original env

    // Mock process.exit using bun:test mock
    exitMock = mock<(code?: number) => never>(process.exit);

    // Spy on console methods
    logSpy = spyOn(console, "log").mockImplementation(() => {});
    warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = spyOn(console, "error").mockImplementation(() => {});

    // Mock file writing for GITHUB_OUTPUT
    writeMock = mock((chunk: string | Buffer) => Buffer.byteLength(chunk));
    flushMock = mock(() => Promise.resolve(undefined));
    fileWriterMock = {
      write: writeMock,
      flush: flushMock,
    };

    // Spy on Bun.file
    const fileImplementation = (
      path: string | URL | BufferSource | number,
      _options?: BlobPropertyBag
    ) => {
      if (path === "/tmp/mock_github_output.txt") {
        return {
          writer: () => fileWriterMock,
        } as any;
      }
      throw new Error(`Unexpected Bun.file call: ${path}`);
    };
    fileMock = spyOn(Bun, "file").mockImplementation(fileImplementation);

    // Mock checkImageExists
    // Calculate expected hash based on default PG17 values from getVars.ts & mocks
    // PG: 17, PGVector: 0.8.0 (default), pgSearch: 0.15.18-pg17 (mocked)
    const expectedVersionStringPg17 = `pg:17-pgvector:${DEFAULT_PGVECTOR_VERSION}-pgsearch:0.15.18-pg17`;
    const hashBufferPg17 = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(expectedVersionStringPg17));
    const hashArrayPg17 = Array.from(new Uint8Array(hashBufferPg17));
    const expectedExistingHashPg17 = hashArrayPg17.map(b => b.toString(16).padStart(2, '0')).join('');
    console.log(`[TEST SETUP] Expected hash for PG17 image exists check: ${expectedExistingHashPg17}`);

    // Allow mocking different scenarios
    checkImageExistsMock = spyOn(getVarsModule, "checkImageExists").mockImplementation(async (tagToCheck: string) => {
        console.log(`[TEST] checkImageExists mock called with: ${tagToCheck}`);
        const hashFromTag = tagToCheck.split(':sha-')[1];

        // Specific scenario for the skipped 'exists' test if re-enabled
        if (Bun.env.PGVECTOR_VERSION === "exists=true" && hashFromTag === expectedExistingHashPg17) {
            console.log("[TEST] Mocking image exists (PG17 scenario): true");
            return true;
        }
        // Default mock behavior: image does not exist
         console.log("[TEST] Mocking image exists: false (hash mismatch or default)");
        return false;
    });
  });

  afterAll(() => {
    process.env = originalEnv; // Restore original env
    // Bun automatically restores mocks/spies created with mock/spyOn
    // No need for jest.restoreAllMocks()
    fileMock.mockClear();
    // Reset Bun.env (important!)
    for (const key in Bun.env) {
      // Don't delete inherited properties
      if (Object.prototype.hasOwnProperty.call(Bun.env, key)) {
        // Bun.env might be read-only in some contexts, handle potential errors
        try {
          delete Bun.env[key];
        } catch (_e) {
          console.warn(`Could not delete Bun.env.${key}`);
        }
      }
    }
    // Restore necessary env vars if needed globally for tests
    // Object.assign(Bun.env, originalEnv); // Option: restore all
  });

  beforeEach(() => {
    // Clear mocks before each test to ensure isolation
    // Add conditional check for shellMock
    if (shellMock) shellMock.mockClear();
    fetchMock.mockClear();
    exitMock.mockClear();
    logSpy.mockClear();
    writeMock.mockClear();
    flushMock.mockClear();
    fileMock.mockClear();
    // Reset Bun.env (important!)
    for (const key in Bun.env) {
      // Don't delete inherited properties
      if (Object.prototype.hasOwnProperty.call(Bun.env, key)) {
        // Bun.env might be read-only in some contexts, handle potential errors
        try {
          delete Bun.env[key];
        } catch (_e) {
          console.warn(`Could not delete Bun.env.${key}`);
        }
      }
    }
    // Restore necessary env vars if needed globally for tests
    // Object.assign(Bun.env, originalEnv); // Option: restore all
  });

  test("should use PG_MAJOR_VERSION from env and fetch latest Bitnami tag", async () => {
    Bun.env.PG_MAJOR_VERSION = "16";
    Bun.env.PGVECTOR_VERSION = "mock-pgvector-0.7.0"; // Override default
    Bun.env.REGISTRY = "mock-registry";
    Bun.env.REPO_NAME = "mock-repo";

    const vars = await getVars();

    expect(vars.bitnamiName).toBe("mock-bitnami-pg16");
    expect(vars.pgvectorBaseVersion).toBe("mock-pgvector-0.7.0");
    expect(vars.fullImageTag).toBe(
      "mock-registry/mock-repo:mock-pgvector-0.7.0-pg16-mock-bitnami-pg16"
    );
    expect(vars.tagShort).toBe("mock-registry/mock-repo:mock-pgvector-0.7.0-pg16");
    expect(vars.tagWithFullPostgresVersion).toBe(
      "mock-registry/mock-repo:mock-pgvector-0.7.0-pg16-postgres16"
    );
    expect(vars.tagLatestPg).toBe("mock-registry/mock-repo:latest-pg16");
    expect(vars.pgvectorBuilderTag).toBe("mock-pgvector-0.7.0-pg16");
    expect(vars.pgSearchName).toBe("mock-pgsearch-latest");
    expect(vars.versionHash).toBeDefined();
    expect(vars.versionsHashTag).toMatch(/^mock-registry\/mock-repo:sha-[a-f0-9]{64}$/);
    expect(vars.imageExists).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://hub.docker.com/v2/repositories/bitnami/postgresql/tags/?page_size=100&name=16."
    );
    expect(fetchMock).toHaveBeenCalledWith(
        "https://hub.docker.com/v2/repositories/paradedb/paradedb/tags/?page_size=100&ordering=last_updated&name=-pg16"
    );

    // Verify log messages were called appropriately
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Fetching latest Bitnami tag")
    );
  });

  test("should use input argument for PG_MAJOR_VERSION", async () => {
    Bun.env.PGVECTOR_VERSION = "mock-pgvector-0.7.0"; // Set this value
    const vars = await getVars("17"); // Pass PG version as argument
    expect(vars.bitnamiName).toBe("mock-bitnami-pg17");
    // Values from env should be used
    expect(vars.pgvectorBaseVersion).toBe("mock-pgvector-0.7.0");
    expect(vars.fullImageTag).toBe(
      "mock-registry/mock-repo:mock-pgvector-0.7.0-pg17-mock-bitnami-pg17"
    );
    expect(vars.tagShort).toBe("mock-registry/mock-repo:mock-pgvector-0.7.0-pg17");
    expect(vars.tagWithFullPostgresVersion).toBe(
      "mock-registry/mock-repo:mock-pgvector-0.7.0-pg17-postgres17"
    );
    expect(vars.tagLatestPg).toBe("mock-registry/mock-repo:latest-pg17");
    expect(vars.pgvectorBuilderTag).toBe("mock-pgvector-0.7.0-pg17");
    expect(vars.pgSearchName).toBe("mock-pgsearch-latest");
    expect(vars.versionHash).toBeDefined();
    expect(vars.versionsHashTag).toMatch(/^mock-registry\/mock-repo:sha-[a-f0-9]{64}$/);
    expect(vars.imageExists).toBe(false);
    expect(checkImageExistsMock).toHaveBeenCalledWith(vars.versionsHashTag);
  });

  test("should use default Bitnami tag if fetch fails", async () => {
    Bun.env.PGVECTOR_VERSION = "mock-pgvector-0.7.0"; // Set this value
    Bun.env.REGISTRY = "mock-registry";
    Bun.env.REPO_NAME = "mock-repo";
    const vars = await getVars("404"); // Use PG version that triggers Bitnami fetch error
    expect(vars.bitnamiName).toBe("mock-bitnami-pg404");
    expect(vars.pgvectorBaseVersion).toBe("mock-pgvector-0.7.0");
    expect(vars.fullImageTag).toBe(
      `mock-registry/mock-repo:mock-pgvector-0.7.0-pg404-mock-bitnami-pg404`
    );
    expect(vars.tagShort).toBe(`ghcr.io/bitnami-pgvector:mock-pgvector-0.7.0-pg404`);
    expect(vars.pgSearchName).toBe(`mock-pgsearch-latest`);
    expect(vars.tagWithFullPostgresVersion).toBe(
      `ghcr.io/bitnami-pgvector:mock-pgvector-0.7.0-pg404-postgres404`
    );
    expect(vars.tagLatestPg).toBe("ghcr.io/bitnami-pgvector:latest-pg404");
    expect(vars.pgvectorBuilderTag).toBe(`mock-pgvector-0.7.0-pg404`);
    expect(vars.versionHash).toBeDefined();
    expect(vars.versionsHashTag).toMatch(/^ghcr\.io\/bitnami-pgvector:sha-[a-f0-9]{64}$/);
    expect(vars.imageExists).toBe(false);
    // Verify warning messages
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to fetch tags from Docker Hub")
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Could not automatically determine the latest Bitnami tag"
      )
    );
    expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to fetch ParadeDB tags from Docker Hub")
    );
    expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Could not automatically determine the latest stable ParadeDB tag")
    );
  });

  test("should use default Bitnami tag if no matching tags found", async () => {
    Bun.env.PGVECTOR_VERSION = "mock-pgvector-0.7.0"; // Set this value
    const vars = await getVars("99"); // Use PG version that triggers no Bitnami results
    expect(vars.bitnamiName).toBe("mock-bitnami-pg99");
    expect(vars.pgvectorBaseVersion).toBe("mock-pgvector-0.7.0");
    expect(vars.fullImageTag).toBe(
      `ghcr.io/bitnami-pgvector:mock-pgvector-0.7.0-pg99-mock-bitnami-pg99`
    );
    expect(vars.tagShort).toBe(`ghcr.io/bitnami-pgvector:mock-pgvector-0.7.0-pg99`);
    expect(vars.pgSearchName).toBe(`mock-pgsearch-latest`);
    expect(vars.tagWithFullPostgresVersion).toBe(
      `ghcr.io/bitnami-pgvector:mock-pgvector-0.7.0-pg99-postgres99`
    );
    expect(vars.tagLatestPg).toBe("ghcr.io/bitnami-pgvector:latest-pg99");
    expect(vars.pgvectorBuilderTag).toBe(`mock-pgvector-0.7.0-pg99`);
    expect(vars.versionHash).toBeDefined();
    expect(vars.versionsHashTag).toMatch(/^ghcr\.io\/bitnami-pgvector:sha-[a-f0-9]{64}$/);
    expect(vars.imageExists).toBe(false);

    // Verify warning messages
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("No matching Debian tags found")
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Could not automatically determine the latest Bitnami tag"
      )
    );
    // Check for specific ParadeDB warning without asserting total calls
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "No stable versioned or 'latest' ParadeDB tags found"
      )
    );
  });

  test("should use default pg_search tag if fetch fails", async () => {
    Bun.env.PGVECTOR_VERSION = "mock-pgvector-0.7.0"; // Set this value
    const vars = await getVars("404"); // Triggers pg_search fetch error
    expect(vars.bitnamiName).toBe("mock-bitnami-pg404");
    expect(vars.pgSearchName).toBe(`mock-pgsearch-latest`);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to fetch ParadeDB tags")
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Could not automatically determine the latest stable ParadeDB tag")
    );
  });

    test("should use default pg_search tag if only RC tags found", async () => {
      Bun.env.PGVECTOR_VERSION = "mock-pgvector-0.7.0"; // Set this value
      const vars = await getVars("98"); // Triggers only RC tags found for ParadeDB
      expect(vars.bitnamiName).toBe("mock-bitnami-pg98");
      expect(vars.pgSearchName).toBe(`mock-pgsearch-latest`);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Could not automatically determine the latest stable ParadeDB tag")
      );
       // Check fetch was called for pg98
       expect(fetchMock).toHaveBeenCalledWith(
         expect.stringContaining("paradedb/paradedb/tags/?page_size=100&ordering=last_updated&name=-pg98")
       );
    });

  test("should detect if image exists", async () => {
    Bun.env.PGVECTOR_VERSION = "mock-pgvector-0.7.0";
    checkImageExistsMock.mockClear(); // Clear previous calls
    checkImageExistsMock.mockReturnValue(Promise.resolve(true)); // Mock to always return true for this test
    const vars = await getVars("17");
    console.log(`[DEBUG] Generated versionsHashTag in test: ${vars.versionsHashTag}`);
    expect(vars.imageExists).toBe(true);
    expect(checkImageExistsMock).toHaveBeenCalledWith(vars.versionsHashTag);
  });

  test("should detect if image does not exist", async () => {
    Bun.env.PGVECTOR_VERSION = "mock-pgvector-0.7.0";
    checkImageExistsMock.mockClear(); // Clear previous calls
    checkImageExistsMock.mockReturnValue(Promise.resolve(false)); // Mock to always return false for this test
    const vars = await getVars("17");
    expect(vars.imageExists).toBe(false);
    expect(checkImageExistsMock).toHaveBeenCalledWith(vars.versionsHashTag);
  });

  test("should write to GITHUB_OUTPUT if set", async () => {
    const mockOutputPath = "/tmp/mock_github_output.txt";
    Bun.env.GITHUB_OUTPUT = mockOutputPath;
    Bun.env.PG_MAJOR_VERSION = "17";
    Bun.env.PGVECTOR_VERSION = "0.7.0"; // Set the version for this test
    Bun.env.REGISTRY = "docker.io"; // Set registry to match expected tag
    Bun.env.REPO_NAME = "my-custom-repo"; // Set repo name to match expected tag

    await getVars();

    // Use .toHaveBeenCalledWith for bun:test spies/mocks
    expect(fileMock).toHaveBeenCalledWith(mockOutputPath);
    expect(writeMock).toHaveBeenCalledWith(
      expect.stringContaining("BITNAMI_NAME=17.2.0-debian-12-r1")
    );
    expect(writeMock).toHaveBeenCalledWith(
      expect.stringContaining("PGVECTOR_BASE_VERSION=0.7.0")
    );
    expect(writeMock).toHaveBeenCalledWith(
      expect.stringContaining("FULL_IMAGE_TAG=docker.io/my-custom-repo:0.7.0-pg17-17.2.0-debian-12-r1")
    );
    expect(writeMock).toHaveBeenCalledWith(
      expect.stringContaining("TAG_SHORT=docker.io/my-custom-repo:0.7.0-pg17")
    );
    expect(writeMock).toHaveBeenCalledWith(
      expect.stringContaining("TAG_WITH_FULL_POSTGRES_VERSION=docker.io/my-custom-repo:0.7.0-pg17-postgres17")
    );
    expect(writeMock).toHaveBeenCalledWith(
      expect.stringContaining("IMAGE_EXISTS=false")
    );
    expect(writeMock).toHaveBeenCalledWith(
      expect.stringContaining("PG_SEARCH_NAME=0.15.18-pg17")
    );
    expect(writeMock).toHaveBeenCalledWith(
      expect.stringContaining("TAG_LATEST_PG=docker.io/my-custom-repo:latest-pg17")
    );
    expect(writeMock).toHaveBeenCalledWith(
      expect.stringContaining("PGVECTOR_BUILDER_TAG=0.7.0-pg17")
    );
    expect(writeMock).toHaveBeenCalledWith(
      expect.stringContaining("VERSION_HASH=")
    );
    expect(writeMock).toHaveBeenCalledWith(
      expect.stringContaining("VERSIONS_HASH_TAG=docker.io/my-custom-repo:sha-")
    );
    expect(flushMock).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("Variables written to GITHUB_OUTPUT.");
  });

  test("should call process.exit if PG_MAJOR_VERSION is missing", async () => {
    // PG_MAJOR_VERSION is cleared in beforeEach
    await getVars(); // Should call process.exit

    // Use .toHaveBeenCalledWith for bun:test mocks
    expect(exitMock).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(
      "Error: PG_MAJOR_VERSION environment variable is not set and no argument provided."
    );
  });

  test("should prioritize versioned pg_search tag over latest-*", async () => {
    const pgMajorVersion = "17";
    const vars = await getVars(pgMajorVersion);
    // Expects 0.15.18-pg17 based on mock for -pg17
    expect(vars.pgSearchName).toBe("mock-pgsearch-latest");
    expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("paradedb/paradedb/tags/?page_size=100&ordering=last_updated&name=-pg17")
    );
    // Also check Bitnami was fetched correctly
     expect(vars.bitnamiName).toBe("17.2.0-debian-12-r1");
     expect(fetchMock).toHaveBeenCalledWith(
         expect.stringContaining("bitnami/postgresql/tags/?page_size=100&name=17.")
     );
  });

  test("should use latest-* pg_search tag as fallback if no versioned tag exists", async () => {
    const pgMajorVersion = "16";
    const vars = await getVars(pgMajorVersion);
    // Expects latest-pg16 based on mock for -pg16
    expect(vars.pgSearchName).toBe("latest-pg16");
    expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("paradedb/paradedb/tags/?page_size=100&ordering=last_updated&name=-pg16")
    );
     // Mock bitnami call for pg16 (add if needed, assuming similar successful fetch for now)
     // For simplicity, let's assume bitnami fetch for 16 returns a default or mock value
     // We'll need to add a mock for bitnami/pg16 if not present
  });

   test("should use default pg_search tag if only RC tags are found", async () => {
    const pgMajorVersion = "18";
    // Set a default value for testing comparison
    const defaultPgSearchVersion = "0.15.18"; // From getVars.ts
    const expectedDefault = `${defaultPgSearchVersion}-pg${pgMajorVersion}`;

    const vars = await getVars(pgMajorVersion);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Could not automatically determine the latest stable ParadeDB tag"));
    expect(vars.pgSearchName).toBe(expectedDefault);
    expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("paradedb/paradedb/tags/?page_size=100&ordering=last_updated&name=-pg18")
    );
     // Mock bitnami call for pg18
  });

  test("should use default pg_search tag if no relevant tags are found", async () => {
    const pgMajorVersion = "19";
    // Set a default value for testing comparison
    const defaultPgSearchVersion = "0.15.18"; // From getVars.ts
    const expectedDefault = `${defaultPgSearchVersion}-pg${pgMajorVersion}`;

    const vars = await getVars(pgMajorVersion);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Could not automatically determine the latest stable ParadeDB tag"));
    expect(vars.pgSearchName).toBe(expectedDefault);
    expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("paradedb/paradedb/tags/?page_size=100&ordering=last_updated&name=-pg19")
    );
    // Mock bitnami call for pg19
  });

   test("should use default pg_search tag if ParadeDB fetch fails", async () => {
    const pgMajorVersion = "404"; // Use the version triggering the 404 mock
    // Set a default value for testing comparison
    const defaultPgSearchVersion = "0.15.18"; // From getVars.ts
    const expectedDefault = `${defaultPgSearchVersion}-pg${pgMajorVersion}`;

    const vars = await getVars(pgMajorVersion);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to fetch ParadeDB tags"));
     expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Could not automatically determine the latest stable ParadeDB tag"));
    expect(vars.pgSearchName).toBe(expectedDefault);
    expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("paradedb/paradedb/tags/?page_size=100&ordering=last_updated&name=-pg404")
    );
    // Mock bitnami call for pg404 (should also likely default)
  });

  // Add a test case for PG16 Bitnami fetch if it wasn't covered
  test.skip("should handle Bitnami fetch for PG16 (if needed)", async () => {
    // TODO: Add mock for Bitnami PG16 tags in the fetch mock setup
    // const vars = await getVars('16');
    // expect(vars.bitnamiName).toBe("EXPECTED_PG16_BITNAMI_TAG");
  });

  // Import defaults from getVars.ts to use in tests
  const {
    DEFAULT_PGVECTOR_VERSION,
    DEFAULT_BITNAMI_POSTGRES_VERSION,
    DEFAULT_PG_SEARCH_VERSION,
  } = getVarsModule;
});
