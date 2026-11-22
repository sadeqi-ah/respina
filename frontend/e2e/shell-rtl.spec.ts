import { existsSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import en from "../src/messages/en.json";
import fa from "../src/messages/fa.json";
import { mockApi } from "./fixtures";

// Visual baselines of the customers page in both directions (fixture data, no backend).
const WIDTHS = [375, 768, 1280] as const;
const LOCALES = [
  { locale: "en", dir: "ltr", messages: en },
  { locale: "fa", dir: "rtl", messages: fa },
] as const;

// fa baselines are drawn with Yekan Bakh, a licensed font that is gitignored; skip the pixel
// comparison where it isn't installed (e.g. CI). The structural checks always run.
const hasYekanBakh = existsSync(join(__dirname, "../public/fonts/yekanbakh/YekanBakh-VF.woff2"));

for (const { locale, dir, messages } of LOCALES) {
  for (const width of WIDTHS) {
    test(`customers ${locale} @${width}px`, async ({ page, context, baseURL }) => {
      await mockApi(context, page, baseURL!, locale);
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/customers");
      await expect(page.getByRole("table")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);

      await expect(page.locator("html")).toHaveAttribute("dir", dir);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);

      const noHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
      expect(noHorizontalScroll).toBe(true);

      if (width >= 672) {
        // Docked sidebar sits on the inline-start side: left in LTR, right in RTL.
        const handle = page.getByRole("separator", { name: messages.common.resizeSidebar });
        const box = (await handle.boundingBox())!;
        const centre = box.x + box.width / 2;
        if (dir === "ltr") expect(centre).toBeLessThan(width / 2);
        else expect(centre).toBeGreaterThan(width / 2);
      } else {
        // Mobile: the drawer opens flush against the inline-start edge.
        await page.getByRole("button", { name: messages.common.openNavigation }).click();
        const drawer = page.locator('[role="dialog"][aria-modal="true"]');
        await expect(drawer).toBeVisible();
        await page.waitForTimeout(400); // slide-in animation
        const box = (await drawer.boundingBox())!;
        if (dir === "ltr") expect(Math.round(box.x)).toBe(0);
        else expect(Math.round(box.x + box.width)).toBe(width);
        await page.keyboard.press("Escape");
        await expect(drawer).toBeHidden();
      }

      test.skip(locale === "fa" && !hasYekanBakh, "Yekan Bakh not installed; pixel baseline skipped");
      // Next's dev-only indicator would make dev and production screenshots differ.
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await expect(page).toHaveScreenshot(`customers-${locale}-${width}.png`, {
        fullPage: false,
        animations: "disabled",
      });
    });
  }
}
