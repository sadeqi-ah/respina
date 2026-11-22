import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardMenu, DashboardMenuContent } from "@/components/block/dashboard-shell";
import en from "@/messages/en.json";
import fa from "@/messages/fa.json";
import { renderWithProviders } from "@/test/render";

import { ThemeMenuGroup } from "./ThemeMenuGroup";

const setTheme = vi.fn();
let theme: string | undefined = "dark";
vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme,
    resolvedTheme: theme === "system" ? "light" : theme,
    systemTheme: "light",
    setTheme,
  }),
}));

function renderMenu(locale: "en" | "fa" = "en") {
  return renderWithProviders(
    <DashboardMenu open>
      <DashboardMenuContent>
        <ThemeMenuGroup />
      </DashboardMenuContent>
    </DashboardMenu>,
    { locale },
  );
}

describe("ThemeMenuGroup", () => {
  beforeEach(() => {
    setTheme.mockReset();
    theme = "dark";
  });

  it("checks the stored choice", () => {
    renderMenu();
    expect(screen.getByRole("menuitemradio", { name: en.common.themes.dark })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("menuitemradio", { name: en.common.themes.system })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("checks System before a choice is stored", () => {
    theme = undefined;
    renderMenu();
    expect(screen.getByRole("menuitemradio", { name: en.common.themes.system })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("goes back to following the OS", async () => {
    renderMenu();
    await userEvent.click(screen.getByRole("menuitemradio", { name: en.common.themes.system }));
    // jsdom has no View Transitions API, so the switch is immediate.
    expect(setTheme).toHaveBeenCalledWith("system");
  });

  it("is translated", () => {
    renderMenu("fa");
    for (const choice of ["light", "dark", "system"] as const) {
      expect(screen.getByRole("menuitemradio", { name: fa.common.themes[choice] })).toBeInTheDocument();
    }
  });
});
