import type { ReactNode } from "react";

// Pages render their own <AppShell> (title, tabs and toolbar are per page). proxy.ts has already
// sent visitors without a session cookie to /login.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return children;
}
