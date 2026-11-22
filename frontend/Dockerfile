# syntax=docker/dockerfile:1
# Next.js frontend + BFF. Multi-stage: deps → build → runner (standalone output, non-root).

FROM node:22-alpine AS base
# libc6-compat: some native npm modules expect glibc symbols on Alpine (musl).
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# --- deps: install from the lockfile only, so this layer is reused until it changes ---
FROM base AS deps
COPY package.json package-lock.json ./
# Longer retry backoff than npm's default: one dropped connection shouldn't fail the whole build.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

# --- build: compile; output: "standalone" (next.config.ts) traces just the files the server needs ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# public/ has no tracked files, so a fresh clone has no such directory; the runner copies it.
RUN mkdir -p public && npm run build

# --- runner: Node + the traced server, nothing else ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 10001 app \
    && adduser --system --uid 10001 --ingroup app --no-create-home app

# Owned by root and read-only to the app user: the server never writes into its own code.
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

USER app
EXPOSE 3000

# Runtime config (not baked in): DJANGO_API_URL (e.g. http://backend:8000), COOKIE_SECURE=true behind HTTPS.
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

CMD ["node", "server.js"]
