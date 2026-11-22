/**
 * Geometry for the theme switch's circular reveal: where the circle grows from and how far it has
 * to grow to cover the whole viewport.
 */

/** Pointer clicks start at the pointer; keyboard activation (`detail === 0`) at the button's center. */
export function revealOrigin(
  event: { detail: number; clientX: number; clientY: number },
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  if (event.detail === 0) return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  return { x: event.clientX, y: event.clientY };
}

/** The distance from (x, y) to the farthest viewport corner. */
export function revealRadius(x: number, y: number, width: number, height: number): number {
  return Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
}
