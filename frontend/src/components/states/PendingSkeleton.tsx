"use client";

import { useTranslations } from "next-intl";
import { useLayoutEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { skeletonMounted, skeletonUnmounted } from "./skeleton-timing";

/**
 * A loading placeholder shaped like the content it stands for. Screen readers hear "Loading…" at
 * once; on screen it stays invisible for the first DELAY_MS (a CSS animation delay, so it also
 * holds for server-rendered and Suspense fallbacks) and then fades in. A skeleton that takes over
 * from another one carries on with that one's timing, so the swap doesn't blink.
 */
export function PendingSkeleton({
  kind,
  className,
  children,
}: {
  /** Names the shape, for tests and for telling skeletons apart in the DOM. */
  kind: string;
  className?: string;
  children: ReactNode;
}) {
  const t = useTranslations("common");
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const delay = skeletonMounted(performance.now());
    if (delay === null) ref.current?.style.setProperty("animation", "none");
    else ref.current?.style.setProperty("--skeleton-delay", `${Math.round(delay)}ms`);
    return () => skeletonUnmounted(performance.now());
  }, []);

  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      data-skeleton={kind}
      className={cn("skeleton-reveal", className)}
    >
      <span className="sr-only">{t("loading")}</span>
      {/* The shape is for sighted users only; it is not real content. */}
      <div aria-hidden inert className="contents">
        {children}
      </div>
    </div>
  );
}

/**
 * One line of text. Its height comes from an invisible text sample in the surrounding font, not a
 * fixed size, so a row keeps exactly the height it has with real text in every script and font.
 */
export function SkeletonLine({ className, lineClassName }: { className?: string; lineClassName?: string }) {
  return (
    <span className={cn("relative block", lineClassName)}>
      <span className="invisible">Ag</span>
      <span
        data-slot="skeleton"
        className={cn(
          "absolute inset-y-0 start-0 my-auto block h-3 animate-pulse rounded bg-muted",
          className,
        )}
      />
    </span>
  );
}
