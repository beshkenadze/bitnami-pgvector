ARG BITNAMI_NAME
ARG PGVECTOR_NAME

FROM --platform=$TARGETPLATFORM pgvector/pgvector:$PGVECTOR_NAME AS builder

FROM --platform=$TARGETPLATFORM bitnami/postgresql:$BITNAMI_NAME

COPY --from=builder /usr/lib/postgresql/16/lib/vector.so /opt/bitnami/postgresql/lib/
COPY --from=builder /usr/share/postgresql/16/extension/vector* /opt/bitnami/postgresql/share/extension/