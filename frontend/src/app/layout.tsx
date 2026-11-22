import type { Metadata } from "next";
import { Geist, Geist_Mono, Vazirmatn } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { ThemeProvider } from "next-themes";

import { QueryProvider } from "@/components/QueryProvider";
import { DirectionProvider } from "@/components/ui/direction";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { directions } from "@/i18n/config";

import "./globals.css";

// en: Geist. fa: Yekan Bakh (self-hosted, see globals.css) with Vazirmatn as the fallback.
// Only the current locale's font class is applied, so only its family is used. next/font still
// preloads every font this module declares (per route, at build time), whichever locale renders.
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const vazirmatn = Vazirmatn({ variable: "--font-vazirmatn", subsets: ["arabic", "latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

/** Never locale-dependent; see the comment in RootLayout (layout.test.tsx holds it to that). */
const HTML_CLASS_NAME = "h-full antialiased";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return { title: t("appName"), description: t("appDescription") };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const t = await getTranslations("common");
  const dir = directions[locale];
  const font = locale === "fa" ? vazirmatn : geist;

  return (
    // next-themes adds the theme class to <html> outside React, so React must never rewrite its
    // className: it is the same for every locale, and the locale's font classes live on <body>.
    // suppressHydrationWarning covers the class next-themes adds before hydration.
    <html suppressHydrationWarning lang={locale} dir={dir} className={HTML_CLASS_NAME}>
      <body className={`${font.variable} ${geistMono.variable} flex min-h-full flex-col`}>
        {/* The choice lives in localStorage and is applied by an inline script before first paint,
            so there is no flash and nothing for the server to read (see ADR-011). */}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <NextIntlClientProvider>
            <DirectionProvider dir={dir}>
              <QueryProvider>
                <TooltipProvider>
                  {children}
                  <Toaster
                    position={dir === "rtl" ? "bottom-left" : "bottom-right"}
                    containerAriaLabel={t("notifications")}
                  />
                </TooltipProvider>
              </QueryProvider>
            </DirectionProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
