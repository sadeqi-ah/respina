"use client";

import { useState, useSyncExternalStore } from "react";

import { isSkeletonHolding, subscribeSkeletonHold } from "@/components/states/skeleton-timing";

/**
 * `pending`, held a little longer when a skeleton is on screen and has not stayed for its minimum
 * time yet, so it gives way to content without blinking. A load that ended before its skeleton
 * appeared is not held at all.
 */
export function useMinimumPending(pending: boolean): boolean {
  const holding = useSyncExternalStore(subscribeSkeletonHold, isSkeletonHolding, () => false);
  // Whether this load has been pending since its skeleton run began; only then may it be held.
  const [waiting, setWaiting] = useState(pending);
  if (pending && !waiting) setWaiting(true);
  if (!pending && waiting && !holding) setWaiting(false);
  return pending || (waiting && holding);
}
