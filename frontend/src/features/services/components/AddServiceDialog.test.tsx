import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import en from "@/messages/en.json";
import { renderWithProviders } from "@/test/render";

import { AddServiceDialog } from "./AddServiceDialog";

describe("AddServiceDialog", () => {
  it("closes on Cancel without validating the empty form", async () => {
    const onOpenChange = vi.fn();
    renderWithProviders(<AddServiceDialog customerId={3} open onOpenChange={onOpenChange} />);

    await userEvent.click(screen.getByRole("button", { name: en.services.cancel }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("textbox", { name: en.services.add.name })).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.queryByText(en.validation.required)).not.toBeInTheDocument();
  });

  it("still validates on submit", async () => {
    renderWithProviders(<AddServiceDialog customerId={3} open onOpenChange={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: en.services.add.submit }));

    expect(await screen.findByRole("textbox", { name: en.services.add.name })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});
