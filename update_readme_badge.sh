#!/bin/bash

# Exit on error
set -e

# Define the primary PG version (e.g., the one used for the 'latest' tag)
# Update this if the primary version changes
PRIMARY_PG_MAJOR_VERSION=17

echo "Determining pgvector version for PostgreSQL ${PRIMARY_PG_MAJOR_VERSION}..."

# Source the variables script to get the pgvector version
# Make sure get_vars.sh is executable
chmod +x ./get_vars.sh
export PG_MAJOR_VERSION=$PRIMARY_PG_MAJOR_VERSION
source ./get_vars.sh

# Check if PGVECTOR_FULL_VER was set by get_vars.sh
if [ -z "$PGVECTOR_FULL_VER" ]; then
    echo "Error: Could not determine PGVECTOR_FULL_VER from get_vars.sh"
    # Attempt to parse the output directly as a fallback
    OUTPUT=$(PG_MAJOR_VERSION=$PRIMARY_PG_MAJOR_VERSION ./get_vars.sh)
    PGVECTOR_FULL_VER=$(echo "$OUTPUT" | grep 'PGVector Full Version:' | sed 's/PGVector Full Version: //')
    if [ -z "$PGVECTOR_FULL_VER" ]; then
        echo "Error: Failed to parse PGVECTOR_FULL_VER from get_vars.sh output as well."
        exit 1
    fi
    echo "Note: Sourcing did not export PGVECTOR_FULL_VER, parsed from output instead."
fi


echo "Found pgvector version: $PGVECTOR_FULL_VER"

# Use sed to update the badge in README.md
# This replaces 'latest' in the pgvector badge URL with the actual version.
# Uses -i.bak for macOS compatibility.
echo "Updating README.md..."
sed -i.bak "s|img.shields.io/badge/pgvector-latest-green.svg|img.shields.io/badge/pgvector-${PGVECTOR_FULL_VER}-green.svg|" README.md

# Remove the backup file created by sed -i
rm -f README.md.bak

echo "README.md updated successfully with pgvector version ${PGVECTOR_FULL_VER}."

exit 0
