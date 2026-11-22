import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { defaultLocale, isLocale, localeCookie } from "./config";

// No URL prefix: the locale comes from the NEXT_LOCALE cookie, falling back to English.
export default getRequestConfig(async () => {
  const cookieValue = (await cookies()).get(localeCookie)?.value;
  const locale = isLocale(cookieValue) ? cookieValue : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    timeZone: "UTC",
  };
});
