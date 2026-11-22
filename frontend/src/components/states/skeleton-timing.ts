/**
 * When loading placeholders appear and how long they stay. A load that finishes within DELAY_MS
 * shows no skeleton at all; once one is on screen it stays for at least MIN_VISIBLE_MS, so it never
 * blinks. Skeletons that replace each other (a route's loading UI, then the page's own skeleton for
 * the same area) form one run that keeps its timing, instead of each starting its delay over.
 *
 * There is one content area, so there is one run at a time: module state, read by components
 * through subscribeSkeletonHold / isSkeletonHolding (useSyncExternalStore).
 */
export const DELAY_MS = 150;
export const MIN_VISIBLE_MS = 400;
/** A skeleton mounted this soon after the last one went away continues its run. */
const HANDOFF_MS = 100;

let mounted = 0;
let visibleAt = Number.NEGATIVE_INFINITY;
let lastUnmountAt = Number.NEGATIVE_INFINITY;
/** True from the moment the run shows until it has been on screen for MIN_VISIBLE_MS. */
let holding = false;
let timers: ReturnType<typeof setTimeout>[] = [];
const listeners = new Set<() => void>();

function setHolding(next: boolean) {
  if (holding === next) return;
  holding = next;
  listeners.forEach((listener) => listener());
}

function endRun() {
  timers.forEach(clearTimeout);
  timers = [];
  setHolding(false);
}

/**
 * Registers a mounted skeleton. Returns how long it should still wait before it shows, or null when
 * its run is already on screen: then it must appear as it is, without fading in again.
 */
export function skeletonMounted(now: number): number | null {
  const continuesRun = mounted > 0 || now - lastUnmountAt <= HANDOFF_MS;
  if (!continuesRun) {
    endRun();
    visibleAt = now + DELAY_MS;
    timers.push(
      setTimeout(() => setHolding(true), DELAY_MS),
      setTimeout(() => setHolding(false), DELAY_MS + MIN_VISIBLE_MS),
    );
  }
  mounted += 1;
  return now >= visibleAt ? null : visibleAt - now;
}

export function skeletonUnmounted(now: number) {
  mounted = Math.max(0, mounted - 1);
  lastUnmountAt = now;
  // A run that ends before anyone saw it holds nothing back, unless another skeleton takes over.
  if (mounted === 0 && now < visibleAt) timers.push(setTimeout(() => mounted === 0 && endRun(), HANDOFF_MS));
}

export function subscribeSkeletonHold(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function isSkeletonHolding() {
  return holding;
}

/** Tests only. */
export function resetSkeletonTiming() {
  endRun();
  mounted = 0;
  visibleAt = Number.NEGATIVE_INFINITY;
  lastUnmountAt = Number.NEGATIVE_INFINITY;
}
