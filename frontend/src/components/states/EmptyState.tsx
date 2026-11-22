import { AppDots } from "@duo-icons/react";
import type { ReactNode } from "react";

/** Obsidian-style empty view: icon, title, one line of detail, an optional action. */
export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 border-t border-(--obsidian-dashboard-shell-border) px-6 py-16 text-center">
      <span
        aria-hidden
        className="grid size-10 place-items-center rounded-xl bg-(--obsidian-dashboard-shell-muted) text-(--obsidian-dashboard-shell-icon) shadow-(--obsidian-dashboard-shell-control-shadow)"
      >
        <AppDots size={20} />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-(--obsidian-dashboard-shell-text-subtle)">{detail}</p>
      </div>
      {action}
    </div>
  );
}
