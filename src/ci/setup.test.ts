import {
  type Mock,
  afterAll,
  beforeAll,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import { $ } from "bun";
import { checkPrerequisites, setupEnvironment } from "./setup";

// Type for shell command mocking
type ShellPromise = ReturnType<typeof Bun.$>;
type TemplateTagFunc = (
  parts: TemplateStringsArray,
  ...values: unknown[]
) => ShellPromise;

// biome-ignore lint/style/useConst: needed for proper mocking
let shellMock: Mock<TemplateTagFunc>;

// Create shell mock implementation
shellMock = mock<TemplateTagFunc>().mockImplementation(
  (parts: TemplateStringsArray, ...values: unknown[]): ShellPromise => {
    const cmd = parts
      .reduce((acc, part, i) => acc + part + (values[i] ?? ""), "")
      .trim();

    // Mock bun --version
    if (cmd === "bun --version") {
      const output = {
        exitCode: 0,
        stdout: Buffer.from("1.2.10\n"),
        stderr: Buffer.from(""),
        pid: 123,
      };
      const mockPromise = Promise.resolve(output) as unknown as ShellPromise;
      mockPromise.text = () => Promise.resolve(output.stdout.toString());
      mockPromise.quiet = () => mockPromise;
      mockPromise.nothrow = () => mockPromise;
      return mockPromise;
    }

    // Mock psql --version
    if (cmd === "psql --version") {
      const output = {
        exitCode: 0,
        stdout: Buffer.from("psql (PostgreSQL) 15.4\n"),
        stderr: Buffer.from(""),
        pid: 456,
      };
      const mockPromise = Promise.resolve(output) as unknown as ShellPromise;
      mockPromise.text = () => Promise.resolve(output.stdout.toString());
      mockPromise.quiet = () => mockPromise;
      mockPromise.nothrow = () => mockPromise;
      return mockPromise;
    }

    // Mock database connection test
    if (cmd.includes("SELECT 1 as connection_test")) {
      const output = {
        exitCode: 0,
        stdout: Buffer.from(
          " connection_test\n-----------------\n               1\n(1 row)\n"
        ),
        stderr: Buffer.from(""),
        pid: 789,
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

// Spy on console methods
let logSpy: Mock<typeof console.log>;
// The error spy is needed even though it's not directly tested
// biome-ignore lint/correctness/noUnusedVariables: used in beforeAll setup
let errorSpy: Mock<typeof console.error>;

describe("CI Setup Script", () => {
  beforeAll(() => {
    // Spy on console methods
    logSpy = spyOn(console, "log").mockImplementation(() => {});
    errorSpy = spyOn(console, "error").mockImplementation(() => {});
  });

  afterAll(() => {
    // Cleanup is handled by Bun automatically
  });

  test("checkPrerequisites should return true when bun is installed", async () => {
    const result = await checkPrerequisites();
    expect(result).toBe(true);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Bun installed")
    );
  });

  test("setupEnvironment should configure environment variables", async () => {
    await setupEnvironment(
      "test-host",
      "5433",
      "test-user",
      "test-password",
      "test-db"
    );

    expect(process.env.PGHOST).toBe("test-host");
    expect(process.env.PGPORT).toBe("5433");
    expect(process.env.PGUSER).toBe("test-user");
    expect(process.env.PGPASSWORD).toBe("test-password");
    expect(process.env.PGDATABASE).toBe("test-db");

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Setting up environment")
    );
  });
});
