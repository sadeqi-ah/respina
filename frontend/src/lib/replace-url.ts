/**
 * Replaces the URL without a server round trip, for state that lives in the query string (tab,
 * filters, page, search, sort). Next keeps useSearchParams and usePathname in sync with the native
 * History API; router.replace would also re-render the page on the server for every change, which
 * costs a full round trip (~600ms on slow 4G) before the UI could react. No history entry, no scroll.
 */
export function replaceUrl(url: string) {
  window.history.replaceState(null, "", url);
}
