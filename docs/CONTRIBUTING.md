# Contributing

## Branching

`main` ← `dev` ← feature branches ([ADR-010](DECISIONS.md#adr-010-git-flow-main--dev--phase)).

- Branch from `dev`: `feat/<topic>`, `fix/<topic>`, or `phase/<n>-<name>` for planned phases.
- Merge back into `dev` with `--no-ff`, so each piece of work stays one visible unit in history.
- `main` receives **releases only**, merged from `dev`.
- Don't push directly to `dev` or `main`.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), small and focused. One task is
usually 1–4 commits.

```
<type>(<scope>): <imperative summary, lower case, no period>
```

| Type | For |
|---|---|
| `feat` | New behaviour |
| `fix` | A bug fix |
| `test` | Tests only |
| `refactor` | Code change with no behaviour change |
| `style` | Formatting, CSS, visual polish |
| `build` | Dockerfiles, compose, dependencies |
| `ci` | `.github/workflows` |
| `docs` | Documentation |
| `chore` | Anything else (tooling, housekeeping) |

Scopes: `backend`, `frontend`, `go`, `php`; omit the scope for changes that span components.
Examples: `feat(backend): add service status transition endpoint`,
`test(go): cover invalid service_id`, `build: compose full stack with healthchecks and secrets`.

Install the hooks once with `pre-commit install`: they trim whitespace, check YAML, block large
files, run gitleaks, ruff and gofmt.

## Pull request checklist

- [ ] `make lint` and `make test` pass; if you touched more than one component, `make up seed smoke` too.
- [ ] New behaviour has tests at the level that would catch it breaking (unit, API, e2e).
- [ ] Schema changes come with a migration; `makemigrations --check` is clean.
- [ ] New user-facing text is in **both** `frontend/src/messages/en.json` and `fa.json`
      (the parity test fails otherwise); no string literals in components.
- [ ] Frontend CSS uses logical properties only (`npm run lint:rtl`); checked in `fa` at 375 / 768 / 1280 px.
- [ ] Error responses use the shared envelope and an existing `code`, or the new code is added to
      [API.md](API.md) and the frontend `errors` messages.
- [ ] Security-relevant changes (auth, scoping, roles, secrets) are called out in the PR description.
- [ ] A decision that future readers will ask "why?" about gets an ADR in [DECISIONS.md](DECISIONS.md).
- [ ] Docs updated (README, API, ERD) if behaviour, endpoints or the schema changed.

## Extension recipes

Each recipe lists the files to touch in order. Paths are from the repository root.

### Add a service status (e.g. a terminal `terminated`)

The state machine lives in Django; the PHP module mirrors it, and the database enforces the set of
values. Go needs no change: it returns whatever status the row holds.

1. **Django enum**: add `TERMINATED = "terminated", "Terminated"` to `ServiceStatus` in
   `backend/apps/cloud/models.py`.
2. **Transition map**: in `backend/apps/cloud/transitions.py`, add the allowed moves, e.g.
   `ACTIVE → {SUSPENDED, TERMINATED}`, `SUSPENDED → {ACTIVE, TERMINATED}`, `TERMINATED → {}`
   (terminal: no way out). Update the diagram in the module docstring.
3. **CHECK constraint migration**: `uv run python manage.py makemigrations cloud`. Django drops
   and re-adds `services_status_valid`, `status_logs_from_valid` and `status_logs_to_valid` with
   the new value.
   Review the SQL with `sqlmigrate`.
4. **PHP enum**: add `case Terminated = 'terminated';` to
   `php-module/src/Domain/ServiceStatus.php`, extend `allowedTargets()` to match the Django map,
   and add its `label()`.
5. **Frontend type**: add `"terminated"` to `SERVICE_STATUSES` in `frontend/src/types/api.ts`.
   TypeScript then points at every place that needs a case.
6. **Badge**: add a tone in `frontend/src/features/services/components/ServiceStatusBadge.tsx`
   (color plus text, never color alone).
7. **Actions**: `ServiceTable.tsx` and `ServiceStatusToggle.tsx` assume two statuses (one
   toggle). With a third, derive the menu items from the allowed targets instead, and hide all
   actions for `terminated`.
8. **Translations**: `services.status.terminated` and any new action and dialog strings, in
   **both** `en.json` and `fa.json`.
9. **Tests**:
   - `backend/apps/cloud/tests`: the transition table, including `terminated → *` → 409.
   - `php-module/tests/Unit/ServiceStatusTest.php`.
   - A migration test that the database rejects an unknown status.
   - Frontend badge and toggle tests.

### Add a field to services (e.g. `monthly_price`)

1. **Model**: `monthly_price = models.DecimalField(max_digits=10, decimal_places=2)` in
   `backend/apps/cloud/models.py`. Use `Decimal`, never float, for money. Add a CHECK
   (`monthly_price >= 0`) in `Meta.constraints`.
2. **Migration**: `makemigrations cloud`. For existing rows, choose a default, or make the field
   nullable then backfill.
3. **Grants**: the PHP and Go roles use column-level grants. If PHP should read it, `SELECT` on
   `services` already covers new columns; `health_ro` stays limited to `(id, status)`.
4. **Serializer**: add it to `ServiceSerializer.Meta.fields` in `backend/apps/cloud/serializers.py`
   with validation (`min_value=0`). The OpenAPI schema updates itself.
5. **Frontend type**: add `monthly_price: string` to `Service` in `frontend/src/types/api.ts`. DRF
   sends decimals as strings, which keeps them exact.
6. **Form**: add the field to `makeServiceSchema` in `frontend/src/features/services/schemas.ts`
   and to `AddServiceDialog.tsx`; server errors map automatically through `applyApiError`.
7. **Table**: add a column in `ServiceTable.tsx`, formatted with `format.number(…, {style:
   "currency"})`. Choose its place in the hiding order, then run `e2e/table-fit.spec.ts` to check
   the thresholds still fit.
8. **Translations**: column header, form label, validation messages in `en.json` and `fa.json`.
9. **PHP** (if shown there): `php-module/src/Repository/ServiceRepository.php` select list and the
   template.

### Add a list filter (e.g. `created_after` on customers)

1. **FilterSet**: in `backend/apps/customers/filters.py`, add
   `class CustomerFilter(django_filters.FilterSet)` with
   `created_after = django_filters.IsoDateTimeFilter(field_name="created_at", lookup_expr="gte")`.
2. **View**: set `filterset_class = CustomerFilter` on `CustomerViewSet`
   (`backend/apps/customers/views.py`). Invalid values then return `400 validation_error` with
   field details, like the services filters.
3. **Schema/docs**: drf-spectacular picks it up; add it to the customer list section of [API.md](API.md).
4. **Frontend URL state**: add the param to `ListParams` in
   `frontend/src/features/customers/params.ts`. Parse it defensively, as with `page` and
   `ordering`, and extend `params.test.ts`.
5. **Request**: pass it through in `listCustomers` (`features/customers/api.ts`). It's part of the
   query key automatically, because the whole `ListParams` object is.
6. **UI**: a toolbar control in `CustomerToolbar.tsx` (`DashboardFilterMenu` or a date input),
   with labels in both message files.
7. **Tests**: an API test (filters, rejects garbage); a frontend params test.

### Add a staff-only update endpoint (e.g. `PATCH /customers/{id}/`)

1. **View**: add `mixins.UpdateModelMixin` to `CustomerViewSet`, and set
   `http_method_names = ["get", "post", "patch", "head", "options"]` so `PUT` stays disallowed.
   `IsStaffOrReadOnly` already makes it staff-only; scoping through `get_queryset` still turns
   other customers into 404.
2. **Serializer**: `validate_email` and `validate_phone` in `CustomerSerializer`
   (`backend/apps/customers/serializers.py`) check uniqueness against **all** customers today.
   On update, add `.exclude(pk=self.instance.pk)` when `self.instance` is set; otherwise saving a
   customer with their own unchanged email answers "already exists".
3. **Tests**: add the endpoint to the permission matrix test (anonymous 401, customer 403/404,
   staff 200), plus validation and a concurrent-uniqueness case (409 `conflict`).
4. **Frontend**:
   - `updateCustomer(id, patch)` in `features/customers/api.ts`.
   - A `useUpdateCustomer` mutation that updates `customerKeys.detail(id)` and invalidates the lists.
   - An edit form reusing `makeCustomerSchema` and `applyApiError`.
5. **Docs**: [API.md](API.md).

### Add a route alias to the status service (e.g. `GET /health/services/{id}`)

1. **Route**: in `health-service/internal/httpapi/routes.go`, register
   `mux.Handle("GET /health/services/{id}", …)` (Go 1.22+ patterns). Read the id with
   `r.PathValue("id")`.
2. **Reuse the handler**: run the value through the same parser as the query parameter
   (`service_id.go`), so `abc`, `0`, `-5` and overflow give the same `400 invalid_service_id`,
   then call the same lookup. Don't copy the handler.
3. **Method handling**: other methods on the new path must still return the JSON `405` with
   `Allow: GET`.
4. **Tests**: table tests in `health_handler_test.go` for both URL forms, asserting identical
   responses.
5. **Docs**: `health-service/README.md` and [API.md](API.md).

### Add a UI language (e.g. Arabic, `ar`)

1. **Config**: add `"ar"` to `locales` and its direction (`"rtl"`) to `directions` in
   `frontend/src/i18n/config.ts`.
2. **Messages**: copy `frontend/src/messages/en.json` to `ar.json` and translate every value. The
   parity test (`src/messages/messages.test.ts`) fails until every key exists. Add the language's
   own name under `common.languages` in **every** message file.
3. **Font**: in `frontend/src/app/layout.tsx`, choose a `next/font` that covers the script (for
   Arabic, Vazirmatn already does), and map the locale to it.
4. **Locale switcher**: it lists `locales`, so the new language appears automatically.
5. **Formats**: dates and numbers come from `useFormatter`, so they follow the locale. Check the
   calendar and digits are what users expect.
6. **Check**: an RTL language needs nothing else, as long as CSS keeps to logical properties
   (`npm run lint:rtl`). Add it to `LOCALES` in `e2e/shell-rtl.spec.ts` and generate baselines.
