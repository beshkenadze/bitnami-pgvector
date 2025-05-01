#!/bin/bash

# Exit on error
set -e

PG_MAJOR_VERSION=""
PUSH_FLAG=""
PLATFORM_ARG=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    key="$1"
    case $key in
        --push)
        PUSH_FLAG="--push"
        shift # past argument
        ;;
        --platform)
        if [[ -z "$2" ]] || [[ "$2" == --* ]]; then
            echo "Error: --platform requires a value" >&2
            exit 1
        fi
        PLATFORM_ARG="--platform $2"
        shift # past argument
        shift # past value
        ;;
        *) # Assume it's the PG_MAJOR_VERSION if not already set
        if [ -z "$PG_MAJOR_VERSION" ]; then
            PG_MAJOR_VERSION="$1"
            shift # past argument
        else
            echo "Unknown argument: $1" >&2
            echo "Usage: ./build.sh <PG_MAJOR_VERSION> [--push] [--platform <platforms>]"
            exit 1
        fi
        ;;
    esac
done

# Check if PG_MAJOR_VERSION was provided
if [ -z "$PG_MAJOR_VERSION" ]; then
    echo "Error: PostgreSQL major version argument is missing."
    echo "Usage: ./build.sh <PG_MAJOR_VERSION> [--push] [--platform <platforms>]"
    exit 1
fi

if [ "$PUSH_FLAG" == "--push" ]; then
    echo "Push flag enabled."
fi
if [ -n "$PLATFORM_ARG" ]; then
    echo "Platform specified: $PLATFORM_ARG"
else
    echo "Platform not specified, building for current architecture."
fi


# Source the variables by running the TypeScript script
echo "Running src/getVars.ts to determine image tags..."
# Call script using commander option -p
GET_VARS_OUTPUT=$(bun run src/getVars.ts -p "$PG_MAJOR_VERSION")
GET_VARS_EXIT_CODE=$?

# Source the output variables
# Filter output to only include lines starting with 'export '
eval "$(echo "$GET_VARS_OUTPUT" | grep '^export ')"

# Check if the image already exists and push flag is set
if [ "$IMAGE_EXISTS" == "true" ] && [ "$PUSH_FLAG" == "--push" ]; then
    echo "Image already exists in registry (detected by getVars.ts). Skipping build and push."
    exit 0
elif [ "$IMAGE_EXISTS" == "true" ]; then
     echo "Image already exists locally or in registry (detected by getVars.ts), but continuing with local build as --push was not specified."
fi
# Check for actual errors from getVars.ts (non-zero exit code other than potential image-exists signal)
if [ $GET_VARS_EXIT_CODE -ne 0 ]; then
     echo "Error running src/getVars.ts (Exit code: $GET_VARS_EXIT_CODE)" >&2
     echo "--- getVars.ts output --- "
     echo "$GET_VARS_OUTPUT"
     echo "--- end output --- "
     exit 1
fi

# Check if variables were set (basic check)
if [ -z "$BITNAMI_NAME" ] || [ -z "$PGVECTOR_BASE_VERSION" ] || [ -z "$REPO_NAME" ] || [ -z "$PG_SEARCH_NAME" ] || [ -z "$TAG_SHORT" ] || [ -z "$PGVECTOR_BUILDER_TAG" ]; then
    echo "Error: Failed to obtain necessary variables from src/getVars.ts."
    echo "Current values:"
    echo "  BITNAMI_NAME=$BITNAMI_NAME"
    echo "  PGVECTOR_BASE_VERSION=$PGVECTOR_BASE_VERSION"
    echo "  REPO_NAME=$REPO_NAME"
    echo "  PG_SEARCH_NAME=$PG_SEARCH_NAME"
    echo "  TAG_SHORT=$TAG_SHORT"
    echo "  PGVECTOR_BUILDER_TAG=$PGVECTOR_BUILDER_TAG"
    echo "--- getVars.ts output --- " >&2
    echo "$GET_VARS_OUTPUT" >&2
    echo "--- end output --- " >&2
    exit 1
fi


# Enable Docker BuildKit
export DOCKER_BUILDKIT=1

# Create and use a new builder instance
docker buildx create --name multiarch-builder --use || true

# Build the Docker image
echo "Building Docker image for PG ${PG_MAJOR_VERSION}..."
# Note: Using eval to handle optional arguments. Ensure inputs are trusted.
docker_command="docker buildx build \
    ${PLATFORM_ARG} \
    --build-arg BITNAMI_NAME='${BITNAMI_NAME}' \
    --build-arg PGVECTOR_BUILDER_TAG='${PGVECTOR_BUILDER_TAG}' \
    --build-arg PG_MAJOR_VERSION='${PG_MAJOR_VERSION}' \
    --build-arg PG_SEARCH_NAME='${PG_SEARCH_NAME}' \
    --tag '${TAG_SHORT}' \
    --tag 'ghcr.io/${REPO_NAME}:latest-pg${PG_MAJOR_VERSION}' \
    ${PUSH_FLAG} \
    ."

echo "Running command:"
echo "$docker_command"
eval "$docker_command"

echo "Build completed successfully!"
if [ "$PUSH_FLAG" == "--push" ]; then
    echo "Image tagged and pushed as: ${TAG_SHORT}"
    echo "Image also tagged and pushed as: ghcr.io/${REPO_NAME}:latest-pg${PG_MAJOR_VERSION}"
else
    echo "Image tagged locally as: ${TAG_SHORT}"
    echo "Image also tagged locally as: ghcr.io/${REPO_NAME}:latest-pg${PG_MAJOR_VERSION}"
fi