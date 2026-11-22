"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSyncExternalStore, type MouseEvent } from "react";
import { flushSync } from "react-dom";

import { DashboardButton } from "@/components/block/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { revealOrigin, revealRadius } from "./circular-reveal";

const REVEAL_MS = 450;
const EASE_OUT = "cubic-bezier(0.25, 1, 0.5, 1)";

// The theme is only known in the browser, so pressed state waits for hydration to avoid a mismatch.
const subscribeNoop = () => () => {};
const useIsClient = () =>
  useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

/**
 * Switches between light and dark. With the View Transitions API the new theme grows as a circle
 * from the click point; without it, or with reduced motion, it switches at once. The switch itself
 * never waits for the animation.
 */
export function ThemeToggle({ variant }: { variant: "shell" | "page" }) {
  const t = useTranslations("common");
  const { resolvedTheme, setTheme } = useTheme();
  const isClient = useIsClient();
  const isDark = isClient && resolvedTheme === "dark";

  const toggle = (event: MouseEvent<HTMLButtonElement>) => {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (typeof document.startViewTransition !== "function" || reduceMotion) {
      setTheme(next);
      return;
    }

    const { x, y } = revealOrigin(event, event.currentTarget.getBoundingClientRect());
    const radius = revealRadius(x, y, window.innerWidth, window.innerHeight);
    // flushSync so the class is on <html> when the browser captures the new snapshot.
    const transition = document.startViewTransition(() => flushSync(() => setTheme(next)));
    transition.ready
      .then(() =>
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: REVEAL_MS, easing: EASE_OUT, pseudoElement: "::view-transition-new(root)" },
        ),
      )
      // A skipped transition (another one started, tab hidden) still applies the theme.
      .catch(() => {});
  };

  const label = t("darkMode");
  const icons = (
    <>
      {/* Both icons render and CSS picks one, so the server HTML matches whatever theme loads. */}
      <Moon aria-hidden className="dark:hidden" />
      <Sun aria-hidden className="hidden dark:block" />
    </>
  );
  const shared = {
    "aria-label": label,
    "aria-pressed": isClient ? isDark : undefined,
    onClick: toggle,
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {variant === "shell" ? (
          <DashboardButton variant="secondary" size="icon" {...shared}>
            {icons}
          </DashboardButton>
        ) : (
          <Button variant="ghost" size="icon" {...shared}>
            {icons}
          </Button>
        )}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
