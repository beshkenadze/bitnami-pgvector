ARG BITNAMI_TAG=17.4.0-debian-12-r17
ARG PG_MAJOR_VERSION=17
ARG PG_SEARCH_TAG=0.15.18-pg17
ARG PGVECTOR_BUILDER_TAG=0.8.0-pg17

# Builder for pg_search
FROM paradedb/paradedb:${PG_SEARCH_TAG} AS builder-pg_search

FROM pgvector/pgvector:${PGVECTOR_BUILDER_TAG} AS builder
FROM bitnami/postgresql:${BITNAMI_TAG}
ARG PG_MAJOR_VERSION

# Set shared_preload_libraries to include pg_search
ENV POSTGRESQL_SHARED_PRELOAD_LIBRARIES="pg_search"

# Copy pgvector extension files
COPY --from=builder /usr/lib/postgresql/${PG_MAJOR_VERSION}/lib/vector.so /opt/bitnami/postgresql/lib/
COPY --from=builder /usr/share/postgresql/${PG_MAJOR_VERSION}/extension/vector* /opt/bitnami/postgresql/share/extension/

# Copy pg_search extension files from the correct location in the paradedb image
COPY --from=builder-pg_search /usr/lib/postgresql/${PG_MAJOR_VERSION}/lib/pg_search.so /opt/bitnami/postgresql/lib/
COPY --from=builder-pg_search /usr/share/postgresql/${PG_MAJOR_VERSION}/extension/pg_search* /opt/bitnami/postgresql/share/extension/

LABEL org.opencontainers.image.description="PostgreSQL image with pgvector extension based on Bitnami's PostgreSQL image"
LABEL org.opencontainers.image.licenses=MIT