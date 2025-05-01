ARG BITNAMI_NAME
ARG PG_MAJOR_VERSION
ARG PG_SEARCH_NAME
ARG PGVECTOR_BUILDER_TAG

# Builder for pg_search
FROM paradedb/paradedb:${PG_SEARCH_NAME} AS builder-pg_search

FROM pgvector/pgvector:${PGVECTOR_BUILDER_TAG} AS builder
FROM bitnami/postgresql:${BITNAMI_NAME}
ARG PG_MAJOR_VERSION

# Set shared_preload_libraries to include pg_search
ENV POSTGRESQL_SHARED_PRELOAD_LIBRARIES="pg_search"

# Copy pgvector extension files
COPY --from=builder /usr/lib/postgresql/${PG_MAJOR_VERSION}/lib/vector.so /opt/bitnami/postgresql/lib/
COPY --from=builder /usr/share/postgresql/${PG_MAJOR_VERSION}/extension/vector* /opt/bitnami/postgresql/share/extension/

# Copy pg_search extension files
COPY --from=builder-pg_search /tmp/target/release/pg_search-pg${PG_MAJOR_VERSION}/usr/lib/postgresql/${PG_MAJOR_VERSION}/lib/* /opt/bitnami/postgresql/lib/
COPY --from=builder-pg_search /tmp/target/release/pg_search-pg${PG_MAJOR_VERSION}/usr/share/postgresql/${PG_MAJOR_VERSION}/extension/* /opt/bitnami/postgresql/share/extension/

LABEL org.opencontainers.image.description="PostgreSQL image with pgvector extension based on Bitnami's PostgreSQL image"
LABEL org.opencontainers.image.licenses=MIT