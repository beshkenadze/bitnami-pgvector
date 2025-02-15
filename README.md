# Bitnami PostgreSQL with pgvector

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

Available tags:

- `latest` - Latest build
- `pg16` - Latest PostgreSQL 16 build
- `pg16-233f3-67470` - Specific version combination

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
docker pull ghcr.io/${YOUR_GITHUB_USERNAME}/bitnami-pgvector:latest
# or use a specific version
docker pull ghcr.io/${YOUR_GITHUB_USERNAME}/bitnami-pgvector:pg16-xxxxx-xxxxx
```

### Run the Container

```bash
docker run -d \
  --name postgres-vector \
  -e POSTGRESQL_PASSWORD=your_password \
  -p 5432:5432 \
  ghcr.io/${YOUR_GITHUB_USERNAME}/bitnami-pgvector:latest
```

### Enable pgvector Extension

After connecting to your database:

```sql
CREATE EXTENSION vector;
```

## Building Locally

1. Clone the repository:

```bash
git clone https://github.com/${YOUR_GITHUB_USERNAME}/bitnami-pgvector.git
cd bitnami-pgvector
```

2. Build the image:

```bash
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

- `latest`: Latest successful build
- `pg{VERSION}`: Latest build for a specific PostgreSQL major version
- `pg{VERSION}-{BITNAMI_HASH}-{PGVECTOR_HASH}`: Specific version combination

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
