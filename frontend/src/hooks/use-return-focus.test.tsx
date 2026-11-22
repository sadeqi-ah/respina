import { act, render, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { focusReturnTarget, useReturnFocus } from "./use-return-focus";

function setup() {
  render(
    <>
      <button type="button">Add service</button>
      <button type="button" aria-controls="menu-1">
        Actions
      </button>
      <div role="menu" id="menu-1">
        <div role="menuitem">View history</div>
      </div>
      <div role="menu">
        <div role="menuitem">Orphan</div>
      </div>
    </>,
  );
  const [add, actions] = document.querySelectorAll("button");
  const [item, orphan] = document.querySelectorAll("[role=menuitem]");
  return { add, actions, item, orphan };
}

describe("focusReturnTarget", () => {
  it("returns a plain opener as is", () => {
    const { add } = setup();
    expect(focusReturnTarget(add)).toBe(add);
  });

  it("swaps a menu item for its menu's trigger", () => {
    const { actions, item } = setup();
    expect(focusReturnTarget(item)).toBe(actions);
  });

  it("gives up on a menu it can't link to a trigger, or no opener", () => {
    const { orphan } = setup();
    expect(focusReturnTarget(orphan)).toBeNull();
    expect(focusReturnTarget(null)).toBeNull();
  });
});

describe("useReturnFocus", () => {
  const closeEvent = () => new Event("focusScope.autoFocusOnUnmount", { cancelable: true });

  it("focuses the opener on close and takes over from Radix's default", () => {
    const { add } = setup();
    const { result } = renderHook(() => useReturnFocus());
    act(() => result.current.remember(add));
    const event = closeEvent();
    act(() => result.current.onCloseAutoFocus(event));
    expect(document.activeElement).toBe(add);
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves Radix's default alone when the opener is gone", () => {
    // A plain node, so removing it doesn't fight React's cleanup.
    const opener = document.createElement("button");
    document.body.append(opener);
    const { result } = renderHook(() => useReturnFocus());
    act(() => result.current.remember(opener));
    opener.remove();
    const event = closeEvent();
    act(() => result.current.onCloseAutoFocus(event));
    expect(event.defaultPrevented).toBe(false);
  });

  it("forgets the opener after one close", () => {
    const { add } = setup();
    const { result } = renderHook(() => useReturnFocus());
    act(() => result.current.remember(add));
    act(() => result.current.onCloseAutoFocus(closeEvent()));
    const second = closeEvent();
    act(() => result.current.onCloseAutoFocus(second));
    expect(second.defaultPrevented).toBe(false);
  });
});
