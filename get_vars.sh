#!/bin/bash
# Exit on error
set -e

# Check if PG_MAJOR_VERSION is set
if [ -z "$PG_MAJOR_VERSION" ]; then
    echo "Error: PG_MAJOR_VERSION environment variable is not set."
    echo "Please set PG_MAJOR_VERSION (e.g., export PG_MAJOR_VERSION=16)"
    exit 1
fi

# Get repo name from environment or use default
REPO_NAME=${REPO_NAME:-"beshkenadze/bitnami-pgvector"}
REGISTRY=${REGISTRY:-"ghcr.io"} # Add default registry if not set

# Get Deps only if jq doesn't exist
if [ ! -f "./jq" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS - check architecture
        if [[ $(uname -m) == "arm64" ]]; then
            wget -q https://github.com/jqlang/jq/releases/download/jq-1.7.1/jq-macos-arm64
            mv jq-macos-arm64 jq
        else
            wget -q https://github.com/jqlang/jq/releases/download/jq-1.7.1/jq-macos-amd64
            mv jq-macos-amd64 jq
        fi
    else
        # Linux - check architecture
        if [[ $(uname -m) == "aarch64" ]]; then
            wget -q https://github.com/jqlang/jq/releases/download/jq-1.7.1/jq-linux-arm64
            mv jq-linux-arm64 jq
        else
            wget -q https://github.com/jqlang/jq/releases/download/jq-1.7.1/jq-linux-amd64
            mv jq-linux-amd64 jq
        fi
    fi
    chmod +x jq
fi

# Fetch Bitnami PostgreSQL tags
BITNAMI_POSTGRES_REG_CONTENT=$(wget -q -O - "https://hub.docker.com/v2/repositories/bitnami/postgresql/tags?page_size=100&ordering=name&name=${PG_MAJOR_VERSION}.")
if [ -z "$BITNAMI_POSTGRES_REG_CONTENT" ]; then
    echo "Error: Failed to fetch Bitnami PostgreSQL tags"
    exit 1
fi

# Get latest Debian-based PostgreSQL matching major version tag
BITNAMI_NAME=$(echo -n "$BITNAMI_POSTGRES_REG_CONTENT" | ./jq -r --arg ver "$PG_MAJOR_VERSION" '.results[] | select(.name | startswith($ver + ".") and contains("debian")) | .name' | head -n 1)
if [ -z "$BITNAMI_NAME" ]; then
    echo "Error: Could not find a matching Bitnami PostgreSQL tag starting with ${PG_MAJOR_VERSION}. and containing 'debian'"
    exit 1
fi

BITNAMI_DIGEST=$(echo -n "$BITNAMI_POSTGRES_REG_CONTENT" | ./jq -r --arg name "$BITNAMI_NAME" '.results[] | select(.name == $name) | .digest' | head -n 1)
echo "Bitnami - Name: $BITNAMI_NAME, Digest: ${BITNAMI_DIGEST:7:5}"

# Extract PostgreSQL full version from Bitnami name
POSTGRES_FULL_VER=$(echo "$BITNAMI_NAME" | sed -n 's/^\([0-9]*\.[0-9]*\.[0-9]*\).*/\1/p')
if [ -z "$POSTGRES_FULL_VER" ]; then
    echo "Error: Could not extract PostgreSQL full version from $BITNAMI_NAME"
    exit 1
fi
echo "PostgreSQL Full Version: $POSTGRES_FULL_VER"

# Fetch PGVector tags
PGVECTOR_REG_CONTENT=$(wget -q -O - "https://hub.docker.com/v2/namespaces/pgvector/repositories/pgvector/tags?page_size=100&ordering=last_updated&name=pg${PG_MAJOR_VERSION}")
if [ -z "$PGVECTOR_REG_CONTENT" ]; then
    echo "Error: Failed to fetch PGVector tags"
    exit 1
fi

# Construct the regex pattern dynamically
PGVECTOR_REGEX_PATTERN="^[0-9]+\\.[0-9]+\\.[0-9]+-pg${PG_MAJOR_VERSION}$"

# Find the latest PGVector tag matching the major version using the dynamic regex
PGVECTOR_NAME=$(echo -n "$PGVECTOR_REG_CONTENT" | ./jq -r --arg pattern "$PGVECTOR_REGEX_PATTERN" '.results[] | select(.name | test($pattern)) | .name' | sort -V | tail -n 1)
if [ -z "$PGVECTOR_NAME" ]; then
    echo "Error: Could not find a matching PGVector tag for PG ${PG_MAJOR_VERSION}"
    exit 1
fi

PGVECTOR_DIGEST=$(echo -n "$PGVECTOR_REG_CONTENT" | ./jq -r --arg name "$PGVECTOR_NAME" '.results[] | select(.name == $name) | .digest' | head -n 1)
echo "PGVector - Name: $PGVECTOR_NAME, Digest: ${PGVECTOR_DIGEST:7:5}"

# Extract pgvector versions
# Use TAG_PRIMARY directly as it already contains the full version extracted from PGVECTOR_NAME
TAG_PRIMARY="${PGVECTOR_NAME}" # PGVECTOR_NAME is now like X.Y.Z-pgMAJOR

PGVECTOR_FULL_VER=$(echo "$TAG_PRIMARY" | sed -n 's/^\([0-9]*\.[0-9]*\.[0-9]*\).*/\1/p')
if [ -z "$PGVECTOR_FULL_VER" ]; then
    echo "Error: Could not extract PGVector full version from $TAG_PRIMARY"
    exit 1
fi

PGVECTOR_MINOR_VER=$(echo "$PGVECTOR_FULL_VER" | sed -n 's/^\([0-9]*\.[0-9]*\).*/\1/p')
if [ -z "$PGVECTOR_MINOR_VER" ]; then
    echo "Error: Could not extract PGVector minor version from $PGVECTOR_FULL_VER"
    exit 1
fi
echo "PGVector Full Version: $PGVECTOR_FULL_VER"
echo "PGVector Minor Version: $PGVECTOR_MINOR_VER"

# Construct new tag formats
# Primary tag for existence check and build - use the full name fetched
# TAG_PRIMARY is already set correctly above
# Other tags
TAG_SHORT="${REGISTRY}/${REPO_NAME}:${PGVECTOR_MINOR_VER}-pg${PG_MAJOR_VERSION}"
TAG_FULL_PGVECTOR_POSTGRES="${REGISTRY}/${REPO_NAME}:${PGVECTOR_FULL_VER}-pg${POSTGRES_FULL_VER}"

FULL_IMAGE_TAG="${REGISTRY}/${REPO_NAME}:${TAG_PRIMARY}" # Use primary tag for the main output

echo "Primary Tag: $TAG_PRIMARY"
echo "Short Tag: ${PGVECTOR_MINOR_VER}-pg${PG_MAJOR_VERSION}" # Display tag part only
echo "Full PGVector/Postgres Tag: ${PGVECTOR_FULL_VER}-pg${POSTGRES_FULL_VER}" # Display tag part only
echo "Full Image Tag (for check): $FULL_IMAGE_TAG"

# Export vars for later jobs - handle both CI and local environments
if [ -n "$GITHUB_OUTPUT" ]; then
    # We're in GitHub Actions, output variables for the step
    echo "BITNAMI_NAME=$BITNAMI_NAME" >> "$GITHUB_OUTPUT"
    # Output the correct PGVector name derived for the specific PG Major version
    echo "PGVECTOR_NAME=$TAG_PRIMARY" >> "$GITHUB_OUTPUT" # Use the derived tag like 0.8.0-pg17
    echo "FULL_IMAGE_TAG=$FULL_IMAGE_TAG" >> "$GITHUB_OUTPUT"
    echo "TAG_SHORT=$TAG_SHORT" >> "$GITHUB_OUTPUT"
    echo "TAG_FULL_PGVECTOR_POSTGRES=$TAG_FULL_PGVECTOR_POSTGRES" >> "$GITHUB_OUTPUT"
elif [ -n "$GITHUB_ENV" ]; then
    # If GITHUB_OUTPUT is not set, fallback to GITHUB_ENV for environment variables (less common use case now)
    echo "Warning: Writing to GITHUB_ENV as GITHUB_OUTPUT is not available." >&2
    {
        # Output the correct PGVector name derived for the specific PG Major version
        echo "PGVECTOR_NAME=$TAG_PRIMARY"
        echo "BITNAMI_NAME=$BITNAMI_NAME"
        echo "REPO_NAME=$REPO_NAME" # REPO_NAME is already env from workflow context, maybe not needed here
        echo "FULL_IMAGE_TAG=$FULL_IMAGE_TAG"
        echo "TAG_SHORT=$TAG_SHORT"
        echo "TAG_FULL_PGVECTOR_POSTGRES=$TAG_FULL_PGVECTOR_POSTGRES"
    } >> "$GITHUB_ENV"
else
    # We're in local environment - export vars to current shell
    export PGVECTOR_NAME="$TAG_PRIMARY" # Use the derived tag like 0.8.0-pg17
    export BITNAMI_NAME="$BITNAMI_NAME"
    export REPO_NAME="$REPO_NAME"
    export FULL_IMAGE_TAG="$FULL_IMAGE_TAG"
    export TAG_SHORT="$TAG_SHORT"
    export TAG_FULL_PGVECTOR_POSTGRES="$TAG_FULL_PGVECTOR_POSTGRES"
fi