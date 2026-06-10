import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  clampLayoutPickerPosition,
  defaultLayoutPickerPosition,
  loadLayoutPickerPosition,
  saveLayoutPickerPosition,
} from "@/utils/layoutPickerPosition";

export function useDraggableLayoutPicker(containerRef: RefObject<HTMLElement | null>) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const customRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const measureAndPlace = useCallback((useCustom: boolean) => {
    const container = containerRef.current;
    const picker = pickerRef.current;
    if (!container || !picker) return;

    const containerRect = container.getBoundingClientRect();
    const pickerRect = picker.getBoundingClientRect();
    const pickerWidth = pickerRect.width || picker.offsetWidth;
    const pickerHeight = pickerRect.height || picker.offsetHeight;
    if (pickerWidth <= 0 || pickerHeight <= 0) return;

    const stored = useCustom ? loadLayoutPickerPosition() : null;
    const next = stored?.custom
      ? clampLayoutPickerPosition(
          stored.x,
          stored.y,
          containerRect.width,
          containerRect.height,
          pickerWidth,
          pickerHeight,
        )
      : defaultLayoutPickerPosition(
          containerRect.width,
          containerRect.height,
          pickerWidth,
          pickerHeight,
        );

    customRef.current = Boolean(stored?.custom);
    setPosition(next);
  }, [containerRef]);

  useEffect(() => {
    measureAndPlace(true);
    const container = containerRef.current;
    const picker = pickerRef.current;
    if (!container || !picker) return;

    const observer = new ResizeObserver(() => {
      measureAndPlace(customRef.current);
    });
    observer.observe(container);
    observer.observe(picker);
    return () => observer.disconnect();
  }, [containerRef, measureAndPlace]);

  const onGripPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!position) return;
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    dragOffsetRef.current = {
      x: e.clientX - containerRect.left - position.x,
      y: e.clientY - containerRect.top - position.y,
    };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [containerRef, position]);

  const onGripPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging) return;
    const container = containerRef.current;
    const picker = pickerRef.current;
    if (!container || !picker) return;

    const containerRect = container.getBoundingClientRect();
    const pickerWidth = picker.offsetWidth;
    const pickerHeight = picker.offsetHeight;
    const rawX = e.clientX - containerRect.left - dragOffsetRef.current.x;
    const rawY = e.clientY - containerRect.top - dragOffsetRef.current.y;
    setPosition(
      clampLayoutPickerPosition(
        rawX,
        rawY,
        containerRect.width,
        containerRect.height,
        pickerWidth,
        pickerHeight,
      ),
    );
  }, [containerRef, dragging]);

  const onGripPointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging) return;
    setDragging(false);
    if (position) {
      customRef.current = true;
      saveLayoutPickerPosition({ ...position, custom: true });
    }
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, [dragging, position]);

  const resetPosition = useCallback(() => {
    customRef.current = false;
    try {
      localStorage.removeItem("terranova-layout-picker-position");
    } catch {
      // ignore
    }
    measureAndPlace(false);
  }, [measureAndPlace]);

  return {
    pickerRef,
    position,
    dragging,
    onGripPointerDown,
    onGripPointerMove,
    onGripPointerUp,
    resetPosition,
  };
}
