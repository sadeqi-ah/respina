# frontend

Next.js (App Router) staff and customer UI with a BFF auth layer. English (default, LTR) and
Persian (RTL). See `docs/IMPLEMENTATION_PLAN.md`, Phase 2.

## Development

```bash
npm install
npm run dev            # http://localhost:3000
npm run lint && npm run lint:rtl && npm run typecheck && npm test
npm run e2e            # Playwright; first run: npx playwright install chromium
```

The language comes from the `NEXT_LOCALE` cookie (`en` | `fa`, no URL prefix).

## Fonts

| Locale | Font    | Source             |
| ------ | ------- | ------------------ |
| `en`   | Geist   | `next/font/google` |
| `fa`   | Estedad | `next/font/google` |

Estedad is a variable font (`wght` 100–900). Use weights through standard CSS (`font-weight`,
Tailwind `font-medium`, `font-bold`, …), not `font-variation-settings`.
