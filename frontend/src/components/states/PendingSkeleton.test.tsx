import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "@/messages/en.json";
import fa from "@/messages/fa.json";
import { renderWithProviders } from "@/test/render";

import { PendingSkeleton } from "./PendingSkeleton";
import { DELAY_MS, resetSkeletonTiming } from "./skeleton-timing";

describe("PendingSkeleton", () => {
  let now = 0;
  beforeEach(() => {
    resetSkeletonTiming();
    now = 5000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
  });
  afterEach(() => vi.restoreAllMocks());

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

  it("waits before it shows", () => {
    renderWithProviders(<PendingSkeleton kind="test">x</PendingSkeleton>);
    expect(skeleton()).toHaveClass("skeleton-reveal");
    expect(skeleton().style.getPropertyValue("--skeleton-delay")).toBe(`${DELAY_MS}ms`);
  });

  it("finishes the delay of a skeleton it replaces before that one showed", () => {
    const first = renderWithProviders(<PendingSkeleton kind="route">x</PendingSkeleton>);
    now += 100;
    first.unmount();
    renderWithProviders(<PendingSkeleton kind="page">x</PendingSkeleton>);
    expect(skeleton().style.getPropertyValue("--skeleton-delay")).toBe(`${DELAY_MS - 100}ms`);
  });

  it("does not wait or fade in again when it takes over from a skeleton on screen", () => {
    const first = renderWithProviders(<PendingSkeleton kind="route">x</PendingSkeleton>);
    now += 300;
    first.unmount();
    renderWithProviders(<PendingSkeleton kind="page">x</PendingSkeleton>);
    expect(skeleton().style.animation).toBe("none");
  });

  it("is translated", () => {
    renderWithProviders(<PendingSkeleton kind="test">x</PendingSkeleton>, { locale: "fa" });
    expect(skeleton()).toHaveTextContent(fa.common.loading);
  });
});
