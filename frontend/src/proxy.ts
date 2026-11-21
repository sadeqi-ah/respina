import { NextResponse, type NextRequest } from "next/server";

/**
 * Next 16 "proxy" (formerly middleware). UX only: send visitors without a session cookie to
 * /login. It checks that a cookie exists, nothing more; Django authorizes every request.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("access_token") || request.cookies.has("refresh_token");
  if (hasSession) return NextResponse.next();

  const login = new URL("/login", request.url);
  const next = request.nextUrl.pathname + request.nextUrl.search;
  if (next !== "/") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except the login page, API routes, Next assets, public files and the temporary
  // /dashboard demo route (removed with the 2.2 baselines in Task 2.8).
  matcher: ["/((?!login|api/|_next/|fonts/|favicon\\.ico|dashboard).*)"],
};
