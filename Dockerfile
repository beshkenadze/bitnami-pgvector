ARG BITNAMI_TAG=17.4.0-debian-12-r17
ARG PG_MAJOR_VERSION=17
ARG PG_SEARCH_TAG=0.15.18-pg17
ARG PGVECTOR_BUILDER_TAG=0.8.0-pg17

# Builder for pg_search
FROM paradedb/paradedb:${PG_SEARCH_TAG} AS builder-pg_search

FROM pgvector/pgvector:${PGVECTOR_BUILDER_TAG} AS builder
FROM bitnami/postgresql:${BITNAMI_TAG} as base
ARG PG_MAJOR_VERSION

# Set shared_preload_libraries to include pg_search
ENV POSTGRESQL_SHARED_PRELOAD_LIBRARIES="pg_search"

# Ensure root user for package installation
USER root

# Copy ICU libraries and data from the pg_search builder stage
COPY --from=builder-pg_search /usr/local/lib/libicu* /usr/local/lib/
COPY --from=builder-pg_search /usr/local/share/icu /usr/local/share/icu

# Update linker cache
RUN ldconfig && ldconfig

# Switch back to default postgres user
USER 1001

# Reset workdir
WORKDIR /

# Copy vector.so and extension files from the pgvector builder stage
# These paths are specific to the pgvector/pgvector image structure
COPY --from=builder /usr/lib/postgresql/${PG_MAJOR_VERSION}/lib/vector.so /opt/bitnami/postgresql/lib/
COPY --from=builder /usr/share/postgresql/${PG_MAJOR_VERSION}/extension/vector* /opt/bitnami/postgresql/share/extension/

# Copy pg_search.so and extension files from the pg_search builder stage
# These paths are specific to the paradedb/paradedb image structure
COPY --from=builder-pg_search /usr/lib/postgresql/${PG_MAJOR_VERSION}/lib/pg_search.so /opt/bitnami/postgresql/lib/
COPY --from=builder-pg_search /usr/share/postgresql/${PG_MAJOR_VERSION}/extension/pg_search* /opt/bitnami/postgresql/share/extension/

LABEL org.opencontainers.image.description="PostgreSQL image with pgvector and pg_search extensions based on Bitnami's PostgreSQL image"
LABEL org.opencontainers.image.licenses=MIT