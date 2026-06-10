import { useCallback, useEffect, useState } from "react";

export type HudPosition = { x: number; y: number };

export function useDraggableHudPosition(storageKey: string, defaultPosition: HudPosition) {
  const [position, setPosition] = useState<HudPosition>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return defaultPosition;
      const parsed = JSON.parse(saved) as HudPosition;
      if (typeof parsed.x === "number" && typeof parsed.y === "number") {
        return parsed;
      }
    } catch {
      // ignore
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
