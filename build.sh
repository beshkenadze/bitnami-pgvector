#!/bin/bash

# Exit on error
set -e

# Check if PG_MAJOR_VERSION is set
if [ -z "$PG_MAJOR_VERSION" ]; then
    echo "Error: PG_MAJOR_VERSION environment variable is not set"
    echo "Usage: PG_MAJOR_VERSION=16 ./build.sh"
    exit 1
fi

# Source the variables from get_vars.sh
source ./get_vars.sh

# If get_vars.sh exits with 1, it means the image already exists
if [ $? -eq 1 ]; then
    echo "Image already exists in registry. Skipping build."
    exit 0
fi

# Enable Docker BuildKit
export DOCKER_BUILDKIT=1

# Create and use a new builder instance
docker buildx create --name multiarch-builder --use || true

# Build the Docker image
echo "Building multi-architecture Docker image..."
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --build-arg BITNAMI_NAME="${BITNAMI_NAME}" \
    --build-arg PGVECTOR_NAME="${PGVECTOR_NAME}" \
    --tag "ghcr.io/${REPO_NAME}:${TAG_IDENTIFIER}" \
    --tag "ghcr.io/${REPO_NAME}:latest" \
    --push \
    .

echo "Build completed successfully!"
echo "Image tagged as: ghcr.io/${REPO_NAME}:${TAG_IDENTIFIER}"