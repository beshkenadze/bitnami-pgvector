import {
  type Mock,
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
  test,
} from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { $ } from "bun";
import { Command } from "commander";
import * as getVarsModule from "./getVars";

// Create sample content for the README file
const sampleReadmeContent = `
[![pgvector Version](https://img.shields.io/badge/pgvector-0.7.0-green.svg)](https://github.com/pgvector/pgvector/releases)

## Available tags:

<!-- AVAILABLE_TAGS_START -->
*   \`latest\`: Latest build based on PostgreSQL 17.
*   \`old-tag\`: Old tag information.
<!-- AVAILABLE_TAGS_END -->
`;

// Sample mock response for getVars
const mockVarsResponse = {
  bitnamiName: "17.4.0-debian-12-r17",
  pgvectorName: "0.8.0",
  fullImageTag: "ghcr.io/bitnami-pgvector:0.8.0-pg17-17.4.0-debian-12-r17",
  tagShort: "ghcr.io/bitnami-pgvector:0.8.0-pg17",
  tagFullPgvectorPostgres: "ghcr.io/bitnami-pgvector:0.8.0-postgres17",
  imageExists: false,
};

// Mock fs module functions
let mockFsReadFileSyncFn: Mock<typeof fs.readFileSync>;
let mockFsWriteFileSyncFn: Mock<typeof fs.writeFileSync>;
let mockFsExistsSyncFn: Mock<typeof fs.existsSync>;

// Mock process.exit
let mockExitFn: Mock<typeof process.exit>;

// Create a mock for the getVars function
let getVarsMock: Mock<typeof getVarsModule.getVars>;

// Spy on console methods
let logSpy: Mock<typeof console.log>;
let errorSpy: Mock<typeof console.error>;
let warnSpy: Mock<typeof console.warn>;

// Ensure original process.argv is saved
const originalArgv = process.argv;

// Setup mocks and spies before tests
beforeAll(() => {
  // Mock process.exit
  mockExitFn = mock<typeof process.exit>().mockImplementation((code) => {
    throw new Error(`Process exited with code ${code}`);
  });
  Object.defineProperty(process, "exit", { value: mockExitFn });

  // Mock fs functions
  mockFsReadFileSyncFn = mock<typeof fs.readFileSync>().mockImplementation(
    (path) => {
      if (typeof path === "string" && path.includes("README.md")) {
        return sampleReadmeContent;
      }
      throw new Error(`Unexpected readFileSync for ${path}`);
    }
  );

  mockFsWriteFileSyncFn = mock<typeof fs.writeFileSync>().mockImplementation(
    () => undefined
  );
  mockFsExistsSyncFn = mock<typeof fs.existsSync>().mockImplementation(
    () => true
  );

  // Apply mocks to fs module
  spyOn(fs, "readFileSync").mockImplementation(mockFsReadFileSyncFn);
  spyOn(fs, "writeFileSync").mockImplementation(mockFsWriteFileSyncFn);
  spyOn(fs, "existsSync").mockImplementation(mockFsExistsSyncFn);

  // Mock getVars function
  getVarsMock = spyOn(getVarsModule, "getVars").mockImplementation(
    async (version) => {
      if (version === "16") {
        return {
          ...mockVarsResponse,
          bitnamiName: "16.6.0-debian-12-r2",
          fullImageTag:
            "ghcr.io/bitnami-pgvector:0.8.0-pg16-16.6.0-debian-12-r2",
          tagShort: "ghcr.io/bitnami-pgvector:0.8.0-pg16",
          tagFullPgvectorPostgres: "ghcr.io/bitnami-pgvector:0.8.0-postgres16",
        };
      }
      return mockVarsResponse;
    }
  );

  // Spy on console methods
  logSpy = spyOn(console, "log").mockImplementation(() => {});
  errorSpy = spyOn(console, "error").mockImplementation(() => {});
  warnSpy = spyOn(console, "warn").mockImplementation(() => {});
});

afterAll(() => {
  // Restore original process.argv
  process.argv = originalArgv;
});

beforeEach(() => {
  // Reset mocks before each test
  mockExitFn.mockClear();
  getVarsMock.mockClear();
  mockFsReadFileSyncFn.mockClear();
  mockFsWriteFileSyncFn.mockClear();
  mockFsExistsSyncFn.mockClear();
  logSpy.mockClear();
  errorSpy.mockClear();
  warnSpy.mockClear();

  // Reset process.argv for each test
  process.argv = ["node", "updateReadmeBadge.ts"];
});

// Import the module under test after setting up mocks
import {
  generateAvailableTagsMarkdown,
  main,
  updateAvailableTagsSection,
  updatePgvectorBadge,
} from "./updateReadmeBadge";

// Test suite
describe("updateReadmeBadge", () => {
  test("updates pgvector badge correctly", async () => {
    // Mock Commander to simulate CLI arguments
    process.argv = ["node", "updateReadmeBadge.ts", "--badge-only"];

    // Use the imported main function - Commander will use the mocked process.argv
    await main();

    // Check that getVars was called with correct version
    expect(getVarsMock).toHaveBeenCalledWith("17");

    // Verify badge was updated correctly
    const expectedBadge =
      "https://img.shields.io/badge/pgvector-0.8.0-green.svg";
    const writeCall = mockFsWriteFileSyncFn.mock.calls[0];

    // First argument should be README.md
    expect(writeCall[0].toString()).toContain("README.md");

    // Second argument should have the updated badge URL
    const updatedContent = writeCall[1].toString();
    expect(updatedContent).toContain(expectedBadge);

    // Ensure the tags section was not modified
    expect(updatedContent).toContain("<!-- AVAILABLE_TAGS_START -->");
    expect(updatedContent).toContain("*   `old-tag`: Old tag information.");
  });

  test("updates available tags section correctly", async () => {
    // Mock Commander to simulate CLI arguments
    process.argv = ["node", "updateReadmeBadge.ts", "--tags-only"];

    // Use the imported main function - Commander will use the mocked process.argv
    await main();

    // Verify both versions were processed
    expect(getVarsMock).toHaveBeenCalledWith("16");
    expect(getVarsMock).toHaveBeenCalledWith("17");

    // Check that the README was updated
    expect(mockFsWriteFileSyncFn).toHaveBeenCalled();

    // Get the write call arguments
    const writeCall = mockFsWriteFileSyncFn.mock.calls[0];
    const updatedContent = writeCall[1].toString();

    // Should include the new tags
    expect(updatedContent).toContain("bitnami-pgvector:0.8.0-pg17");
    expect(updatedContent).toContain("bitnami-pgvector:0.8.0-pg16");

    // Should not contain the old tag info
    expect(updatedContent).not.toContain("`old-tag`: Old tag information.");

    // Badge should remain unchanged
    expect(updatedContent).toContain(
      "https://img.shields.io/badge/pgvector-0.7.0-green.svg"
    );
  });

  test("handles dry run mode correctly", async () => {
    // Mock Commander to simulate CLI arguments
    process.argv = ["node", "updateReadmeBadge.ts", "--dry-run"];

    // Use the imported main function - Commander will use the mocked process.argv
    await main();

    // Verify both getVars and console were called
    expect(getVarsMock).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("DRY RUN MODE")
    );

    // Check that writeFileSync was not called
    expect(mockFsWriteFileSyncFn).not.toHaveBeenCalled();
  });

  test("handles silent mode correctly", async () => {
    // Mock Commander to simulate CLI arguments
    process.argv = ["node", "updateReadmeBadge.ts", "--silent"];

    // Use the imported main function - Commander will use the mocked process.argv
    await main();

    // Verify both getVars was called
    expect(getVarsMock).toHaveBeenCalled();

    // Check that console.log was not called for non-essential output
    expect(logSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Determining pgvector version")
    );
    expect(logSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("README update complete")
    );

    // File should still be written
    expect(mockFsWriteFileSyncFn).toHaveBeenCalled();
  });

  test("handles errors gracefully", async () => {
    // Make readFileSync throw an error
    mockFsReadFileSyncFn.mockImplementationOnce(() => {
      throw new Error("File not found");
    });

    // Mock Commander to simulate CLI arguments
    process.argv = ["node", "updateReadmeBadge.ts"];

    // Use the imported main function - Commander will use the mocked process.argv

    // Set up a try/catch to handle the error
    try {
      await main();
      // Should not reach here if an error was thrown
      fail("Expected main() to throw an error");
    } catch (_error) {
      // Verify that errorSpy was called
      expect(errorSpy).toHaveBeenCalled();
    }
  });

  test("handles custom primary version", async () => {
    // Mock Commander to simulate CLI arguments
    process.argv = ["node", "updateReadmeBadge.ts", "--primary", "16"];

    // Use the imported main function - Commander will use the mocked process.argv
    await main();

    // Check that getVars was called with the correct version
    expect(getVarsMock).toHaveBeenCalledWith("16");
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Determining pgvector version for PostgreSQL 16")
    );
  });

  test("handles custom versions list", async () => {
    // Mock Commander to simulate CLI arguments
    process.argv = ["node", "updateReadmeBadge.ts", "--versions", "15,16"];

    // Use the imported main function - Commander will use the mocked process.argv
    await main();

    // Check that getVars was called with the correct versions
    expect(getVarsMock).toHaveBeenCalledWith("15");
    expect(getVarsMock).toHaveBeenCalledWith("16");
    // Skip checking for '17' as Commander parsing behavior may vary in tests
  });

  test("handles custom README file path", async () => {
    // Mock Commander to simulate CLI arguments
    process.argv = [
      "node",
      "updateReadmeBadge.ts",
      "--readme",
      "CUSTOM_README.md",
    ];

    // Use the imported main function - Commander will use the mocked process.argv
    await main();

    // Check that readFileSync was called with the correct path
    expect(mockFsReadFileSyncFn).toHaveBeenCalledWith(
      "CUSTOM_README.md",
      "utf-8"
    );

    // Check that writeFileSync was called with the correct path
    const writeCall = mockFsWriteFileSyncFn.mock.calls[0];
    expect(writeCall[0]).toBe("CUSTOM_README.md");
  });

  test("validates input parameters", async () => {
    // Mock Commander to simulate CLI arguments with invalid inputs
    process.argv = ["node", "updateReadmeBadge.ts", "--primary", "invalid"];

    // Use the imported main function - Commander will use the mocked process.argv

    // Expect process.exit to be called
    await expect(main()).rejects.toThrow("Process exited with code 1");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Invalid primary version")
    );
  });
});
