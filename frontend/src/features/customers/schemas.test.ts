import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fa from "@/messages/fa.json";

import { isPlausiblePhone, makeCustomerSchema } from "./schemas";

const schema = makeCustomerSchema((key) => key);

describe("isPlausiblePhone", () => {
  // Every one of these is accepted by Django's normalize_phone (checked against the backend).
  it.each([
    "09121234567",
    "9121234567",
    "+989121234567",
    "00989121234567",
    "0912 123 4567",
    "+98 912-123-4567",
    "(0912) 123-4567",
    "۰۹۱۲۱۲۳۴۵۶۷",
    "٠٩١٢١٢٣٤٥٦٧",
    "+۹۸۹۱۲۱۲۳۴۵۶۷",
    "+14155552671",
  ])("accepts %s", (value) => {
    expect(isPlausiblePhone(value)).toBe(true);
  });

  it.each([
    "abc",
    "0912abc4567",
    "12345",
    "+",
    "++989121234567",
    "0912_123_4567",
    "9".repeat(20),
    "09121234567x",
  ])("rejects %s", (value) => {
    expect(isPlausiblePhone(value)).toBe(false);
  });
});

describe("makeCustomerSchema", () => {
  const valid = {
    first_name: " Sara ",
    last_name: "Ahmadi",
    email: " sara@example.com ",
    phone: "09121234567",
  };

  it("trims names and email", () => {
    expect(schema.parse(valid)).toEqual({ ...valid, first_name: "Sara", email: "sara@example.com" });
  });

  it("reports each field with the translation key", () => {
    const result = schema.safeParse({
      first_name: "  ",
      last_name: "x".repeat(101),
      email: "nope",
      phone: "abc",
    });
    expect(result.success).toBe(false);
    const issues = Object.fromEntries(result.error!.issues.map((i) => [i.path[0], i.message]));
    expect(issues).toEqual({
      first_name: "required",
      last_name: "max_length",
      email: "invalid_email",
      phone: "invalid_phone",
    });
  });
});

describe.each([
  ["en", en],
  ["fa", fa],
] as const)("makeCustomerSchema with %s messages", (locale, messages) => {
  const localized = makeCustomerSchema(createTranslator({ locale, messages, namespace: "validation" }));

  it("reports each problem in the locale's own words", () => {
    const result = localized.safeParse({ first_name: "", last_name: "Ahmadi", email: "nope", phone: "abc" });
    const issues = Object.fromEntries(result.error!.issues.map((i) => [i.path[0], i.message]));
    expect(issues).toEqual({
      first_name: messages.validation.required,
      email: messages.validation.invalid_email,
      phone: messages.validation.invalid_phone,
    });
  });

  it("accepts the phone in Persian digits", () => {
    expect(
      localized.safeParse({
        first_name: "سارا",
        last_name: "احمدی",
        email: "s@example.com",
        phone: "۰۹۱۲۱۲۳۴۵۶۷",
      }).success,
    ).toBe(true);
  });
});
