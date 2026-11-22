import { describe, expect, it } from "vitest";

import { revealOrigin, revealRadius } from "./circular-reveal";

const button = { left: 100, top: 10, width: 30, height: 30 };

describe("revealOrigin", () => {
  it("starts at the pointer for a click", () => {
    expect(revealOrigin({ detail: 1, clientX: 107, clientY: 22 }, button)).toEqual({ x: 107, y: 22 });
  });

  it("starts at the button's center for keyboard activation", () => {
    // Enter and Space fire click with detail 0 and the pointer's last (unrelated) position.
    expect(revealOrigin({ detail: 0, clientX: 0, clientY: 0 }, button)).toEqual({ x: 115, y: 25 });
  });
});

describe("revealRadius", () => {
  it("reaches the farthest corner", () => {
    expect(revealRadius(0, 0, 300, 400)).toBe(500);
    expect(revealRadius(300, 400, 300, 400)).toBe(500);
    // From the top end of a 1280×800 header: the bottom-start corner is farthest.
    expect(revealRadius(1210, 29, 1280, 800)).toBeCloseTo(Math.hypot(1210, 771));
  });

  it("covers the viewport from its center", () => {
    expect(revealRadius(640, 400, 1280, 800)).toBeCloseTo(Math.hypot(640, 400));
  });
});
