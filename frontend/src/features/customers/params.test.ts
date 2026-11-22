import { describe, expect, it } from "vitest";

import {
  customerHref,
  DEFAULT_PARAMS,
  listReturnPath,
  MAX_SEARCH_LENGTH,
  nextOrdering,
  parseListParams,
  toQueryString,
} from "./params";

const parse = (qs: string) => parseListParams(new URLSearchParams(qs));

describe("parseListParams (the URL is user input)", () => {
  it("empty query → defaults", () => {
    expect(parse("")).toEqual(DEFAULT_PARAMS);
  });

  it("reads valid values", () => {
    expect(parse("page=3&search=ali&ordering=last_name")).toEqual({
      page: 3,
      search: "ali",
      ordering: "last_name",
    });
  });

  it.each(["0", "-2", "1.5", "abc", "", "1e3", " 2", "9".repeat(30)])("page=%j → 1", (page) => {
    expect(parse(`page=${encodeURIComponent(page)}`).page).toBe(1);
  });

  it.each(["password", "-password", "created", "last_name,email", ""])("ordering=%j → default", (o) => {
    expect(parse(`ordering=${encodeURIComponent(o)}`).ordering).toBe("-created_at");
  });

  it("trims and caps search", () => {
    expect(parse("search=%20%20ali%20%20").search).toBe("ali");
    expect(parse(`search=${"x".repeat(500)}`).search).toHaveLength(MAX_SEARCH_LENGTH);
  });

  it("round-trips through toQueryString", () => {
    const params = { page: 2, search: "ali rezaei", ordering: "last_name" as const };
    expect(parse(toQueryString(params).slice(1))).toEqual(params);
    expect(toQueryString(DEFAULT_PARAMS)).toBe("");
  });
});

describe("nextOrdering", () => {
  it("a new column starts in its natural direction", () => {
    expect(nextOrdering("-created_at", "name")).toBe("last_name");
    expect(nextOrdering("last_name", "created")).toBe("-created_at");
  });
  it("the same column flips", () => {
    expect(nextOrdering("last_name", "name")).toBe("-last_name");
    expect(nextOrdering("-created_at", "created")).toBe("created_at");
  });
});

describe("listReturnPath (?from= becomes an href: no open redirect)", () => {
  it("keeps the list's page, search and ordering", () => {
    expect(listReturnPath("/customers?search=ali&page=2&ordering=last_name")).toBe(
      "/customers?search=ali&ordering=last_name&page=2",
    );
    expect(listReturnPath("/customers")).toBe("/customers");
  });

  it.each([
    null,
    "",
    "//evil.com",
    "//evil.com/customers",
    "/\\evil.com",
    "\\\\evil.com",
    "https://evil.com/customers",
    "http://localhost:3000/customers",
    "javascript:alert(1)",
    "customers",
    "/customers/12",
    "/customers/new",
    "/customersx",
    "/login?next=/customers",
    "/customers/../admin",
    "/%2F%2Fevil.com",
  ])("%j → /customers", (from) => {
    expect(listReturnPath(from)).toBe("/customers");
  });

  it("drops anything but the list params", () => {
    expect(listReturnPath("/customers?page=2&next=https://evil.com&ordering=password#x")).toBe(
      "/customers?page=2",
    );
  });
});

describe("customerHref", () => {
  it("leaves the default list view out of the URL", () => {
    expect(customerHref(7, DEFAULT_PARAMS)).toBe("/customers/7");
  });

  it("round-trips the list state through ?from=", () => {
    const list = { page: 2, search: "ali rezaei", ordering: "last_name" as const };
    const from = new URL(customerHref(7, list), "http://x").searchParams.get("from");
    expect(listReturnPath(from)).toBe(`/customers${toQueryString(list)}`);
  });
});
