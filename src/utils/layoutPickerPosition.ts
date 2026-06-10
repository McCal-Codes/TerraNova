export const LAYOUT_PICKER_POSITION_KEY = "terranova-layout-picker-position";

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
  try {
    const raw = localStorage.getItem(LAYOUT_PICKER_POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLayoutPickerPosition;
    if (
      typeof parsed.x === "number"
      && typeof parsed.y === "number"
      && typeof parsed.custom === "boolean"
    ) {
      return parsed;
    }
  } catch {
    // ignore corrupt storage
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
