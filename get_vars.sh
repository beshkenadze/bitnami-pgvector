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
POSTGRES_FULL_VER=$(echo "$BITNAMI_NAME" | sed -n 's/^\([0-9]*\.[0-9]*\.[0-9]*\).*/\\1/p')
if [ -z "$POSTGRES_FULL_VER" ]; then
    echo "Error: Could not extract PostgreSQL full version from $BITNAMI_NAME"
    exit 1
fi
echo "PostgreSQL Full Version: $POSTGRES_FULL_VER"

# Fetch PGVector tags
PGVECTOR_REG_CONTENT=$(wget -q -O - "https://hub.docker.com/v2/namespaces/pgvector/repositories/pgvector/tags?page_size=100")
if [ -z "$PGVECTOR_REG_CONTENT" ]; then
    echo "Error: Failed to fetch PGVector tags"
    exit 1
fi

PGVECTOR_NAME=$(echo -n "$PGVECTOR_REG_CONTENT" | ./jq -r '.results[] | select(.name | test(".*\\..*\\..*-pg16")) | .name' | head -n 1)
if [ -z "$PGVECTOR_NAME" ]; then
    echo "Error: Could not find a matching PGVector tag"
    exit 1
fi

PGVECTOR_DIGEST=$(echo -n "$PGVECTOR_REG_CONTENT" | ./jq -r --arg name "$PGVECTOR_NAME" '.results[] | select(.name == $name) | .digest' | head -n 1)
echo "PGVector - Name: $PGVECTOR_NAME, Digest: ${PGVECTOR_DIGEST:7:5}"

# Extract pgvector versions
PGVECTOR_FULL_VER=$(echo "$PGVECTOR_NAME" | sed -n 's/^\([0-9]*\.[0-9]*\.[0-9]*\).*/\\1/p')
if [ -z "$PGVECTOR_FULL_VER" ]; then
    echo "Error: Could not extract PGVector full version from $PGVECTOR_NAME"
    exit 1
fi
PGVECTOR_MINOR_VER=$(echo "$PGVECTOR_FULL_VER" | sed -n 's/^\([0-9]*\.[0-9]*\).*/\\1/p')
if [ -z "$PGVECTOR_MINOR_VER" ]; then
    echo "Error: Could not extract PGVector minor version from $PGVECTOR_FULL_VER"
    exit 1
fi
echo "PGVector Full Version: $PGVECTOR_FULL_VER"
echo "PGVector Minor Version: $PGVECTOR_MINOR_VER"

# Construct new tag formats
# Primary tag for existence check and build
TAG_PRIMARY="${PGVECTOR_FULL_VER}-pg${PG_MAJOR_VERSION}"
# Other tags
TAG_SHORT="${PGVECTOR_MINOR_VER}-pg${PG_MAJOR_VERSION}"
TAG_FULL_PGVECTOR_POSTGRES="${PGVECTOR_FULL_VER}-pg${POSTGRES_FULL_VER}" # More descriptive name

FULL_IMAGE_TAG="${REGISTRY}/${REPO_NAME}:${TAG_PRIMARY}" # Use primary tag for the main output

echo "Primary Tag: $TAG_PRIMARY"
echo "Short Tag: $TAG_SHORT"
echo "Full PGVector/Postgres Tag: $TAG_FULL_PGVECTOR_POSTGRES"
echo "Full Image Tag (for check): $FULL_IMAGE_TAG"

# Export vars for later jobs - handle both CI and local environments
if [ -n "$GITHUB_ENV" ]; then
    # We're in GitHub Actions
    {
        echo "PGVECTOR_NAME=$PGVECTOR_NAME" # Still useful for build args? Maybe not.
        echo "BITNAMI_NAME=$BITNAMI_NAME"   # Still useful for build args
        echo "REPO_NAME=$REPO_NAME"
        echo "FULL_IMAGE_TAG=$FULL_IMAGE_TAG" # Primary tag: 0.8.0-pg17
        echo "TAG_SHORT=${REGISTRY}/${REPO_NAME}:${TAG_SHORT}" # Tag: 0.8-pg17
        echo "TAG_FULL_PGVECTOR_POSTGRES=${REGISTRY}/${REPO_NAME}:${TAG_FULL_PGVECTOR_POSTGRES}" # Tag: 0.8.0-pg17.4.0
    } >> "$GITHUB_ENV"
else
    # We're in local environment - export vars to current shell
    export PGVECTOR_NAME="$PGVECTOR_NAME"
    export BITNAMI_NAME="$BITNAMI_NAME"
    export REPO_NAME="$REPO_NAME"
    export FULL_IMAGE_TAG="$FULL_IMAGE_TAG"
    export TAG_SHORT="${REGISTRY}/${REPO_NAME}:${TAG_SHORT}"
    export TAG_FULL_PGVECTOR_POSTGRES="${REGISTRY}/${REPO_NAME}:${TAG_FULL_PGVECTOR_POSTGRES}"
fi