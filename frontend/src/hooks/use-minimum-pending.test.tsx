import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DELAY_MS,
  MIN_VISIBLE_MS,
  resetSkeletonTiming,
  skeletonMounted,
} from "@/components/states/skeleton-timing";

import { useMinimumPending } from "./use-minimum-pending";

describe("useMinimumPending", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetSkeletonTiming();
  });
  afterEach(() => vi.useRealTimers());

  const render = () =>
    renderHook(({ pending }) => useMinimumPending(pending), { initialProps: { pending: true } });

  it("follows a load that ends before its skeleton shows", () => {
    const { result, rerender } = render();
    skeletonMounted(0);
    act(() => vi.advanceTimersByTime(DELAY_MS - 10));
    rerender({ pending: false });
    expect(result.current).toBe(false);
  });

  it("holds a skeleton on screen for its minimum time", () => {
    const { result, rerender } = render();
    skeletonMounted(0);
    act(() => vi.advanceTimersByTime(DELAY_MS + 100)); // on screen for 100ms
    rerender({ pending: false });
    expect(result.current).toBe(true);
    act(() => vi.advanceTimersByTime(MIN_VISIBLE_MS - 101));
    expect(result.current).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(false);
  });

  it("never holds a load that was not pending", () => {
    skeletonMounted(0); // some other area's skeleton
    act(() => vi.advanceTimersByTime(DELAY_MS + 10));
    const { result } = renderHook(() => useMinimumPending(false));
    expect(result.current).toBe(false);
  });
});
