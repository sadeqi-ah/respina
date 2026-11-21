import { describe, expect, it } from "vitest";

import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it.each(["/customers", "/customers/12?tab=services", "/"])("keeps same-site path %s", (p) => {
    expect(safeNext(p)).toBe(p);
  });

  it.each([
    null,
    "",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "customers",
    "/\t/evil.example",
  ])("rejects %j", (p) => {
    expect(safeNext(p)).toBe("/");
  });
});
