import type { BrowserContext, Page } from "@playwright/test";

/**
 * Fixed API data for visual tests: the browser's /api/backend/* calls are answered here, so the
 * pixels never depend on what's in the database. The placeholder cookie only gets past proxy.ts,
 * which checks that a session cookie exists; it is never sent on to Django.
 */
const NAMES = [
  ["Sara", "Ahmadi"],
  ["Reza", "Karimi"],
  ["Maryam", "Hosseini"],
  ["Ali", "Rezaei"],
  ["Neda", "Moradi"],
  ["Omid", "Jafari"],
  ["Leila", "Ebrahimi"],
  ["Kian", "Sadeghi"],
] as const;

export const customers = NAMES.map(([first, last], i) => ({
  id: i + 1,
  first_name: first,
  last_name: last,
  full_name: `${first} ${last}`,
  email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
  phone: `+98912000${String(1000 + i)}`,
  services_count: (i * 3) % 5,
  created_at: `2026-11-${String(20 - i).padStart(2, "0")}T09:30:00Z`,
}));

const TYPES = ["cloud_server", "vps", "dedicated_server", "object_storage", "managed_database"] as const;

export const services = [
  "api-production-eu",
  "web-staging",
  "db-primary",
  "backup-archive",
  "ci-runner-02",
].map((name, i) => ({
  id: 100 + i,
  customer_id: 1,
  name,
  service_type: TYPES[i],
  service_type_display: TYPES[i],
  status: i === 2 ? "suspended" : "active",
  created_at: `2026-10-${String(10 + i).padStart(2, "0")}T08:00:00Z`,
  updated_at: `2026-10-${String(10 + i).padStart(2, "0")}T08:00:00Z`,
}));

const page = <T>(results: T[]) => ({
  count: results.length,
  page: 1,
  page_size: 20,
  total_pages: 1,
  results,
});

export async function mockApi(
  context: BrowserContext,
  browserPage: Page,
  baseURL: string,
  locale: "en" | "fa",
) {
  await context.addCookies([
    { name: "NEXT_LOCALE", value: locale, url: baseURL },
    { name: "access_token", value: "e2e-placeholder", url: baseURL },
  ]);
  await browserPage.route("**/api/backend/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/backend/", "");
    if (path === "auth/me")
      return route.fulfill({ json: { id: 1, email: "admin@example.com", role: "staff", customer_id: null } });
    if (path === "customers") return route.fulfill({ json: page(customers) });
    if (path === "customers/1")
      return route.fulfill({ json: { ...customers[0], services_count: services.length } });
    if (path === "customers/1/services") return route.fulfill({ json: page(services) });
    return route.fulfill({
      status: 404,
      json: { error: { code: "not_found", message: "Not found.", request_id: "e2e" } },
    });
  });
}
