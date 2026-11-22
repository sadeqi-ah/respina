import { expect, test, type Page } from "@playwright/test";

import en from "../src/messages/en.json";
import fa from "../src/messages/fa.json";

/**
 * End-to-end smoke against the real stack (BFF → Django → PostgreSQL), once per locale:
 * login → customers → customer detail → change a service's status (and back, leaving data as found).
 *
 * Needs a seeded database (`manage.py seed`) and staff credentials:
 *   E2E_EMAIL=admin@example.com E2E_PASSWORD=… npm run e2e
 */
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const CUSTOMER = "customer1@example.com"; // seeded; owns the documented service below
const SERVICE = "web-prod-docs";

const LOCALES = [
  { locale: "en", dir: "ltr", messages: en },
  { locale: "fa", dir: "rtl", messages: fa },
] as const;

async function toggle(page: Page, messages: typeof en, action: "suspend" | "activate") {
  const row = page.getByRole("row", { name: new RegExp(SERVICE) });
  await row.getByRole("button", { name: messages.services.actionsFor.replace("{name}", SERVICE) }).click();
  await page.getByRole("menuitem", { name: messages.services[action] }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: messages.services[action] }).click();
  const target = action === "suspend" ? "suspended" : "active";
  await expect(row.getByText(messages.services.status[target], { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      messages.services.statusChange[action === "suspend" ? "suspended" : "activated"].replace(
        "{name}",
        SERVICE,
      ),
    ),
  ).toBeVisible();
}

// Both locales flip the same seeded service: run them one after the other, never in parallel.
test.describe.configure({ mode: "serial" });

for (const { locale, dir, messages } of LOCALES) {
  test(`smoke ${locale}: login → customers → detail → change status`, async ({ page, context, baseURL }) => {
    test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run the smoke test");
    await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: baseURL! }]);
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.goto("/customers");
    await expect(page).toHaveURL(/\/login/); // no session yet
    await expect(page.locator("html")).toHaveAttribute("dir", dir);
    await page.getByLabel(messages.auth.email).fill(email!);
    await page.getByLabel(messages.auth.password).fill(password!);
    await page.getByRole("button", { name: messages.auth.submit }).click();

    await expect(page).toHaveURL(/\/customers$/);
    await expect(page.locator("html")).toHaveAttribute("dir", dir);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);

    // The docked sidebar is on the inline-start side: left in LTR, right in RTL.
    const nav = page.getByRole("navigation", { name: messages.common.navigation }).first();
    const box = (await nav.boundingBox())!;
    if (dir === "ltr") expect(box.x + box.width / 2).toBeLessThan(640);
    else expect(box.x + box.width / 2).toBeGreaterThan(640);

    await page.getByRole("searchbox", { name: messages.customers.searchLabel }).fill(CUSTOMER);
    await expect(page.getByRole("row")).toHaveCount(2); // header + the one match
    await page.getByRole("row").nth(1).getByRole("link").first().click();

    await expect(page).toHaveURL(/\/customers\/\d+$/);
    await expect(page.getByRole("row", { name: new RegExp(SERVICE) })).toBeVisible();

    const row = page.getByRole("row", { name: new RegExp(SERVICE) });
    const isActive = await row.getByText(messages.services.status.active, { exact: true }).isVisible();
    // Flip it, then flip it back, so the seed data is unchanged after the run.
    await toggle(page, messages, isActive ? "suspend" : "activate");
    await toggle(page, messages, isActive ? "activate" : "suspend");
  });
}
