# Architecture Decision Records

Each significant decision is recorded here as a short ADR. Proposals for things outside the
current scope (see `IMPLEMENTATION_PLAN.md` §0.4) are also added here, with status `Proposed`.

## Template

```markdown
## ADR-NNN: <title>

- **Status:** Proposed | Accepted | Superseded by ADR-XXX
- **Date:** YYYY-MM-DD

### Context
What problem or force makes a decision necessary?

### Decision
What we chose.

### Consequences
What becomes easier, what becomes harder, and what we accept as a trade-off.
```

---

## ADR-001: Monorepo

- **Status:** Accepted
- **Date:** 2026-11-21

### Context
Four components (Django backend, Next.js frontend, Go status service, PHP module) share one
database schema, one JWT keypair and one error envelope. Contracts change together.

### Decision
Keep all components in a single repository, one top-level directory per component, with shared
root files (`docker-compose.yml`, `Makefile`, CI) and shared docs in `docs/`.

### Consequences
Cross-component changes land in one PR and one review. CI uses `paths` filters so each component
only builds when it changes. Components must not import each other's code; they integrate only
through the documented contracts (DB schema, HTTP APIs, JWT).

---

## ADR-002: PostgreSQL; Django owns the schema and migrations

- **Status:** Accepted
- **Date:** 2026-11-21

### Context
Several programs read and write the same data. Someone must own the schema, or it drifts.

### Decision
Use PostgreSQL 16. Django is the only component that defines tables and runs migrations. Tables
use explicit `db_table` names so Go and PHP can rely on stable, readable names.

### Consequences
Go and PHP never run DDL; schema changes always start with a Django migration. PostgreSQL gives
us CHECK constraints, expression indexes (`lower(email)`), row locks (`FOR UPDATE`) and native
partitioning if the audit log grows.

---

## ADR-003: Next.js with a BFF layer

- **Status:** Accepted
- **Date:** 2026-11-21

### Context
The UI needs to call a JWT-protected API. Storing JWTs in `localStorage` exposes them to any XSS.

### Decision
Use Next.js (App Router) with a backend-for-frontend: route handlers proxy calls to Django and
keep the JWTs in httpOnly cookies, unreadable by browser JavaScript. The browser only talks to
the Next.js origin, so no CORS is needed, and the internal Django URL stays hidden.

### Consequences
SSR and SEO are not drivers; a plain React SPA would work functionally. The BFF is the reason
for choosing Next.js. The Next.js server becomes part of the auth path and must forward request
IDs and handle token refresh.

---

## ADR-004: RS256 JWTs

- **Status:** Accepted
- **Date:** 2026-11-21

### Context
The PHP module must authenticate the same users as Django without being able to impersonate them.

### Decision
Sign JWTs with RS256. Django holds the private key; the PHP module (and anyone else) gets only
the public key. Custom claims: `role`, `customer_id`.

### Consequences
The PHP module can verify tokens but never mint them, so a compromise of the PHP module does not
let an attacker forge tokens. Key generation is part of setup (`make keys`); keys are never
committed.

---

## ADR-005: DB-level CHECK constraints and least-privilege roles

- **Status:** Accepted
- **Date:** 2026-11-21

### Context
The database has multiple writers (Django, the PHP module, future tools). Validation that lives
only in Django does not protect against the others.

### Decision
Enforce enums and invariants with CHECK and UNIQUE constraints in the database. Each component
connects with its own role: `cloudpanel_owner` (Django), `health_ro` (column-level `SELECT` on
`services(id, status)`), `php_module` (only the reads and writes it needs).

### Consequences
Invalid states are rejected no matter who writes. A compromised Go or PHP component has a small
blast radius. Adding a status needs a migration to update the CHECK constraint.

---

## ADR-006: The PHP module writes to the database directly

- **Status:** Accepted
- **Date:** 2026-11-21

### Context
Our existing PHP products (WHMCS-style modules) integrate by talking to the database directly.

### Decision
The PHP module reads customers/services and changes service status via PDO, writing the
`service_status_logs` row in the same transaction with the service row locked.

### Consequences
The status state machine is duplicated in PHP, and Django-side hooks (signals, model logic) are
bypassed. DB constraints and least-privilege grants limit the damage. Long-term direction: route
writes through the Django API.

---

## ADR-007: UI kit: Tailwind v4 + shadcn/ui + Obsidian UI Dashboard Shell

- **Status:** Accepted
- **Date:** 2026-11-21

### Context
We want an accessible, consistent UI without building a component library.

### Decision
Tailwind CSS v4 with shadcn/ui components, plus the Obsidian UI registry's Dashboard Shell block
for the application layout.

### Consequences
Components are copied into the repo (shadcn model), so we own and can modify them, at the cost
of pulling upstream updates by hand.

---

## ADR-008: i18n: English default + Persian (RTL)

- **Status:** Accepted
- **Date:** 2026-11-21

### Context
Users work in English and Persian. Persian is right-to-left.

### Decision
Use `next-intl` with `en` (default, LTR) and `fa` (RTL). The Obsidian Dashboard Shell ships
LTR-only, so we own its source and adapt it for RTL: logical CSS properties, mirrored resize math,
mirrored drawer. API errors are translated client-side by their stable `code`, so the API stays
language-neutral (`message` is always English).

### Consequences
Every UI change must be checked in both directions (`lint:rtl` guards physical-direction
classes). New error codes need translations in both locales.

### RTL changes to the Obsidian block (Task 2.2)
The block was committed unmodified first, so these are its only edits and can be re-applied
after upgrading it. Layout CSS already used logical properties (`start-0`, `border-e`, flexbox),
so it mirrored by itself; only code that measures in physical coordinates needed changes. The
direction comes from Radix `useDirection()` (one shared `@radix-ui/react-direction` context).

| Area | LTR behaviour | RTL change |
|---|---|---|
| Sidebar resize (pointer) | width += `clientX - startX` | delta negated: dragging toward the content (left) widens |
| Sidebar resize (keys) | ArrowRight grows | physical keys: the arrow pointing at the content grows (ArrowLeft) |
| Mobile drawer | slides in from `x: -100%` | slides in from `x: 100%` (its own inline-start edge) |
| Hover highlight | translated by `offsetLeft` | anchored at `start-0`, so offset = distance between right edges |
| Active pill | Motion `layoutId` | none needed |

`shadcn/sheet.tsx` keeps physical `side="left" / "right"` variants (marked `rtl-ok`); callers
choose the side from the direction. Visual baselines: `frontend/e2e/__screenshots__/`.

### Persian font
`fa` uses Estedad (OFL, via `next/font/google`), one variable font with `wght` 100–900, so
`font-weight` and Tailwind's `font-*` utilities drive it directly. It ships with the app and
looks the same on every machine and in CI. Persian digits come from `Intl` formatting, and Latin
digits stay correct inside emails, phone numbers and IDs.

---

## ADR-009: No global client store

- **Status:** Accepted
- **Date:** 2026-11-21

### Context
Client state libraries (e.g. Zustand, Redux) are often added by default and end up duplicating
server state.

### Decision
Server state lives in TanStack Query, shareable state in the URL, form state in React Hook Form,
and local UI state in `useState`.

### Consequences
Less code and no cache-sync bugs. Revisit if real cross-cutting client state appears (e.g.
persisted UI preferences).

---

## ADR-010: Git flow: `main` ← `dev` ← `phase/*`

- **Status:** Accepted
- **Date:** 2026-11-21

### Context
Several streams of work run in parallel (see plan §2), and releases must be stable.

### Decision
`main` holds released code only and receives `dev` through a tagged release merge. `dev` is the
integration branch. Each phase/stream works on `phase/*` branched from `dev` and merges back
with `--no-ff`. Conventional Commits, no tool attribution lines.

### Consequences
`main` is always releasable; parallel phases integrate continuously on `dev`. Branches must be
brought up to date with `dev` before merging.

---

## ADR-011: Next.js Cache Components off

- **Status:** Accepted
- **Date:** 2026-11-21

### Context
Next.js 16 scaffolds new apps with `cacheComponents: true`. With it, reading `cookies()` outside
a `<Suspense>` boundary is a build error, because request data can't be part of the prerendered
static shell. Our root layout reads the `NEXT_LOCALE` cookie to set `<html lang dir>`, and every
page is per-user data fetched through the BFF.

### Decision
Set `cacheComponents: false`. Pages render per request; client data goes through TanStack Query.

### Consequences
No Suspense plumbing around the locale and session reads, and no static shell to keep correct.
We give up prerendering, which this authenticated dashboard can't use anyway. Revisit if public,
cacheable pages are added.

---

## ADR-012: Single-use refresh tokens, with refresh shared in the BFF

- **Status:** Accepted
- **Date:** 2026-11-21

### Context
Refresh tokens were rotated, but without simplejwt's blacklist the old token stayed valid for its
whole 7-day lifetime. A real-token test showed a rotated refresh token still being accepted, so
rotation protected nothing: a stolen refresh token kept working after the user moved on.
Turning the blacklist on alone breaks a normal case, though: when two requests from one browser
hit an expired access token together, each refreshes with the same refresh token, the second is
rejected as blacklisted, and the user is signed out.

### Decision
- **Django:** `token_blacklist` app + `BLACKLIST_AFTER_ROTATION`. A refresh token works once.
- **BFF:** `createSharedRefresh` (`frontend/src/lib/bff/shared-refresh.ts`). Requests that present
  the same refresh token share one in-flight refresh and receive the same rotated pair. The result
  is kept for a 10 s grace period so a request that started a moment later, still carrying the old
  cookie, isn't signed out. Errors (Django unreachable) aren't kept; at most 1,000 tokens tracked.

### Consequences
- A replayed refresh token is rejected once the grace period has passed (401, cookies cleared).
- Within the 10 s grace period, whoever presents the old refresh token gets the same new pair. The
  window is deliberately short; it's the price of not signing users out on concurrent requests.
- The sharing is per process. It's correct for our single Next.js server; running several replicas
  would need sticky sessions or a shared store (e.g. Redis, which we don't add today).
- `token_blacklist_outstandingtoken` grows with every issued token; `manage.py flushexpiredtokens`
  prunes it (to be scheduled with the stack in Phase 5).

## ADR-014: Bounded row-lock wait for status changes (`SET LOCAL lock_timeout`, 409 `service_busy`)

- **Status:** Accepted
- **Date:** 2026-11-22

### Context
Both status-change paths (Django `change_service_status`, PHP `ServiceRepository::changeStatus`)
lock the service row with `SELECT … FOR UPDATE`. Nothing set `lock_timeout` or
`statement_timeout`, so a request queued behind a stuck transaction waited indefinitely and only
looked slow: no error, no log line, a worker tied up.

### Decision
- At the start of each status-change transaction, before the `FOR UPDATE`, set `lock_timeout`
  from `DB_LOCK_TIMEOUT` (default `3s`), transaction-local.
- **Transaction-local, not per session.** Django keeps connections open (`CONN_MAX_AGE=60`); a
  session-level `SET` would stay on the connection and apply to whatever request reuses it. We use
  `set_config('lock_timeout', $1, true)`, which Postgres defines as equivalent to `SET LOCAL`, because
  `SET` can't take a bound parameter (psycopg 3 binds server-side; the PHP sql-guard forbids
  building SQL strings). The value is also validated at startup (`3s`, `500ms`, `1min`).
- **409 Conflict, code `service_busy`.** Postgres raises `lock_not_available` (`55P03`). It's not
  a server fault (500) or an overload (503): the resource is in use by a concurrent change, which is
  what 409 means, and it matches `invalid_status_transition`. Clients can retry. The event is logged
  at WARNING with `request_id` and `service_id`.

### Consequences
- A stuck holder costs a waiter at most `DB_LOCK_TIMEOUT`, and shows up in the logs.
- Under heavy contention on one service some changes fail with `service_busy` instead of queueing;
  the UI shows a retry message.
- `lock_timeout` bounds only the lock wait, not slow queries; `statement_timeout` stays unset.
