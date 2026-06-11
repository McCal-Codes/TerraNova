export const LAYOUT_PICKER_POSITION_KEY = "terranova-layout-picker-position";
import { safeStoredJson } from "@/utils/safeLocalStorage";

export interface LayoutPickerPosition {
  x: number;
  y: number;
}

export interface StoredLayoutPickerPosition extends LayoutPickerPosition {
  custom: boolean;
}

const MARGIN = 12;

/** Default: bottom-center — clears status HUD (top-left), preview chrome (top), minimap (bottom-left), RF controls (bottom-right). */
export function defaultLayoutPickerPosition(
  containerWidth: number,
  containerHeight: number,
  pickerWidth: number,
  pickerHeight: number,
): LayoutPickerPosition {
  return {
    x: Math.max(MARGIN, (containerWidth - pickerWidth) / 2),
    y: Math.max(MARGIN, containerHeight - pickerHeight - MARGIN),
  };
}

export function clampLayoutPickerPosition(
  x: number,
  y: number,
  containerWidth: number,
  containerHeight: number,
  pickerWidth: number,
  pickerHeight: number,
): LayoutPickerPosition {
  const maxX = Math.max(MARGIN, containerWidth - pickerWidth - MARGIN);
  const maxY = Math.max(MARGIN, containerHeight - pickerHeight - MARGIN);
  return {
    x: Math.min(Math.max(MARGIN, x), maxX),
    y: Math.min(Math.max(MARGIN, y), maxY),
  };
}

export function loadLayoutPickerPosition(): StoredLayoutPickerPosition | null {
  const parsed = safeStoredJson<StoredLayoutPickerPosition | null>(LAYOUT_PICKER_POSITION_KEY, null);
  if (
    parsed
    && typeof parsed.x === "number"
    && typeof parsed.y === "number"
    && typeof parsed.custom === "boolean"
  ) {
    return parsed;
  }
  return null;
}

export function saveLayoutPickerPosition(position: StoredLayoutPickerPosition): void {
  try {
    localStorage.setItem(LAYOUT_PICKER_POSITION_KEY, JSON.stringify(position));
  } catch {
    // ignore quota errors
  }
}
