import { describe, expect, it } from "vitest";

import { parseDetailParams, toDetailQuery } from "./params";

const parse = (qs: string) => parseDetailParams(new URLSearchParams(qs));

describe("parseDetailParams", () => {
  it("defaults to the services tab with no filters", () => {
    expect(parse("")).toEqual({ tab: "services", status: null, type: null, page: 1 });
  });

  it("reads valid values", () => {
    expect(parse("tab=details&status=suspended&type=vps&page=3")).toEqual({
      tab: "details",
      status: "suspended",
      type: "vps",
      page: 3,
    });
  });

  it("drops anything not on the allowlists", () => {
    expect(parse("tab=admin&status=deleted&type=VPS&page=1.5")).toEqual(parse(""));
  });

  it("round-trips, leaving defaults out", () => {
    const params = parse("status=active&type=object_storage&page=2");
    expect(toDetailQuery(params)).toBe("?status=active&type=object_storage&page=2");
    expect(parse(toDetailQuery(params).slice(1))).toEqual(params);
    expect(toDetailQuery(parse(""))).toBe("");
  });
});
