"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { MAX_SEARCH_LENGTH } from "../params";

const DEBOUNCE_MS = 300;

/** Search box for the shell toolbar. Typing updates the URL 300 ms after the last keystroke. */
export function CustomerSearch({ value, onChange }: { value: string; onChange: (search: string) => void }) {
  const t = useTranslations("customers");
  const [draft, setDraft] = useState(value);
  const lastSent = useRef(value);

  // Follow outside changes (back button, "clear search" in the empty state).
  useEffect(() => {
    if (value !== lastSent.current) {
      lastSent.current = value;
      setDraft(value);
    }
  }, [value]);

  useEffect(() => {
    const next = draft.trim();
    if (next === lastSent.current) return;
    const timer = setTimeout(() => {
      lastSent.current = next;
      onChange(next);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, onChange]);

  return (
    <div className="relative w-full max-w-72">
      <Search
        aria-hidden
        className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-(--obsidian-dashboard-shell-text-subtle)"
      />
      <input
        type="search"
        value={draft}
        maxLength={MAX_SEARCH_LENGTH}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchLabel")}
        className="h-8 w-full rounded-md bg-(--obsidian-dashboard-shell-control) ps-8 pe-8 text-xs text-(--obsidian-dashboard-shell-foreground) shadow-(--obsidian-dashboard-shell-control-shadow) outline-none placeholder:text-(--obsidian-dashboard-shell-text-subtle) focus-visible:ring-2 focus-visible:ring-(--obsidian-dashboard-shell-ring) [&::-webkit-search-cancel-button]:hidden"
      />
      {draft && (
        <button
          type="button"
          onClick={() => setDraft("")}
          aria-label={t("clearSearch")}
          className="absolute end-1.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded text-(--obsidian-dashboard-shell-text-subtle) hover:text-(--obsidian-dashboard-shell-foreground)"
        >
          <X aria-hidden className="size-3" />
        </button>
      )}
    </div>
  );
}
