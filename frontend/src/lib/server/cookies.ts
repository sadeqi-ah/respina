import "server-only";

import type { NextResponse } from "next/server";

import { secondsUntilExpiry, type Tokens } from "@/lib/bff/tokens";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

const secure = process.env.COOKIE_SECURE === "true";

function base(maxAge: number) {
  // httpOnly: browser JS can never read a token. SameSite=Lax + the X-Requested-With check in the
  // proxy are the CSRF defence for mutating calls.
  return { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge };
}

export function setAuthCookies(response: NextResponse, tokens: Tokens): void {
  response.cookies.set(ACCESS_COOKIE, tokens.access, base(secondsUntilExpiry(tokens.access) ?? 15 * 60));
  response.cookies.set(
    REFRESH_COOKIE,
    tokens.refresh,
    base(secondsUntilExpiry(tokens.refresh) ?? 7 * 24 * 3600),
  );
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set(ACCESS_COOKIE, "", base(0));
  response.cookies.set(REFRESH_COOKIE, "", base(0));
}
