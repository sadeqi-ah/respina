import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import { Toaster } from "sonner";

import { DirectionProvider } from "@/components/ui/direction";
import en from "@/messages/en.json";
import fa from "@/messages/fa.json";

const messages = { en, fa } as const;
type Locale = keyof typeof messages;

/** Renders `ui` with the app's providers: intl (en by default), direction, a fresh query client, toasts. */
export function renderWithProviders(
  ui: ReactElement,
  {
    locale = "en",
    queryClient,
    ...options
  }: { locale?: Locale; queryClient?: QueryClient } & RenderOptions = {},
) {
  const client = queryClient ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone="UTC">
      <DirectionProvider dir={locale === "fa" ? "rtl" : "ltr"}>
        <QueryClientProvider client={client}>
          {children}
          <Toaster />
        </QueryClientProvider>
      </DirectionProvider>
    </NextIntlClientProvider>
  );
  return { queryClient: client, ...render(ui, { wrapper: Wrapper, ...options }) };
}
