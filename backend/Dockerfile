# syntax=docker/dockerfile:1

# ---- build: resolve dependencies into /app/.venv -------------------------------------------
FROM python:3.12-slim AS build

COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/app/.venv

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project

COPY . .

# collectstatic imports settings, which need a secret key, a DB URL and JWT keys. Use
# throwaway values that exist only in this build stage; nothing connects to a database.
RUN set -eu; \
    /app/.venv/bin/python -c "from cryptography.hazmat.primitives.asymmetric import rsa; \
from cryptography.hazmat.primitives import serialization as s; \
k = rsa.generate_private_key(public_exponent=65537, key_size=2048); \
open('/tmp/k.pem','wb').write(k.private_bytes(s.Encoding.PEM, s.PrivateFormat.PKCS8, s.NoEncryption())); \
open('/tmp/k.pub','wb').write(k.public_key().public_bytes(s.Encoding.PEM, s.PublicFormat.SubjectPublicKeyInfo))"; \
    DJANGO_SECRET_KEY=build-only \
    DATABASE_URL=postgres://build@localhost/build \
    JWT_PRIVATE_KEY_PATH=/tmp/k.pem JWT_PUBLIC_KEY_PATH=/tmp/k.pub \
    /app/.venv/bin/python manage.py collectstatic --noinput -v 0; \
    rm -f /tmp/k.pem /tmp/k.pub

# ---- runtime: no build tools, non-root -------------------------------------------------------
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/app/.venv/bin:$PATH

RUN groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid app --no-create-home --shell /usr/sbin/nologin app

WORKDIR /app
COPY --from=build --chown=root:root /app /app
RUN chmod +x /app/docker/entrypoint.sh

USER app
EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
    CMD ["python", "-c", "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/healthz', timeout=2).status == 200 else 1)"]

ENTRYPOINT ["/app/docker/entrypoint.sh"]
