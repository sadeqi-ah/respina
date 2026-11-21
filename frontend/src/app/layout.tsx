import type { Metadata } from "next";
import { Geist, Geist_Mono, Vazirmatn } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { QueryProvider } from "@/components/QueryProvider";
import { DirectionProvider } from "@/components/ui/direction";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { directions } from "@/i18n/config";

import "./globals.css";

// en: Geist. fa: Yekan Bakh (self-hosted, see globals.css) with Vazirmatn as the fallback.
// Only the current locale's next/font class is applied, so only that font is preloaded.
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const vazirmatn = Vazirmatn({ variable: "--font-vazirmatn", subsets: ["arabic", "latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

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
    <html lang={locale} dir={dir} className={`${font.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <DirectionProvider dir={dir}>
            <QueryProvider>
              <TooltipProvider>
                {children}
                {/* The app has no dark mode yet: without theme="light" toasts follow the OS and turn dark. */}
                <Toaster
                  theme="light"
                  position={dir === "rtl" ? "bottom-left" : "bottom-right"}
                  containerAriaLabel={t("notifications")}
                />
              </TooltipProvider>
            </QueryProvider>
          </DirectionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
