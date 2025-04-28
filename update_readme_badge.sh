#!/bin/bash

# Exit on error
set -e

# --- Configuration ---
# Define the primary PG version (e.g., the one used for the 'latest' tag)
PRIMARY_PG_MAJOR_VERSION=17

# Define all supported PG major versions
SUPPORTED_PG_VERSIONS=(16 17)

README_FILE="README.md"
GET_VARS_SCRIPT="./get_vars.sh"

# --- Ensure get_vars.sh is executable ---
if [ ! -x "$GET_VARS_SCRIPT" ]; then
    echo "Making $GET_VARS_SCRIPT executable..."
    chmod +x "$GET_VARS_SCRIPT"
fi

# --- Update pgvector Badge ---
echo "Determining pgvector version for PostgreSQL ${PRIMARY_PG_MAJOR_VERSION}..."

# Source the variables script to get the pgvector version for the primary PG version
export PG_MAJOR_VERSION=$PRIMARY_PG_MAJOR_VERSION
# Capture output as sourcing might not export in all subshell scenarios
GET_VARS_OUTPUT=$(PG_MAJOR_VERSION=$PRIMARY_PG_MAJOR_VERSION "$GET_VARS_SCRIPT")
PGVECTOR_FULL_VER=$(echo "$GET_VARS_OUTPUT" | grep 'PGVector Full Version:' | sed 's/PGVector Full Version: //')

if [ -z "$PGVECTOR_FULL_VER" ]; then
    echo "Error: Could not determine PGVECTOR_FULL_VER from $GET_VARS_SCRIPT for PG ${PRIMARY_PG_MAJOR_VERSION}"
    exit 1
fi

echo "Found primary pgvector version: $PGVECTOR_FULL_VER"

# Use sed to update the badge in README.md
# Uses -i.bak for macOS compatibility.
echo "Updating pgvector badge in $README_FILE..."
sed -i.bak "s|img.shields.io/badge/pgvector-[0-9.]*-green.svg|img.shields.io/badge/pgvector-${PGVECTOR_FULL_VER}-green.svg|" "$README_FILE"
rm -f "${README_FILE}.bak"
echo "pgvector badge updated successfully."

# --- Update Available Tags Section ---

echo "Generating available tags list..."

TAGS_MARKDOWN=""

# Add the 'latest' tag first
TAGS_MARKDOWN+="*   \`latest\`: Latest build based on PostgreSQL ${PRIMARY_PG_MAJOR_VERSION}.\\n"

# Loop through supported versions to generate tags
for VERSION in "${SUPPORTED_PG_VERSIONS[@]}"; do
    echo "- Processing PG ${VERSION}..."
    # Run get_vars.sh and capture output
    VARS_OUTPUT=$(PG_MAJOR_VERSION=$VERSION "$GET_VARS_SCRIPT")

    # Extract tags from the output
    TAG_PRIMARY=$(echo "$VARS_OUTPUT" | grep 'Primary Tag:' | sed 's/Primary Tag: //')
    TAG_SHORT=$(echo "$VARS_OUTPUT" | grep 'Short Tag:' | sed 's/Short Tag: //')
    TAG_FULL_PGVECTOR_POSTGRES=$(echo "$VARS_OUTPUT" | grep 'Full PGVector/Postgres Tag:' | sed 's/Full PGVector\/Postgres Tag: //')
    POSTGRES_FULL_VER=$(echo "$VARS_OUTPUT" | grep 'PostgreSQL Full Version:' | sed 's/PostgreSQL Full Version: //')

    if [ -z "$TAG_PRIMARY" ] || [ -z "$TAG_SHORT" ] || [ -z "$TAG_FULL_PGVECTOR_POSTGRES" ]; then
        echo "Error: Failed to extract tags for PG ${VERSION}. Output was:"
        echo "$VARS_OUTPUT"
        exit 1
    fi

    # Append tags to markdown string
    TAGS_MARKDOWN+="*   \`${TAG_PRIMARY}\`: Specific pgvector and PostgreSQL ${VERSION} version.\\n"
    TAGS_MARKDOWN+="*   \`${TAG_SHORT}\`: Latest build for PostgreSQL ${VERSION}.\\n"
    TAGS_MARKDOWN+="*   \`${TAG_FULL_PGVECTOR_POSTGRES}\`: Specific pgvector, PostgreSQL full version (${POSTGRES_FULL_VER}).\\n"
done

# Remove trailing newline if present
TAGS_MARKDOWN=$(echo -e "${TAGS_MARKDOWN%\\\\n}")

# Write tags to a temporary file
echo "$TAGS_MARKDOWN" > tags.tmp

echo "Updating 'Available tags' section in $README_FILE..."

# Use awk to replace content between markers by reading from the temp file
# Corrected logic: Print lines before START, print temp file content,
# skip lines until END, then print lines after END.
awk '
/<!-- AVAILABLE_TAGS_START -->/ {
  print # Print the START marker itself
  # Read and print content from the temporary file
  while ((getline line < "tags.tmp") > 0) {
    print line
  }
  close("tags.tmp") # Close the file after reading
  # Set flag to skip lines until END marker
  skip=1
  next # Skip the START marker line itself from being printed by the default rule
}
/<!-- AVAILABLE_TAGS_END -->/ {
  skip=0 # Stop skipping
  print # Print the END marker itself
  next # Skip the END marker line itself from being printed by the default rule
}
!skip { print } # Print lines only if skip flag is not set
' "$README_FILE" > "${README_FILE}.tmp" && mv "${README_FILE}.tmp" "$README_FILE"

# Clean up the temporary file
rm -f tags.tmp

if [ $? -ne 0 ]; then
    echo "Error: Failed to update tags section in $README_FILE"
    exit 1
fi

echo "Available tags section updated successfully."

echo "README update complete."

exit 0
