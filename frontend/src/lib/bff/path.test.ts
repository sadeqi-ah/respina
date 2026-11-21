import { describe, expect, it } from "vitest";

import { toDjangoPath } from "./path";

describe("toDjangoPath (proxy allowlist)", () => {
  it.each([
    [["customers"], "/api/v1/customers/"],
    [["customers", "12", "services"], "/api/v1/customers/12/services/"],
    [["services", "125", "status-history"], "/api/v1/services/125/status-history/"],
    [["auth", "me"], "/api/v1/auth/me/"],
  ])("maps %j to %s", (segments, expected) => {
    expect(toDjangoPath(segments)).toBe(expected);
  });

  it.each([
    ["parent traversal", ["..", "admin"]],
    ["traversal after a segment", ["customers", "..", "..", "admin"]],
    ["dot segment", [".", "customers"]],
    ["empty path", []],
    ["empty segment", ["customers", ""]],
    ["absolute URL", ["http:", "", "evil.example", "x"]],
    ["scheme in one segment", ["http://evil.example"]],
    ["encoded slash (already decoded by Next)", ["customers/../../admin"]],
    ["percent sign", ["%2e%2e"]],
    ["backslash", ["..\\admin"]],
    ["query smuggling", ["customers?x=1"]],
    ["unicode lookalike", ["custоmers"]], // Cyrillic о
    ["too many segments", Array.from({ length: 9 }, () => "a")],
  ])("rejects %s", (_name, segments) => {
    expect(toDjangoPath(segments)).toBeNull();
  });
});
