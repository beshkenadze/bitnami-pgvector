[![GitHub Workflow Status](https://github.com/beshkenadze/bitnami-pgvector/actions/workflows/build.yml/badge.svg)](https://github.com/beshkenadze/bitnami-pgvector/actions/workflows/build.yml) [![Running Tests](https://github.com/beshkenadze/bitnami-pgvector/actions/workflows/test.yml/badge.svg)](https://github.com/beshkenadze/bitnami-pgvector/actions/workflows/test.yml) [![pgvector Version](https://img.shields.io/badge/pgvector-0.8.0-green.svg)](https://github.com/pgvector/pgvector/releases) [![PostgreSQL Versions](https://img.shields.io/badge/PostgreSQL-16%20%7C%2017-blue.svg)](https://www.postgresql.org/) [![GHCR latest](https://img.shields.io/badge/GHCR-latest-blue)](https://github.com/beshkenadze/bitnami-pgvector/pkgs/container/bitnami-pgvector) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

# Bitnami PostgreSQL with pgvector Extension

This project provides a Docker image that combines Bitnami's PostgreSQL with the pgvector extension for vector similarity search capabilities.

## Quick Install

For specific architectures:

```bash
# For linux/amd64
docker pull ghcr.io/beshkenadze/bitnami-pgvector:latest@sha256:1065402f43c9384a0b34a64d6cab0839f9b332b5cb4d75c97161fb12ad25fc92

# For linux/arm64
docker pull ghcr.io/beshkenadze/bitnami-pgvector:latest@sha256:4df7853e68c428460c1b529f41e9b5b7dbc7052925c8077980c92c27343dd84f
```

For multi-arch support (automatically selects the right architecture):

```bash
docker pull ghcr.io/beshkenadze/bitnami-pgvector:latest
```

## Available tags:

<!-- AVAILABLE_TAGS_START -->
*   `latest`: Latest build based on PostgreSQL 17.
*   `0.8.0-pg16`: Specific pgvector and PostgreSQL 16 version.
*   `pg16`: Latest build for PostgreSQL 16.
*   `0.8.0-pg16.6.0`: Specific pgvector, PostgreSQL full version (16.6.0).
*   `0.8.0-pg17`: Specific pgvector and PostgreSQL 17 version.
*   `pg17`: Latest build for PostgreSQL 17.
*   `0.8.0-pg17.4.0`: Specific pgvector, PostgreSQL full version (17.4.0).
<!-- AVAILABLE_TAGS_END -->

## Features

- Based on the official Bitnami PostgreSQL image
- Includes pgvector extension for vector similarity search
- Multi-architecture support (amd64 and arm64)
- Automated builds via GitHub Actions
- Version tracking based on both PostgreSQL and pgvector versions

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
PG_MAJOR_VERSION=17 ./build.sh

# Build for PostgreSQL 16
PG_MAJOR_VERSION=16 ./build.sh
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

- `latest`: Latest successful build (points to the highest PostgreSQL version, currently `pg17`)
- `pg{VERSION}`: Latest build for a specific PostgreSQL major version (e.g., `pg17`, `pg16`)

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
