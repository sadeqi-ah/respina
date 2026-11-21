import { SERVICE_STATUSES, SERVICE_TYPES, type ServiceStatus, type ServiceType } from "@/types/api";

/** Customer detail state in the URL: ?tab=&status=&type=&page=. Invalid values fall back to defaults. */
export const TABS = ["services", "details"] as const;
export type Tab = (typeof TABS)[number];

export type ServiceFilters = { status: ServiceStatus | null; type: ServiceType | null; page: number };
export type DetailParams = { tab: Tab } & ServiceFilters;

export const SERVICES_PAGE_SIZE = 20;

const oneOf = <T extends string>(list: readonly T[], value: string | null): T | null =>
  value !== null && (list as readonly string[]).includes(value) ? (value as T) : null;

export function parseDetailParams(query: URLSearchParams): DetailParams {
  const page = query.get("page") ?? "";
  return {
    tab: oneOf(TABS, query.get("tab")) ?? "services",
    status: oneOf(SERVICE_STATUSES, query.get("status")),
    type: oneOf(SERVICE_TYPES, query.get("type")),
    page: /^[1-9][0-9]{0,5}$/.test(page) ? Number(page) : 1,
  };
}

export function toDetailQuery(params: DetailParams): string {
  const query = new URLSearchParams();
  if (params.tab !== "services") query.set("tab", params.tab);
  if (params.status) query.set("status", params.status);
  if (params.type) query.set("type", params.type);
  if (params.page > 1) query.set("page", String(params.page));
  const s = query.toString();
  return s ? `?${s}` : "";
}
