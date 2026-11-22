"use client";

import { useTranslations } from "next-intl";

import {
  DashboardMenuLabel,
  DashboardMenuRadioGroup,
  DashboardMenuRadioItem,
} from "@/components/block/dashboard-shell";

import { revealOrigin } from "./circular-reveal";
import { THEME_CHOICES, useThemeSwitch } from "./use-theme-switch";

/**
 * Light / Dark / System for a DashboardMenu. Unlike the header toggle it can go back to following
 * the OS. The reveal grows from the chosen item: Radix's select event has no pointer position, so
 * the item's center stands in for it.
 */
export function ThemeMenuGroup() {
  const t = useTranslations("common");
  const { theme, switchTheme } = useThemeSwitch();

  return (
    <>
      <DashboardMenuLabel>{t("theme")}</DashboardMenuLabel>
      <DashboardMenuRadioGroup value={theme ?? "system"}>
        {THEME_CHOICES.map((choice) => (
          <DashboardMenuRadioItem
            key={choice}
            value={choice}
            onSelect={(event) => {
              const item = event.target as HTMLElement;
              switchTheme(
                choice,
                revealOrigin({ detail: 0, clientX: 0, clientY: 0 }, item.getBoundingClientRect()),
              );
            }}
          >
            {t(`themes.${choice}`)}
          </DashboardMenuRadioItem>
        ))}
      </DashboardMenuRadioGroup>
    </>
  );
}
