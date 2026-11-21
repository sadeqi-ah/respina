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

| Locale        | Font                                                   | Source                      |
| ------------- | ------------------------------------------------------ | --------------------------- |
| `en`          | Geist                                                  | `next/font/google`          |
| `fa`          | Yekan Bakh (variable: `wght` 100–950, `wdth` 62.5–150) | self-hosted, **not in git** |
| `fa` fallback | Vazirmatn                                              | `next/font/google`          |

Yekan Bakh is a commercial font from fontiran.com. Its licence forbids redistributing the files
and requires a registered web licence for use on a server, so the file is gitignored. To use it
locally, copy `02 Variable/webfonts/YekanBakh-VF.woff2` from the purchased package to
`public/fonts/yekanbakh/YekanBakh-VF.woff2`. Without it, Persian text falls back to Vazirmatn and
the `fa` screenshot baselines are skipped.

Use the variable axes through standard CSS: `font-weight` (Tailwind `font-medium`, `font-bold`, …)
and `font-stretch` (`font-stretch-condensed`, `font-stretch-[87.5%]`, …). Don't set
`font-variation-settings` directly; it would override both axes everywhere.
