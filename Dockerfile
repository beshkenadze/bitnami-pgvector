ARG PGVECTOR_NAME=17.4.0-debian-12-r9
ARG BITNAMI_NAME=0.8.0-pg17
ARG PG_MAJOR_VERSION=17

FROM pgvector/pgvector:${PGVECTOR_NAME} AS builder
FROM bitnami/postgresql:${BITNAMI_NAME}
ARG PG_MAJOR_VERSION

COPY --from=builder /usr/lib/postgresql/${PG_MAJOR_VERSION}/lib/vector.so /opt/bitnami/postgresql/lib/
COPY --from=builder /usr/share/postgresql/${PG_MAJOR_VERSION}/extension/vector* /opt/bitnami/postgresql/share/extension/

LABEL org.opencontainers.image.description="PostgreSQL image with pgvector extension based on Bitnami's PostgreSQL image"
LABEL org.opencontainers.image.licenses=MIT