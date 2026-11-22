"use client";

import { useTheme } from "next-themes";
import { useCallback } from "react";
import { flushSync } from "react-dom";

import { revealRadius } from "./circular-reveal";

export const THEME_CHOICES = ["light", "dark", "system"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

const REVEAL_MS = 450;
const EASE_OUT = "cubic-bezier(0.25, 1, 0.5, 1)";

/**
 * Applies a theme choice. With the View Transitions API the new look grows as a circle from
 * `origin` (viewport px) to the farthest corner; without it, with reduced motion, or when the
 * choice doesn't change what's on screen (System while the OS already matches), it switches at
 * once. The switch itself never waits for the animation.
 */
export function useThemeSwitch() {
  const { theme, resolvedTheme, systemTheme, setTheme } = useTheme();

  const switchTheme = useCallback(
    (next: ThemeChoice, origin: { x: number; y: number }) => {
      const nextLook = next === "system" ? systemTheme : next;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (nextLook === resolvedTheme || typeof document.startViewTransition !== "function" || reduceMotion) {
        setTheme(next);
        return;
      }

      const { x, y } = origin;
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
    },
    [resolvedTheme, systemTheme, setTheme],
  );

  return { theme: theme as ThemeChoice | undefined, resolvedTheme, switchTheme };
}
