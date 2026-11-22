import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// next/font only works inside Next's compiler; each font just needs a distinct variable class.
vi.mock("next/font/google", () => {
  const font = ({ variable }: { variable: string }) => ({ variable: `font${variable}`, className: "" });
  return { Estedad: font, Geist: font, Geist_Mono: font };
});

let locale = "en";
vi.mock("next-intl/server", () => ({
  getLocale: async () => locale,
  getTranslations: async () => (key: string) => key,
}));

const { default: RootLayout } = await import("./layout");

type Props = { className?: string; lang?: string; dir?: string; children?: ReactElement<Props> };

async function renderFor(next: string) {
  locale = next;
  const html = (await RootLayout({ children: null } as never)) as ReactElement<Props>;
  return { html: html.props, body: html.props.children!.props };
}

describe("RootLayout", () => {
  beforeEach(() => {
    locale = "en";
  });

  // next-themes adds `dark` to <html> outside React. If <html>'s className differed between
  // locales, the router.refresh() after a language switch would make React rewrite it and drop
  // the theme until the next full reload.
  it("renders the same <html> className for every locale", async () => {
    const en = await renderFor("en");
    const fa = await renderFor("fa");
    expect(fa.html.className).toBe(en.html.className);
    expect(en.html.className).not.toMatch(/font-/);
  });

  it("still switches lang and dir on <html>", async () => {
    expect((await renderFor("en")).html).toMatchObject({ lang: "en", dir: "ltr" });
    expect((await renderFor("fa")).html).toMatchObject({ lang: "fa", dir: "rtl" });
  });

  it("puts only the current locale's font on <body>", async () => {
    const en = (await renderFor("en")).body.className;
    const fa = (await renderFor("fa")).body.className;
    expect(en).toContain("font--font-geist ");
    expect(en).not.toContain("--font-estedad");
    expect(fa).toContain("font--font-estedad ");
    expect(fa).not.toContain("--font-geist ");
    expect(en).toContain("font--font-geist-mono");
  });
});
