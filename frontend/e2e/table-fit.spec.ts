import { expect, test } from "@playwright/test";

import { mockApi } from "./fixtures";

// Tables hide columns by container width. A threshold set too low doesn't scroll the page (the
// shell clips it), it silently cuts off the last columns, row menus included. Sweep every width.
const PAGES = ["/customers", "/customers/1"] as const;

for (const locale of ["en", "fa"] as const) {
  for (const path of PAGES) {
    test(`${path} table fits its container at every width (${locale})`, async ({
      page,
      context,
      baseURL,
    }) => {
      await mockApi(context, page, baseURL!, locale);
      await page.setViewportSize({ width: 360, height: 800 });
      await page.goto(path);
      await expect(page.getByRole("table")).toBeVisible();

      const overflows: string[] = [];
      for (let width = 360; width <= 1440; width += 20) {
        await page.setViewportSize({ width, height: 800 });
        const result = await page.evaluate(() => {
          const table = document.querySelector("table")!;
          const container = table.parentElement!;
          const lastHeader = [...table.querySelectorAll("thead th")]
            .filter((th) => getComputedStyle(th).display !== "none")
            .at(-1)!;
          const c = container.getBoundingClientRect();
          const h = lastHeader.getBoundingClientRect();
          return {
            overflow: table.scrollWidth > container.clientWidth + 1,
            // The actions column must be fully on screen, whichever side it ends up on.
            actionsVisible: h.left >= c.left - 1 && h.right <= c.right + 1,
          };
        });
        if (result.overflow || !result.actionsVisible) overflows.push(`${width}px`);
      }
      expect(overflows, `widths where the table doesn't fit`).toEqual([]);
    });
  }
}
