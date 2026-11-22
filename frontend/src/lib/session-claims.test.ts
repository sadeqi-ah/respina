import { describe, expect, it } from "vitest";

import { homePath, readSessionClaims } from "./session-claims";

const jwt = (payload: object) =>
  ["e30", Buffer.from(JSON.stringify(payload)).toString("base64url"), "signature"].join(".");

describe("readSessionClaims", () => {
  it("reads the role claims", () => {
    expect(readSessionClaims(jwt({ role: "customer", customer_id: 7, exp: 1 }))).toEqual({
      role: "customer",
      customer_id: 7,
    });
    expect(readSessionClaims(jwt({ role: "staff", customer_id: null }))).toEqual({
      role: "staff",
      customer_id: null,
    });
  });

  it("ignores anything that isn't a token with a known role", () => {
    for (const token of [undefined, "", "abc", "a.!!!.c", jwt({ role: "admin" }), jwt([1])]) {
      expect(readSessionClaims(token)).toBeNull();
    }
    expect(readSessionClaims(jwt({ role: "customer", customer_id: "7" }))?.customer_id).toBeNull();
  });
});

describe("homePath", () => {
  it("sends staff to the list and a customer to their record", () => {
    expect(homePath({ role: "staff", customer_id: null })).toBe("/customers");
    expect(homePath({ role: "customer", customer_id: 7 })).toBe("/customers/7");
    expect(homePath({ role: "customer", customer_id: null })).toBe("/customers");
  });
});
