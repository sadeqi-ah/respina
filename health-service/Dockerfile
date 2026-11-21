# syntax=docker/dockerfile:1

# ---- build: static binary -------------------------------------------------------------------
FROM golang:1.26-alpine AS build
WORKDIR /src

COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download

COPY . .
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/healthsvc ./cmd/healthsvc

# ---- runtime: no shell, no package manager, non-root ------------------------------------------
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/healthsvc /healthsvc
USER nonroot:nonroot
EXPOSE 8080

# Distroless has no shell or curl: the binary probes itself.
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD ["/healthsvc", "-healthcheck"]

ENTRYPOINT ["/healthsvc"]
