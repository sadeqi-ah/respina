import { useCallback, useRef } from "react";

/**
 * Where focus goes back to when a dialog opened from `opener` closes. A menu item disappears with
 * its menu, so its menu's trigger stands in for it; Radix only links the two (aria-controls) while
 * the menu is open, so call this when the item is selected.
 */
export function focusReturnTarget(opener: Element | null): HTMLElement | null {
  const menu = opener?.closest<HTMLElement>("[role=menu]");
  if (menu) {
    return menu.id
      ? opener!.ownerDocument.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(menu.id)}"]`)
      : null;
  }
  return opener instanceof HTMLElement ? opener : null;
}

/**
 * Returns focus to whatever opened a dialog. Radix only does this for a `DialogTrigger`; ours open
 * from state (a header button, a row menu), so without this focus falls to <body> on close.
 *
 * Call `remember(event.currentTarget)` where the dialog is opened — the element, not
 * document.activeElement, because Safari doesn't focus buttons on click — and pass
 * `onCloseAutoFocus` to the dialog's content.
 */
export function useReturnFocus() {
  const target = useRef<HTMLElement | null>(null);

  const remember = useCallback((opener: Element | null) => {
    target.current = focusReturnTarget(opener);
  }, []);

  const onCloseAutoFocus = useCallback((event: Event) => {
    const element = target.current;
    target.current = null;
    if (!element?.isConnected) return; // Radix's default (its trigger, if any) still applies
    event.preventDefault();
    element.focus();
  }, []);

  return { remember, onCloseAutoFocus };
}
