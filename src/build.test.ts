import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { runBuild } from "./build"; // Import the function to test
import * as getVarsModule from "./getVars"; // Import the module

// Mock the entire getVars module
mock.module("./getVars", () => ({
  getVars: mock(async (pgMajorVersion?: string, options?: { suppressExports?: boolean }) => {
    // Default mock implementation
    console.log(`Mocked getVars called with pgMajorVersion=${pgMajorVersion}, options=${JSON.stringify(options)}`);
    return {
      bitnamiName: `mock-bitnami-pg${pgMajorVersion || '16'}`, // Use pg version in mock
      pgvectorBaseVersion: "mock-pgvector-0.7.0",
      pgSearchName: "mock-pgsearch-latest",
      fullImageTag: `mock-registry/mock-repo:mock-pgvector-0.7.0-pg${pgMajorVersion || '16'}-mock-bitnami-pg${pgMajorVersion || '16'}`, // Consistent tag
      tagShort: `mock-registry/mock-repo:mock-pgvector-0.7.0-pg${pgMajorVersion || '16'}`, // Consistent tag
      tagFullPgvectorPostgres: `mock-registry/mock-repo:mock-pgvector-0.7.0-pg${pgMajorVersion || '16'}-postgres${pgMajorVersion || '16'}`, // Consistent tag
      pgvectorBuilderTag: `mock-pgvector-0.7.0-pg${pgMajorVersion || '16'}`, // Consistent tag
      imageExists: false,
      repoName: "mock-repo",
    };
  }),
}));

// Define the mock shell executor function separately
// It primarily expects template literal calls based on build.ts usage
const mockShellExecutor = mock(async (...args: any[]) => {
    let command: string;
    // Check if called as a template literal tag: args are [TemplateStringsArray, ...substitutions]
    if (Array.isArray(args[0]) && 'raw' in args[0]) {
        const pieces = args[0] as unknown as TemplateStringsArray;
        const substitutions = args.slice(1);
        // Reconstruct the command string from the template literal parts
        command = pieces.reduce((acc, piece, i) => acc + piece + (substitutions[i] ?? ""), "");
    } else {
        // Handle unexpected call signature (e.g., direct array or simple string), unlikely based on build.ts
        command = "Unexpected mock call format";
        console.error(`Unexpected call signature in mockShellExecutor: ${JSON.stringify(args)}`);
        // Return an error structure consistent with Bun Shell $ process results
        return { exitCode: 1, stdout: Buffer.from(""), stderr: Buffer.from("Unexpected mock call format"), success: false, killed: false };
    }

    console.log(`Mocked Shell Executor: Command executed: ${command}`);

    // Simulate outcomes
    // Default success structure for Bun Shell $ process results
    const successResult = { exitCode: 0, stdout: Buffer.from("mock success"), stderr: Buffer.from(""), success: true, killed: false };

    if (command.startsWith('docker buildx create')) {
        // build.ts ignores errors here, so return success
        return successResult;
    }
    if (command.startsWith('docker buildx build')) {
        // Simulate successful build
        return successResult;
    }

    // Default mock behavior for any other commands
    console.warn(`Unhandled command in mockShellExecutor: ${command}`);
    return successResult; // Default to success for unhandled commands in mock
});

describe("Build Script (build.ts)", () => {
  let consoleLogMock: ReturnType<typeof mock<(typeof console)["log"]>>;

  beforeEach(() => {
    // Reset mocks defined with mock.module
    mock.restore();
    // Reset calls for the standalone mock function
    mockShellExecutor.mock.calls.length = 0;
    // Clear console mock calls if it exists
    consoleLogMock?.mockClear();
  });

  afterEach(() => {
    // Restore console mock if it was created for the test
    consoleLogMock?.mockRestore();
  });

  it("should run build without push or platform", async () => {
    // Set up console mock for this test
    consoleLogMock = mock(console.log);

    const options = { pgMajorVersion: "16" };
    await runBuild(options, mockShellExecutor as any, consoleLogMock);

    // Check if getVars was called correctly
    expect(getVarsModule.getVars).toHaveBeenCalledWith(options.pgMajorVersion, { suppressExports: true });

    // Check if docker buildx build was called via the mock executor
    const buildCommandMockCall = mockShellExecutor.mock.calls.find((call: any[]) => {
        // Expecting template literal call: shellExecutor`${commandString}`
        // Arguments are [TemplateStringsArray, ...substitutions]
        // Here, substitutions should be empty, and the command is the first raw string.
        const templateArray = call?.[0] as unknown as TemplateStringsArray;
        return Array.isArray(templateArray?.raw) && templateArray.raw[0]?.startsWith('docker buildx build');
    });
    expect(buildCommandMockCall).toBeDefined();

    if (buildCommandMockCall) {
      // Assert non-null after expect check for TypeScript
      const templateArray = buildCommandMockCall[0] as unknown as TemplateStringsArray;
      const commandString = templateArray.raw[0]; // The full command string is here

      // Now assert on the extracted commandString
      expect(commandString).toEqual(expect.stringContaining('docker buildx build'));
      expect(commandString).toEqual(expect.stringContaining('--build-arg BITNAMI_NAME=mock-bitnami-pg16'));
      expect(commandString).toEqual(expect.stringContaining('--build-arg PGVECTOR_BUILDER_TAG=mock-pgvector-0.7.0-pg16'));
      expect(commandString).toEqual(expect.stringContaining('--build-arg PG_MAJOR_VERSION=16'));
      expect(commandString).toEqual(expect.stringContaining('--build-arg PG_SEARCH_NAME=mock-pgsearch-latest'));
      expect(commandString).toEqual(expect.stringContaining('--tag mock-registry/mock-repo:mock-pgvector-0.7.0-pg16'));
      expect(commandString).toEqual(expect.stringContaining('--tag ghcr.io/mock-repo:latest-pg16'));
      expect(commandString).toContain(' .'); // Context should be present at the end
      expect(commandString).toContain('-f Dockerfile'); // Expect Dockerfile path
      expect(commandString).not.toContain('--push');
      expect(commandString).not.toContain('--platform');
    }

    // Check console output
    const logs = consoleLogMock.mock.calls.map(call => call[0]);
    expect(logs).toEqual(expect.arrayContaining([expect.stringContaining("Build completed successfully!")]));
    expect(logs).toEqual(expect.arrayContaining([expect.stringContaining("Image tagged locally as: mock-registry/mock-repo:mock-pgvector-0.7.0-pg16")]));
  });

  it("should run build with --push", async () => {
    consoleLogMock = mock(console.log);

    const options = { pgMajorVersion: "17", push: true };
    await runBuild(options, mockShellExecutor as any, consoleLogMock);

    expect(getVarsModule.getVars).toHaveBeenCalledWith(options.pgMajorVersion, { suppressExports: true });

    const buildCommandMockCall = mockShellExecutor.mock.calls.find((call: any[]) => {
        const templateArray = call?.[0] as unknown as TemplateStringsArray;
        return Array.isArray(templateArray?.raw) && templateArray.raw[0]?.startsWith('docker buildx build');
    });
    expect(buildCommandMockCall).toBeDefined();

    if (buildCommandMockCall) {
        const templateArray = buildCommandMockCall[0] as unknown as TemplateStringsArray;
        const commandString = templateArray.raw[0];

        expect(commandString).toEqual(expect.stringContaining('--build-arg BITNAMI_NAME=mock-bitnami-pg17'));
        expect(commandString).toEqual(expect.stringContaining('--tag ghcr.io/mock-repo:latest-pg17'));
        expect(commandString).toContain('--push');
        expect(commandString).not.toContain('--platform');
        expect(commandString).toContain('-f Dockerfile');
        expect(commandString).toContain(' .');
    }

    // Check console output
    const logs = consoleLogMock.mock.calls.map(call => call[0]);
    expect(logs).toEqual(expect.arrayContaining([expect.stringContaining("Build completed successfully!")]));
    expect(logs).toEqual(expect.arrayContaining([expect.stringContaining("Image tagged and pushed as: mock-registry/mock-repo:mock-pgvector-0.7.0-pg17")]));
  });

  it("should run build with --platform", async () => {
    consoleLogMock = mock(console.log);

    const options = { pgMajorVersion: "16", platform: "linux/amd64,linux/arm64" };
    await runBuild(options, mockShellExecutor as any, consoleLogMock);

    expect(getVarsModule.getVars).toHaveBeenCalledWith(options.pgMajorVersion, { suppressExports: true });

    const buildCommandMockCall = mockShellExecutor.mock.calls.find((call: any[]) => {
        const templateArray = call?.[0] as unknown as TemplateStringsArray;
        return Array.isArray(templateArray?.raw) && templateArray.raw[0]?.startsWith('docker buildx build');
    });
    expect(buildCommandMockCall).toBeDefined();

    if (buildCommandMockCall) {
        const templateArray = buildCommandMockCall[0] as unknown as TemplateStringsArray;
        const commandString = templateArray.raw[0];

        expect(commandString).toEqual(expect.stringContaining('--platform linux/amd64,linux/arm64'));
        expect(commandString).not.toContain('--push');
        expect(commandString).toContain('-f Dockerfile');
        expect(commandString).toContain(' .');
    }

    // Check console output
    const logs = consoleLogMock.mock.calls.map(call => call[0]);
    expect(logs).toEqual(expect.arrayContaining([expect.stringContaining("Build completed successfully!")]));
  });

  it("should skip build if image exists and --push is specified", async () => {
    consoleLogMock = mock(console.log);

    // Override getVars mock for this specific test
    (getVarsModule.getVars as any).mockResolvedValueOnce({
        bitnamiName: "mock-bitnami-pg15",
        pgvectorBaseVersion: "mock-pgvector-0.7.0",
        pgSearchName: "mock-pgsearch-latest",
        fullImageTag: "mock-registry/mock-repo:mock-pgvector-0.7.0-pg15-mock-bitnami-pg15",
        tagShort: "mock-registry/mock-repo:mock-pgvector-0.7.0-pg15",
        tagFullPgvectorPostgres: "mock-registry/mock-repo:mock-pgvector-0.7.0-pg15-postgres15",
        pgvectorBuilderTag: "mock-pgvector-0.7.0-pg15",
        imageExists: true, // Simulate image exists
        repoName: "mock-repo",
      });

    const options = { pgMajorVersion: "15", push: true };
    await runBuild(options, mockShellExecutor as any, consoleLogMock);

    expect(getVarsModule.getVars).toHaveBeenCalledWith(options.pgMajorVersion, { suppressExports: true });

    // Ensure docker build was NOT called
    const buildCommandMockCall = mockShellExecutor.mock.calls.find((call: any[]) => {
        const templateArray = call?.[0] as unknown as TemplateStringsArray;
        return Array.isArray(templateArray?.raw) && templateArray.raw[0]?.startsWith('docker buildx build');
    });
    expect(buildCommandMockCall).toBeUndefined();

    // Check console output
    const skipLogFound = consoleLogMock.mock.calls.some(call =>
        String(call?.[0]).includes("Image already exists in registry (detected by getVars). Skipping build and push.")
    );
    expect(skipLogFound).toBe(true);

    const completionLogFound = consoleLogMock.mock.calls.some(call =>
        String(call?.[0]).includes("Build completed successfully!")
    );
     expect(completionLogFound).toBe(false);
  });

  it("should NOT skip build if image exists but --push is NOT specified", async () => {
    consoleLogMock = mock(console.log);

    // Override getVars mock
    (getVarsModule.getVars as any).mockResolvedValueOnce({
        bitnamiName: "mock-bitnami-pg16",
        pgvectorBaseVersion: "mock-pgvector-0.7.0",
        pgSearchName: "mock-pgsearch-latest",
        fullImageTag: "mock-registry/mock-repo:mock-pgvector-0.7.0-pg16-mock-bitnami-pg16",
        tagShort: "mock-registry/mock-repo:mock-pgvector-0.7.0-pg16",
        tagFullPgvectorPostgres: "mock-registry/mock-repo:mock-pgvector-0.7.0-pg16-postgres16",
        pgvectorBuilderTag: "mock-pgvector-0.7.0-pg16",
        imageExists: true, // Simulate image exists
        repoName: "mock-repo",
      });

    const options = { pgMajorVersion: "16" }; // No push flag
    await runBuild(options, mockShellExecutor as any, consoleLogMock);

    expect(getVarsModule.getVars).toHaveBeenCalledWith(options.pgMajorVersion, { suppressExports: true });

    // Check console log for the warning
    const logs = consoleLogMock.mock.calls.map(call => call[0]);
    expect(logs).toEqual(expect.arrayContaining([expect.stringContaining("Image already exists locally or in registry (detected by getVars), but continuing with local build as --push was not specified.")]));

    // Ensure docker build WAS called
    const buildCommandMockCall = mockShellExecutor.mock.calls.find((call: any[]) => {
        const templateArray = call?.[0] as unknown as TemplateStringsArray;
        return Array.isArray(templateArray?.raw) && templateArray.raw[0]?.startsWith('docker buildx build');
    });
    expect(buildCommandMockCall).toBeDefined();

    if (buildCommandMockCall) {
        const templateArray = buildCommandMockCall[0] as unknown as TemplateStringsArray;
        const commandString = templateArray.raw[0];
        expect(commandString).not.toContain('--push');
        expect(commandString).toContain('-f Dockerfile');
        expect(commandString).toContain(' .');
    }
    expect(logs).toEqual(expect.arrayContaining([expect.stringContaining("Build completed successfully!")]));
  });

  // Add tests for error handling (e.g., getVars fails, docker build fails)
  // Note: Testing process.exit requires more complex mocking or test setup
}); 