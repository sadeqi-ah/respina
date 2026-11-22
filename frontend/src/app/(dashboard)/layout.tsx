import type { ReactNode } from "react";

import { DashboardFrame } from "@/features/shell/DashboardFrame";

// One shell for every dashboard page, so the sidebar and header stay mounted between pages; each page
// fills in its title, tabs and toolbar (useShellConfig). proxy.ts has already sent visitors without a
// session cookie to /login.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardFrame>{children}</DashboardFrame>;
}
