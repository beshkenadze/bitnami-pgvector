ARG PGVECTOR_NAME
ARG BITNAMI_NAME

FROM pgvector/pgvector:${PGVECTOR_NAME} AS builder
FROM bitnami/postgresql:${BITNAMI_NAME}

COPY --from=builder /usr/lib/postgresql/16/lib/vector.so /opt/bitnami/postgresql/lib/
COPY --from=builder /usr/share/postgresql/16/extension/vector* /opt/bitnami/postgresql/share/extension/