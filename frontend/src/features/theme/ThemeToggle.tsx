"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore, type MouseEvent } from "react";

import { DashboardButton } from "@/components/block/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { revealOrigin } from "./circular-reveal";
import { useThemeSwitch } from "./use-theme-switch";

// The theme is only known in the browser, so pressed state waits for hydration to avoid a mismatch.
const subscribeNoop = () => () => {};
const useIsClient = () =>
  useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

/**
 * Flips between light and dark, revealing the new theme from the click point (the button's center
 * for keyboard activation). The user menu also offers System; see useThemeSwitch.
 */
export function ThemeToggle({ variant }: { variant: "shell" | "page" }) {
  const t = useTranslations("common");
  const { resolvedTheme, switchTheme } = useThemeSwitch();
  const isClient = useIsClient();
  const isDark = isClient && resolvedTheme === "dark";

  const toggle = (event: MouseEvent<HTMLButtonElement>) =>
    switchTheme(isDark ? "light" : "dark", revealOrigin(event, event.currentTarget.getBoundingClientRect()));

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
