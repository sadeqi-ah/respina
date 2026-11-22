import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { HomeRedirect } from "@/features/shell/HomeRedirect";
import { homePath, readSessionClaims } from "@/lib/session-claims";

/**
 * Staff → the customer list; a customer → their own record. Decided here from the session's role
 * claims, so "/" (where sign-in lands) never renders: the shell first appears as the right page.
 */
export default async function Home() {
  const claims = readSessionClaims((await cookies()).get("access_token")?.value);
  if (claims) redirect(homePath(claims));
  return <HomeRedirect />;
}
