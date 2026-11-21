import { describe, expect, it } from "vitest";

import en from "./en.json";
import fa from "./fa.json";

function keys(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

describe("message files", () => {
  it("en and fa have identical key sets", () => {
    expect(keys(fa).sort()).toEqual(keys(en).sort());
  });

  it("has no empty translations", () => {
    for (const [locale, messages] of Object.entries({ en, fa })) {
      const empty = keys(messages).filter((k) => {
        const v = k.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)?.[p], messages);
        return typeof v === "string" && v.trim() === "";
      });
      expect(empty, locale).toEqual([]);
    }
  });
});
