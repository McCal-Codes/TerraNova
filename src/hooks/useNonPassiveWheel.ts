import { useEffect, type RefObject } from "react";

/** Attach a wheel listener with `{ passive: false }` so `preventDefault()` works (React onWheel is passive). */
export function useNonPassiveWheel(
  ref: RefObject<HTMLElement | null>,
  handler: (event: WheelEvent) => void,
  enabled = true,
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    const listener = (event: WheelEvent) => handler(event);
    el.addEventListener("wheel", listener, { passive: false });
    return () => el.removeEventListener("wheel", listener);
  }, [ref, handler, enabled]);
}
