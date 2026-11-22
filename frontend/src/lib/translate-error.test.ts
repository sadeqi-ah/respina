import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fa from "@/messages/fa.json";

import { translateError, translateFieldError } from "./translate-error";

describe.each([
  ["en", en],
  ["fa", fa],
] as const)("translateError (%s)", (locale, messages) => {
  const t = createTranslator({ locale, messages, namespace: "errors" });
  const tv = createTranslator({ locale, messages, namespace: "validation" });

  it("translates a known envelope code", () => {
    expect(translateError(t, { code: "invalid_status_transition", message: "Cannot change." })).toBe(
      messages.errors.invalid_status_transition,
    );
  });

  it("falls back to the server message for an unknown code", () => {
    expect(translateError(t, { code: "brand_new_code", message: "Server says no." })).toBe("Server says no.");
  });

  it("translates a known field code and falls back otherwise", () => {
    expect(translateFieldError(tv, { code: "unique", message: "x" })).toBe(messages.validation.unique);
    expect(translateFieldError(tv, { code: "min_value", message: "Too small." })).toBe("Too small.");
  });
});
