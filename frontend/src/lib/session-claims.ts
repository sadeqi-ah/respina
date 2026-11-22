/**
 * The role claims in the session's access token (a JWT), read without verifying it: for UX only,
 * such as where "/" goes. Django verifies the token and authorizes every request, so a forged
 * cookie at most sends someone to a page whose data they can't load.
 */
export type SessionClaims = { role: "staff" | "customer"; customer_id: number | null };

export function readSessionClaims(token: string | undefined): SessionClaims | null {
  const payload = token?.split(".")[1];
  if (!payload) return null;
  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof claims !== "object" || claims === null) return null;
    const { role, customer_id } = claims as Record<string, unknown>;
    if (role !== "staff" && role !== "customer") return null;
    return {
      role,
      customer_id:
        Number.isSafeInteger(customer_id) && (customer_id as number) > 0 ? (customer_id as number) : null,
    };
  } catch {
    return null;
  }
}

/** Where a signed-in user's home is: staff → the customer list; a customer → their own record. */
export function homePath(claims: Pick<SessionClaims, "role" | "customer_id">): string {
  return claims.role === "customer" && claims.customer_id ? `/customers/${claims.customer_id}` : "/customers";
}
