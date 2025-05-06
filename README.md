[![GitHub Workflow Status](https://github.com/beshkenadze/bitnami-pgvector-search/actions/workflows/build.yml/badge.svg)](https://github.com/beshkenadze/bitnami-pgvector-search/actions/workflows/build.yml) [![Running Tests](https://github.com/beshkenadze/bitnami-pgvector-search/actions/workflows/test.yml/badge.svg)](https://github.com/beshkenadze/bitnami-pgvector-search/actions/workflows/test.yml) [![pgvector Version](https://img.shields.io/badge/pgvector-0.8.0-green.svg)](https://github.com/pgvector/pgvector/releases) [![PostgreSQL Versions](https://img.shields.io/badge/PostgreSQL-16%20%7C%2017-blue.svg)](https://www.postgresql.org/) [![GHCR latest](https://img.shields.io/badge/GHCR-latest-blue)](https://github.com/beshkenadze/bitnami-pgvector-search/pkgs/container/bitnami-pgvector) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

# Bitnami PostgreSQL with pgvector Extension

This project provides a Docker image that combines Bitnami's PostgreSQL with the pgvector extension for vector similarity search capabilities.

**How it works:**

1.  **Version Fetching:** A script (`get_vars.sh`) automatically fetches the latest compatible Debian-based Bitnami PostgreSQL image tag and the latest pgvector tag corresponding to the specified PostgreSQL major version (e.g., 16 or 17) from Docker Hub.
2.  **Multi-Stage Build:** The Dockerfile uses a multi-stage build. It first pulls the official `pgvector/pgvector` image to extract the necessary extension files (`vector.so` and related SQL files).
3.  **Combining:** It then copies these pgvector files into the official `bitnami/postgresql` image specified by the fetched tag.
4.  **Multi-Architecture:** The build process (using GitHub Actions or `build.sh`) creates images for both `linux/amd64` and `linux/arm64` architectures.

**Testing:**

Images are automatically tested after successful builds using GitHub Actions (`.github/workflows/build.yml`). The workflow spins up a container using the newly built image and runs a suite of TypeScript tests (`src/tests/pgtest.ts` and `src/tests/vector_test.ts`) against it to ensure basic PostgreSQL functionality and that the `vector` extension can be created and used.

## Quick Install

For specific architectures:

```bash
# For linux/amd64
docker pull ghcr.io/beshkenadze/bitnami-pgvector-search:latest@sha256:1065402f43c9384a0b34a64d6cab0839f9b332b5cb4d75c97161fb12ad25fc92

# For linux/arm64
docker pull ghcr.io/beshkenadze/bitnami-pgvector-search:latest@sha256:4df7853e68c428460c1b529f41e9b5b7dbc7052925c8077980c92c27343dd84f
```

For multi-arch support (automatically selects the right architecture):

```bash
docker pull ghcr.io/beshkenadze/bitnami-pgvector-search:latest
```

## Available tags:

<!-- AVAILABLE_TAGS_START -->

*   `latest`: Latest build based on PostgreSQL 17.
*   `bitnami-pgvector:sha-06ae7b01bca9b86c33f89829c5379ef7bc7246d0beafa68cd9f384428dcca54b`: SHA256 hash tag representing the specific combination of PG, pgvector, and pg_search versions used in the latest build.
*   `bitnami-pgvector:0.8.0-pg16-16.6.0-debian-12-r2`: Specific pgvector, pg_search (0.15.18-pg16), and PostgreSQL 16 version.
*   `bitnami-pgvector:0.8.0-pg16`: Latest build for PostgreSQL 16 (includes pgvector & pg_search).
*   `bitnami-pgvector:0.8.0-pg16-postgres16`: Specific pgvector, pg_search (0.15.18-pg16), PostgreSQL full version (16.6.0).
*   `bitnami-pgvector:latest-pg16`: Alias for the latest build for PostgreSQL 16.
*   `bitnami-pgvector:0.8.0-pg17-17.4.0-debian-12-r17`: Specific pgvector, pg_search (0.15.18-pg17), and PostgreSQL 17 version.
*   `bitnami-pgvector:0.8.0-pg17`: Latest build for PostgreSQL 17 (includes pgvector & pg_search).
*   `bitnami-pgvector:0.8.0-pg17-postgres17`: Specific pgvector, pg_search (0.15.18-pg17), PostgreSQL full version (17.4.0).
*   `bitnami-pgvector:latest-pg17`: Alias for the latest build for PostgreSQL 17.
<!-- AVAILABLE_TAGS_END -->

## Features

- Based on the official Bitnami PostgreSQL image
- Includes pgvector extension for vector similarity search
- Multi-architecture support (amd64 and arm64)
- Automated builds via GitHub Actions
- Version tracking based on both PostgreSQL and pgvector versions
- TypeScript support for automation scripts and tests
- Biome linting for code quality

## Prerequisites

- Docker with BuildKit and multi-architecture support enabled
- GitHub CLI (optional, for authentication)
- curl and wget (for fetching version information)

## Usage

### Pull the Image

```bash
# Pull the latest image (PostgreSQL 17)
docker pull ghcr.io/${YOUR_GITHUB_USERNAME}/bitnami-pgvector:latest

# Pull a specific major version
docker pull ghcr.io/${YOUR_GITHUB_USERNAME}/bitnami-pgvector:pg17
docker pull ghcr.io/${YOUR_GITHUB_USERNAME}/bitnami-pgvector:pg16
```

### Run the Container

```bash
docker run -d \
  --name postgres-vector \
  -e POSTGRESQL_PASSWORD=your_password \
  -p 5432:5432 \
  ghcr.io/${YOUR_GITHUB_USERNAME}/bitnami-pgvector:latest # Or specify :pg17 or :pg16
```

### Enable pgvector Extension

After connecting to your database:

```sql
CREATE EXTENSION vector;
```

## Building

### Automated Builds

- Scheduled and on push always build both versions (16 & 17).
- Manual (`workflow_dispatch`):
  - Set `pg_version` to `16` or `17` → build only that version.
  - Leave `pg_version` empty → build both 16 and 17.

### Building Locally

1. Clone the repository:

```bash
git clone https://github.com/${YOUR_GITHUB_USERNAME}/bitnami-pgvector.git
cd bitnami-pgvector
```

2. Build the image (specify the desired major version):

```bash
# Build for PostgreSQL 17
bun run src/build.ts --pg 17

# Build for PostgreSQL 16
bun run src/build.ts --pg 16

# Add --push to push to the registry
bun run src/build.ts --pg 17 --push

# Specify platforms (optional)
bun run src/build.ts --pg 17 --platform linux/amd64,linux/arm64
```

### Running Tests Locally

This project includes integration tests that verify the functionality of the PostgreSQL instance and the `pgvector` and `pg_search` extensions within the built Docker image.

1.  **Ensure Docker is running.**

2.  **Run the test script:**

    The script `src/run-tests.ts` automates the process:

    - Starts a temporary PostgreSQL container using the specified image tag.
    - Waits for the database to be ready.
    - Runs the tests located in `src/tests`.
    - Stops and removes the container afterwards.

    ```bash
    # Run tests against the default PostgreSQL version (currently 16)
    bun run src/run-tests.ts

    # Run tests against a specific PostgreSQL version (e.g., 17)
    # Make sure you have built the corresponding image first (e.g., bun run src/build.ts --pg 17)
    bun run src/run-tests.ts --pg 17
    ```

The script will:

- Check for existing images in the registry
- Download the latest compatible versions of PostgreSQL and pgvector
- Build multi-architecture images (amd64 and arm64)
- Push the images to GitHub Container Registry (if authenticated)

## Environment Variables

- `PG_MAJOR_VERSION`: PostgreSQL major version (required for building)
- `GITHUB_TOKEN`: GitHub token for authentication (optional, required for registry checks)
- `REPO_NAME`: Override the default repository name (optional)

## Tags

The images are tagged using the following format:

- `latest`: Latest successful build (points to the highest supported PostgreSQL version, currently based on `pg17`)
- `latest-pg{VERSION}`: Latest build for a specific PostgreSQL major version (e.g., `latest-pg17`, `latest-pg16`). This is an alias for the short tag below.
- `{PGVECTOR_VERSION}-pg{POSTGRES_VERSION}`: Specific pgvector version combined with the PostgreSQL major version (e.g., `0.8.0-pg17`, `0.8.0-pg16`). This tag always points to the latest Bitnami base image revision for that combination.
- `sha-{HASH}`: A tag based on the SHA256 hash of the specific PostgreSQL, pgvector, and pg_search versions used in a build (e.g., `sha-aabbcc11...`). This tag is used internally by the build process to check if an image with the exact same dependencies already exists in the registry.

More specific tags including the full Bitnami image version are also available (see the "Available tags" section above) but are less commonly used directly.

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
