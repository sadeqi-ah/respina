import { describe, expect, it } from "vitest";

import { DEFAULT_PARAMS, MAX_SEARCH_LENGTH, nextOrdering, parseListParams, toQueryString } from "./params";

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
