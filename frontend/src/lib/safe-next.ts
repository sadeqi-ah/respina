/**
 * Post-login redirect target. Only same-origin paths are allowed, so `?next=` can't send a user to
 * another site (open redirect). Browsers treat `//host` and `/\host` as protocol-relative URLs.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (/[\u0000-\u001f]/.test(next)) return "/"; // control chars (e.g. "/\t/evil.example")
  return next;
}
