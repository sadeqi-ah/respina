import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DELAY_MS,
  isSkeletonHolding,
  MIN_VISIBLE_MS,
  resetSkeletonTiming,
  skeletonMounted,
  skeletonUnmounted,
} from "./skeleton-timing";

describe("skeleton timing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetSkeletonTiming();
  });
  afterEach(() => vi.useRealTimers());

  it("waits before the first skeleton shows", () => {
    expect(skeletonMounted(1000)).toBe(DELAY_MS);
    expect(isSkeletonHolding()).toBe(false);
  });

  it("holds a shown skeleton for its minimum time, then lets go", () => {
    skeletonMounted(1000);
    vi.advanceTimersByTime(DELAY_MS);
    expect(isSkeletonHolding()).toBe(true);
    vi.advanceTimersByTime(MIN_VISIBLE_MS - 1);
    expect(isSkeletonHolding()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isSkeletonHolding()).toBe(false);
  });

  it("holds nothing when the load beat the delay", () => {
    skeletonMounted(1000);
    vi.advanceTimersByTime(DELAY_MS - 50);
    skeletonUnmounted(1000 + DELAY_MS - 50);
    vi.advanceTimersByTime(MIN_VISIBLE_MS);
    expect(isSkeletonHolding()).toBe(false);
  });

  it("carries the timing over to a skeleton that takes over from another", () => {
    skeletonMounted(1000); // a route's loading UI
    skeletonUnmounted(1100);
    expect(skeletonMounted(1120)).toBe(1000 + DELAY_MS - 1120); // finishes the same delay
    vi.advanceTimersByTime(DELAY_MS);
    expect(isSkeletonHolding()).toBe(true); // the run went on: the takeover did not cancel it
    skeletonUnmounted(1400);
    expect(skeletonMounted(1450)).toBeNull(); // already on screen: no second fade-in
  });

  it("starts over after a pause", () => {
    skeletonMounted(1000);
    skeletonUnmounted(1500);
    expect(skeletonMounted(2000)).toBe(DELAY_MS);
  });
});
