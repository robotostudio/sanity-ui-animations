import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function query(): MediaQueryList | undefined {
  if (typeof window === "undefined" || !window.matchMedia) {
    return;
  }
  return window.matchMedia(QUERY);
}

function subscribe(onChange: () => void): () => void {
  const list = query();
  list?.addEventListener("change", onChange);
  return () => list?.removeEventListener("change", onChange);
}

/**
 * Whether the reader asked for reduced motion. The server, which cannot know,
 * renders with motion; the client corrects on hydration.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => query()?.matches ?? false,
    () => false
  );
}
