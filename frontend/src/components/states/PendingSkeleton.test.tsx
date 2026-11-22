import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fa from "@/messages/fa.json";
import { renderWithProviders } from "@/test/render";

import { PendingSkeleton } from "./PendingSkeleton";

describe("PendingSkeleton", () => {
  const skeleton = () => screen.getByRole("status");

  it("tells screen readers at once, and hides its shape from them", () => {
    renderWithProviders(
      <PendingSkeleton kind="test">
        <span>shape</span>
      </PendingSkeleton>,
    );
    expect(skeleton()).toHaveTextContent(en.common.loading);
    expect(screen.getByText("shape").closest("[aria-hidden]")).not.toBeNull();
  });

  it("is translated", () => {
    renderWithProviders(<PendingSkeleton kind="test">x</PendingSkeleton>, { locale: "fa" });
    expect(skeleton()).toHaveTextContent(fa.common.loading);
  });
});
