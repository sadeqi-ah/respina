import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";
import en from "@/messages/en.json";
import fa from "@/messages/fa.json";
import { renderWithProviders } from "@/test/render";

import DashboardError from "./error";

describe("dashboard error boundary", () => {
  it("explains a crash without leaking its message, and retries", async () => {
    const retry = vi.fn();
    renderWithProviders(<DashboardError error={new TypeError("x is undefined")} retry={retry} />);

    expect(screen.getByRole("alert")).toHaveTextContent(en.errors.unknown_error);
    expect(screen.queryByText(/x is undefined/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: en.common.retry }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("shows an API error's own reason and request ID", () => {
    const error = new ApiError(503, "dependency_unavailable", "down", {}, "req-1");
    renderWithProviders(<DashboardError error={error} retry={() => {}} />, { locale: "fa" });
    expect(screen.getByRole("alert")).toHaveTextContent(fa.errors.dependency_unavailable);
    expect(screen.getByText("req-1")).toBeInTheDocument();
  });
});
