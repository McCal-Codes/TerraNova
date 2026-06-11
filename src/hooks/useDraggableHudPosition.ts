import { useCallback, useEffect, useState } from "react";
import { safeStoredJson } from "@/utils/safeLocalStorage";

export type HudPosition = { x: number; y: number };

export function useDraggableHudPosition(storageKey: string, defaultPosition: HudPosition) {
  const [position, setPosition] = useState<HudPosition>(() => {
    const parsed = safeStoredJson<HudPosition | null>(storageKey, null);
    if (parsed && typeof parsed.x === "number" && typeof parsed.y === "number") {
      return parsed;
    }
    return defaultPosition;
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(position));
    } catch {
      // ignore quota errors
    }
  }, [position, storageKey]);

  const onDragMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const orig = { ...position };
      const handleMove = (moveEvt: MouseEvent) => {
        setPosition({
          x: Math.max(0, orig.x + (moveEvt.clientX - startX)),
          y: Math.max(0, orig.y + (moveEvt.clientY - startY)),
        });
      };
      const handleUp = () => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [position],
  );

  const resetPosition = useCallback(() => {
    setPosition(defaultPosition);
  }, [defaultPosition]);

  return { position, setPosition, onDragMouseDown, resetPosition };
}
