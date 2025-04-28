ARG PGVECTOR_NAME
ARG BITNAMI_NAME
ARG PG_MAJOR_VERSION

FROM pgvector/pgvector:${PGVECTOR_NAME} AS builder
FROM bitnami/postgresql:${BITNAMI_NAME}
ARG PG_MAJOR_VERSION

COPY --from=builder /usr/lib/postgresql/${PG_MAJOR_VERSION}/lib/vector.so /opt/bitnami/postgresql/lib/
COPY --from=builder /usr/share/postgresql/${PG_MAJOR_VERSION}/extension/vector* /opt/bitnami/postgresql/share/extension/

LABEL org.opencontainers.image.description="PostgreSQL image with pgvector extension based on Bitnami's PostgreSQL image"
LABEL org.opencontainers.image.licenses=MIT