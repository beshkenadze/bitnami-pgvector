# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Build**: `bun run build` (runs getVars and updateReadme builds)
- **Test**: `bun test` (all tests) or `bun test src/file.test.ts` (single test)
- **Specific Tests**: `bun run test:e2e` (all E2E tests), `bun test src/tests/pg.e2e.test.ts` (single E2E test)
- **Lint**: `bun run lint` (check) or `bun run lint:fix` (auto-fix issues)
- **Format**: `bun run format` (format with Biome)

## Code Style

- **Formatting**: Use spaces (2 space indentation), double quotes, trailing commas
- **Imports**: Organize imports with Biome (auto-sorted)
- **Types**: Prefer explicit types, avoid `any` (warning), use interfaces for objects
- **Variables**: Use `const` for immutable variables (required)
- **Error Handling**: Use try/catch with typed errors (e.g., `error instanceof Error`)
- **TS Config**: Strict mode enabled, bundler module resolution
- **Linting Rules**: Follow Biome recommended rules (configured in biome.json)

## Important Notes

- This project uses Bun for runtime, builds, and testing
- Main scripts include docker builds, updating README badges via shields.io
- The project handles PostgreSQL with pgvector extension functionality
- Always run linting before committing changes with `bun run lint && bun run format`