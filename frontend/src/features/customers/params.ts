/**
 * Customer list state lives in the URL (?page=&search=&ordering=) so it survives reloads and can be
 * shared. The URL is user input: anything invalid falls back to a default, never reaches the API.
 */
export const ORDERINGS = ["-created_at", "created_at", "last_name", "-last_name"] as const;
export type Ordering = (typeof ORDERINGS)[number];

export const DEFAULT_ORDERING: Ordering = "-created_at";
export const PAGE_SIZE = 20;
export const MAX_SEARCH_LENGTH = 100;

export type ListParams = { page: number; search: string; ordering: Ordering };

export const DEFAULT_PARAMS: ListParams = { page: 1, search: "", ordering: DEFAULT_ORDERING };

function isOrdering(value: string): value is Ordering {
  return (ORDERINGS as readonly string[]).includes(value);
}

/**
 * Reads list state from the query string.
 *
 * - page:     a positive integer; anything else → 1
 * - search:   trimmed, at most MAX_SEARCH_LENGTH characters; missing → ""
 * - ordering: one of ORDERINGS; anything else → DEFAULT_ORDERING
 */
export function parseListParams(query: URLSearchParams): ListParams {
  // Page: digits only, no leading zero, at most 6 digits. Checked as a string first because
  // Number("1e3") is 1000 and parseInt("1.5") is 1.
  const rawPage = query.get("page") ?? "";
  const page = /^[1-9][0-9]{0,5}$/.test(rawPage) ? Number(rawPage) : DEFAULT_PARAMS.page;

  // Ordering: only values on the allowlist ever reach the API.
  const rawOrdering = query.get("ordering") ?? "";
  const ordering = isOrdering(rawOrdering) ? rawOrdering : DEFAULT_ORDERING;

  // Search: trim, cap by code point (never splits an emoji), then trim again in case the cut
  // landed right after a space.
  const search = Array.from(query.get("search")?.trim() ?? "")
    .slice(0, MAX_SEARCH_LENGTH)
    .join("")
    .trim();

  return { page, search, ordering };
}

/** The query string for `params`, leaving out defaults so URLs stay short. */
export function toQueryString(params: ListParams): string {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.ordering !== DEFAULT_ORDERING) query.set("ordering", params.ordering);
  if (params.page > 1) query.set("page", String(params.page));
  const s = query.toString();
  return s ? `?${s}` : "";
}

export type SortKey = "name" | "created";

/** Column ↔ API ordering. Names read A→Z first; dates show the newest first. */
export const SORT_FIELDS: Record<SortKey, { asc: Ordering; desc: Ordering; first: "asc" | "desc" }> = {
  name: { asc: "last_name", desc: "-last_name", first: "asc" },
  created: { asc: "created_at", desc: "-created_at", first: "desc" },
};

export function sortStateOf(ordering: Ordering): { key: SortKey; direction: "asc" | "desc" } {
  for (const [key, f] of Object.entries(SORT_FIELDS) as [SortKey, (typeof SORT_FIELDS)[SortKey]][]) {
    if (ordering === f.asc) return { key, direction: "asc" };
    if (ordering === f.desc) return { key, direction: "desc" };
  }
  return { key: "created", direction: "desc" };
}

/** Clicking a column: same column flips direction, a new column starts in its natural direction. */
export function nextOrdering(current: Ordering, key: SortKey): Ordering {
  const state = sortStateOf(current);
  const field = SORT_FIELDS[key];
  if (state.key !== key) return field[field.first];
  return state.direction === "asc" ? field.desc : field.asc;
}
