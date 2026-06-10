import type { CSSProperties } from "react";
import type { HudPosition } from "@/hooks/useDraggableHudPosition";

export type HudAnchor = {
  x: "left" | "right";
  y: "top" | "bottom";
};

/** Map drag offsets to absolute CSS when anchored from edges (right/bottom invert drag). */
export function hudAbsoluteStyle(
  position: HudPosition,
  anchor: HudAnchor,
  inset: { left?: number; right?: number; top?: number; bottom?: number },
): CSSProperties {
  const style: CSSProperties = { position: "absolute" };
  if (anchor.x === "left") {
    style.left = (inset.left ?? 0) + position.x;
  } else {
    style.right = (inset.right ?? 0) - position.x;
  }
  if (anchor.y === "top") {
    style.top = (inset.top ?? 0) + position.y;
  } else {
    style.bottom = (inset.bottom ?? 0) - position.y;
  }
  return style;
}
