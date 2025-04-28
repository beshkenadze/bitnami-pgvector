#!/bin/bash
set -e

echo "Running PostgreSQL basic connection test..."
bun run src/tests/pgtest.ts

echo
echo "Running pgvector extension test..."
bun run src/tests/vector_test.ts

echo
echo "All tests passed!"