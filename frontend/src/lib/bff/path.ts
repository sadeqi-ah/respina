/**
 * Proxy path allowlist (BFF → Django). The proxy only forwards to `/api/v1/…`, so it can't be
 * used as an open proxy (SSRF) or to reach Django's admin, schema or health endpoints.
 *
 * Each segment must be a plain slug: letters, digits, `_` and `-`. That rules out `..`, `.`,
 * empty segments, encoded slashes, `:` (absolute URLs) and anything percent-encoded.
 * Django routes end with a slash, so one is always appended.
 */
const SEGMENT = /^[A-Za-z0-9_-]+$/;
const MAX_SEGMENTS = 8;

export function toDjangoPath(segments: readonly string[]): string | null {
  if (segments.length === 0 || segments.length > MAX_SEGMENTS) return null;
  if (!segments.every((s) => SEGMENT.test(s))) return null;
  return `/api/v1/${segments.join("/")}/`;
}
