import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { runBuild } from "./build"; // Import the function to test
import * as getVarsModule from "./getVars"; // Import the module

// Mock the entire getVars module
mock.module("./getVars", () => ({
  getVars: mock(async (pgMajorVersion?: string, options?: { suppressExports?: boolean }) => {
    // Default mock implementation
    console.log(`Mocked getVars called with pgMajorVersion=${pgMajorVersion}, options=${JSON.stringify(options)}`);
    const pgVer = pgMajorVersion || '16'; // Determine PG version for consistent tags
    return {
      bitnamiName: `mock-bitnami-pg${pgVer}`,
      pgvectorBaseVersion: "mock-pgvector-0.7.0",
      pgSearchName: "mock-pgsearch-latest",
      fullImageTag: `mock-registry/mock-repo:mock-pgvector-0.7.0-pg${pgVer}-mock-bitnami-pg${pgVer}`,
      tagShort: `mock-registry/mock-repo:mock-pgvector-0.7.0-pg${pgVer}`,
      tagWithFullPostgresVersion: `mock-registry/mock-repo:mock-pgvector-0.7.0-pg${pgVer}-postgres${pgVer}`,
      tagLatestPg: `mock-registry/mock-repo:latest-pg${pgVer}`,
      pgvectorBuilderTag: `mock-pgvector-0.7.0-pg${pgVer}`,
      imageExists: pgVer === '15', // Simulate exists only for PG 15 for testing
      repoName: "mock-repo",
    };
  }),
}));

// Define the mock shell executor function separately
const mockShellExecutor = mock(async (...args: any[]) => {
    let command = '';
    // Check if called as a template literal tag
    if (Array.isArray(args[0]) && 'raw' in args[0]) {
        const pieces = args[0] as unknown as TemplateStringsArray;
        // Check if the command string is passed as a direct variable like `${commandString}`
        if (pieces.raw.length === 2 && pieces.raw[0] === '' && pieces.raw[1] === '') {
            // The command string is the first interpolated value
            command = args[1] as string || '';
        } else {
            // Assume standard template literal usage like `cmd arg1 arg2`
            command = pieces.raw.join(''); // Reconstruct the command
        }
    } else {
        command = "Unexpected mock call format";
        console.error(`Unexpected call signature in mockShellExecutor: ${JSON.stringify(args)}`);
        return { exitCode: 1, stdout: Buffer.from(""), stderr: Buffer.from("Unexpected mock call format"), success: false, killed: false };
    }

    console.log(`Mocked Shell Executor: Command executed: ${command}`);

    const successResult = { exitCode: 0, stdout: Buffer.from("mock success"), stderr: Buffer.from(""), success: true, killed: false };

    // Match based on keywords in the command string
    if (command.includes('docker buildx create')) {
        return successResult;
    }
    if (command.includes('docker buildx build')) {
        return successResult;
    }

    console.warn(`Unhandled command in mockShellExecutor: ${command}`);
    return successResult;
});

describe("Build Script (build.ts)", () => {
  let consoleLogMock: ReturnType<typeof mock<(typeof console)["log"]>>;

  beforeEach(() => {
    mock.restore(); // Restore module mocks
    mockShellExecutor.mockClear(); // Clear the standalone mock executor
    consoleLogMock?.mockClear();
  });

  afterEach(() => {
    consoleLogMock?.mockRestore();
  });

  it("should run build without push or platform", async () => {
    consoleLogMock = mock(console.log);
    const options = { pgMajorVersion: "16" };
    // Pass the mock executor to runBuild
    await runBuild(options, mockShellExecutor as any, consoleLogMock);

    expect(getVarsModule.getVars).toHaveBeenCalledWith(options.pgMajorVersion, { suppressExports: true });

    // Find the call that executed the build command
    const buildCommandCall = mockShellExecutor.mock.calls.find(call => {
        const commandString = (call[0]?.raw?.[0]) || (call?.[1] as string);
        return typeof commandString === 'string' && commandString.includes('docker buildx build');
    });
    expect(buildCommandCall).toBeDefined(); // Ensure the build call was found

    if (buildCommandCall) {
        // Determine the actual command string based on how the mock was called
        const commandString = (buildCommandCall[0]?.raw?.[0]) || (buildCommandCall?.[1] as string);

        // Assertions on the command string
        expect(commandString).toContain('docker buildx build');
        expect(commandString).toContain('--build-arg BITNAMI_TAG=mock-bitnami-pg16');
        expect(commandString).toContain('--build-arg PGVECTOR_BUILDER_TAG=mock-pgvector-0.7.0-pg16');
        expect(commandString).toContain('--build-arg PG_MAJOR_VERSION=16');
        expect(commandString).toContain('--build-arg PG_SEARCH_TAG=mock-pgsearch-latest');
        expect(commandString).toContain('--tag mock-registry/mock-repo:mock-pgvector-0.7.0-pg16');
        expect(commandString).toContain('--tag mock-registry/mock-repo:latest-pg16');
        expect(commandString).toContain('-f Dockerfile');
        expect(commandString).toContain(' .');
        expect(commandString).not.toContain('--push');
        expect(commandString).not.toContain('--platform');
    }

    // Check console output
    const logs = consoleLogMock.mock.calls.map(call => call[0]);
    expect(logs).toEqual(expect.arrayContaining([expect.stringContaining("Build completed successfully!")]));
    expect(logs).toEqual(expect.arrayContaining([expect.stringContaining("Image tagged locally as: mock-registry/mock-repo:mock-pgvector-0.7.0-pg16")]));
    expect(logs).toEqual(expect.arrayContaining([expect.stringContaining("Image also tagged locally as: mock-registry/mock-repo:latest-pg16")]));
  });

  it("should run build with --push", async () => {
    consoleLogMock = mock(console.log);
    const options = { pgMajorVersion: "17", push: true };
    await runBuild(options, mockShellExecutor as any, consoleLogMock);

    expect(getVarsModule.getVars).toHaveBeenCalledWith(options.pgMajorVersion, { suppressExports: true });
    const buildCommandCall = mockShellExecutor.mock.calls.find(call => {
        const commandString = (call[0]?.raw?.[0]) || (call?.[1] as string);
        return typeof commandString === 'string' && commandString.includes('docker buildx build');
    });
    expect(buildCommandCall).toBeDefined();

    if (buildCommandCall) {
        const commandString = (buildCommandCall[0]?.raw?.[0]) || (buildCommandCall?.[1] as string);
        expect(commandString).toContain('--build-arg BITNAMI_TAG=mock-bitnami-pg17');
        expect(commandString).toContain('--tag mock-registry/mock-repo:latest-pg17');
        expect(commandString).toContain('--push');
        expect(commandString).not.toContain('--platform');
        expect(commandString).toContain('-f Dockerfile');
        expect(commandString).toContain(' .');
    }
     // Check console output
     const logs = consoleLogMock.mock.calls.map(call => call[0]);
     expect(logs).toEqual(expect.arrayContaining([expect.stringContaining("Build completed successfully!")]));
     expect(logs).toEqual(expect.arrayContaining([expect.stringContaining("Image tagged and pushed as: mock-registry/mock-repo:mock-pgvector-0.7.0-pg17")]));
     expect(logs).toEqual(expect.arrayContaining([expect.stringContaining("Image also tagged and pushed as: mock-registry/mock-repo:latest-pg17")]));
  });

  it("should run build with --platform", async () => {
    consoleLogMock = mock(console.log);
    const options = { pgMajorVersion: "16", platform: "linux/amd64,linux/arm64" };
    await runBuild(options, mockShellExecutor as any, consoleLogMock);

    expect(getVarsModule.getVars).toHaveBeenCalledWith(options.pgMajorVersion, { suppressExports: true });
    const buildCommandCall = mockShellExecutor.mock.calls.find(call => {
        const commandString = (call[0]?.raw?.[0]) || (call?.[1] as string);
        return typeof commandString === 'string' && commandString.includes('docker buildx build');
    });
    expect(buildCommandCall).toBeDefined();

    if (buildCommandCall) {
        const commandString = (buildCommandCall[0]?.raw?.[0]) || (buildCommandCall?.[1] as string);
        expect(commandString).toContain('--platform linux/amd64,linux/arm64');
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
      const options = { pgMajorVersion: "15", push: true }; // PG 15 mock has imageExists: true
      await runBuild(options, mockShellExecutor as any, consoleLogMock);

      expect(getVarsModule.getVars).toHaveBeenCalledWith(options.pgMajorVersion, { suppressExports: true });

      // Ensure docker build was NOT called
       const buildCommandCall = mockShellExecutor.mock.calls.find(call => {
           const commandString = (call[0]?.raw?.[0]) || (call?.[1] as string);
           return typeof commandString === 'string' && commandString.includes('docker buildx build');
       });
       expect(buildCommandCall).toBeUndefined();

       // Check console output
       const skipLogFound = consoleLogMock.mock.calls.some(call =>
           String(call?.[0]).startsWith("Image with hash tag ") && String(call?.[0]).endsWith(" already exists in registry. Skipping build and push.")
       );
       expect(skipLogFound).toBe(true);

       const completionLogFound = consoleLogMock.mock.calls.some(call =>
           String(call?.[0]).includes("Build completed successfully!")
       );
       expect(completionLogFound).toBe(false);
    });

  it("should NOT skip build if image exists but --push is NOT specified", async () => {
    consoleLogMock = mock(console.log);
    const options = { pgMajorVersion: "15" }; // PG 15 mock has imageExists: true, no push flag
    await runBuild(options, mockShellExecutor as any, consoleLogMock);

    expect(getVarsModule.getVars).toHaveBeenCalledWith(options.pgMajorVersion, { suppressExports: true });

    // Check console log for the warning
    const logs = consoleLogMock.mock.calls.map(call => call[0]);
    const warningLogFound = consoleLogMock.mock.calls.some(call =>
      String(call?.[0]).startsWith("Image with hash tag ") && String(call?.[0]).endsWith(" exists, but continuing with local build as --push was not specified.")
    );
    expect(warningLogFound).toBe(true);

    // Ensure docker build WAS called
    const buildCommandCall = mockShellExecutor.mock.calls.find(call => {
        const commandString = (call[0]?.raw?.[0]) || (call?.[1] as string);
        return typeof commandString === 'string' && commandString.includes('docker buildx build');
    });
    expect(buildCommandCall).toBeDefined();

    if (buildCommandCall) {
        const commandString = (buildCommandCall[0]?.raw?.[0]) || (buildCommandCall?.[1] as string);
        expect(commandString).not.toContain('--push');
        expect(commandString).toContain('-f Dockerfile');
        expect(commandString).toContain(' .');
    }
    expect(logs).toEqual(expect.arrayContaining([expect.stringContaining("Build completed successfully!")]));
  });

}); 