import type { Metadata } from "next";
import { Geist, Geist_Mono, Vazirmatn } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { DirectionProvider } from "@/components/ui/direction";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { directions } from "@/i18n/config";

import "./globals.css";

// Both fonts set --font-sans; the layout applies the one for the current locale.
const geist = Geist({ variable: "--font-sans", subsets: ["latin"] });
const vazirmatn = Vazirmatn({ variable: "--font-sans", subsets: ["arabic", "latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return { title: t("appName"), description: t("appDescription") };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const dir = directions[locale];
  const font = locale === "fa" ? vazirmatn : geist;

  return (
    <html lang={locale} dir={dir} className={`${font.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <DirectionProvider dir={dir}>
            <TooltipProvider>
              {children}
              <Toaster position={dir === "rtl" ? "bottom-left" : "bottom-right"} />
            </TooltipProvider>
          </DirectionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
