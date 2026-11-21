"use server";

import { cookies } from "next/headers";

import { isLocale, localeCookie } from "./config";

/** Sets the UI language. The caller runs router.refresh() so server components re-render. */
export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(localeCookie, locale, {
    path: "/",
    sameSite: "lax",
    httpOnly: false, // not a secret; readable for completeness, never trusted for auth
    maxAge: 60 * 60 * 24 * 365,
  });
}
