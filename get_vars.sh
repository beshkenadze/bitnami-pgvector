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

TAG_IDENTIFIER=pg$PG_MAJOR_VERSION-${BITNAMI_DIGEST:7:5}-${PGVECTOR_DIGEST:7:5}
echo "Identifier will be $TAG_IDENTIFIER"

# Construct full image tag
FULL_IMAGE_TAG="${REGISTRY}/${REPO_NAME}:${TAG_IDENTIFIER}"
echo "Full Image Tag will be $FULL_IMAGE_TAG"

# Check if image exists in registry
if [ -n "$GITHUB_ACTIONS" ]; then
    # In GitHub Actions, we're already authenticated
    TAGS_CHECK=$(curl -s "https://ghcr.io/v2/${REPO_NAME}/tags/list" || echo '{"tags":[]}')
else
    # Local development
    TAGS_CHECK=$(curl -s -H "Authorization: Bearer $(echo -n $GITHUB_TOKEN | base64)" "https://ghcr.io/v2/${REPO_NAME}/tags/list" || echo '{"tags":[]}')
fi

if echo "$TAGS_CHECK" | ./jq -e --arg tag "$TAG_IDENTIFIER" '.tags | index($tag)' > /dev/null; then
    echo "Tag found in registry. The image will not be build."
    exit 1
else
    echo "Tag not found in registry. The image will be build."
fi

# Export vars for later jobs - handle both CI and local environments
if [ -n "$GITHUB_ENV" ]; then
    # We're in GitHub Actions
    {
        echo "TAG_IDENTIFIER=$TAG_IDENTIFIER"
        echo "PGVECTOR_NAME=$PGVECTOR_NAME"
        echo "BITNAMI_NAME=$BITNAMI_NAME"
        echo "REPO_NAME=$REPO_NAME"
        echo "FULL_IMAGE_TAG=$FULL_IMAGE_TAG"
    } >> "$GITHUB_ENV"
else
    # We're in local environment - export vars to current shell
    export TAG_IDENTIFIER="$TAG_IDENTIFIER"
    export PGVECTOR_NAME="$PGVECTOR_NAME"
    export BITNAMI_NAME="$BITNAMI_NAME"
    export REPO_NAME="$REPO_NAME"
    export FULL_IMAGE_TAG="$FULL_IMAGE_TAG"
fi