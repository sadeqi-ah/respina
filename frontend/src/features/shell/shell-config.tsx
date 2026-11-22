"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";

import { AppShell } from "./AppShell";

/** What a dashboard page puts in the shell around it: title, header, tabs and toolbar. */
export type ShellConfig = Omit<ComponentProps<typeof AppShell>, "children" | "className">;

const SetShellConfig = createContext<((config: ShellConfig | null) => void) | null>(null);

/**
 * The one AppShell of the dashboard, rendered by its layout so the sidebar and header stay mounted
 * (sidebar width, nav scroll, focus) while pages change below them. A mounted page fills the shell
 * through useShellConfig; until then (server render, a loading page, a page still suspended) the
 * shell shows `fallback`, the route's own title and tabs, so nothing jumps when the page takes over.
 */
export function ShellFrame({ fallback, children }: { fallback: ShellConfig; children: ReactNode }) {
  const [config, setConfig] = useState<ShellConfig | null>(null);
  return (
    <SetShellConfig.Provider value={setConfig}>
      <AppShell {...(config ?? fallback)}>{children}</AppShell>
    </SetShellConfig.Provider>
  );
}

/**
 * Fills the shell for as long as the calling page is mounted. Runs after every render of the page
 * (the config holds its current elements and callbacks) and before paint, so the shell never shows
 * a stale title. On unmount the shell goes back to the route's fallback.
 */
export function useShellConfig(config: ShellConfig) {
  const setConfig = useContext(SetShellConfig);
  if (!setConfig) throw new Error("useShellConfig needs a ShellFrame above it");
  useLayoutEffect(() => setConfig(config));
  useLayoutEffect(() => () => setConfig(null), [setConfig]);
}
