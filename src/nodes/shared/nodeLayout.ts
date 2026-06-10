import { Position } from "@xyflow/react";
import type { FlowDirection } from "@/constants";

export const HEADER_H = 32; // px-3 py-1.5 + text-xs line-height
export const ROW_H = 28; // each handle row

/** Handle top position relative to the handle zone container */
export function handleTop(rowIndex: number): number {
  return rowIndex * ROW_H + ROW_H / 2;
}

/**
 * Resolve the visual row for a handle when input/output counts differ.
 * A lone output is centered among input rows so it does not share row 0 with
 * the first input (avoids overlapping port labels on asymmetric nodes).
 */
export function resolveHandleRow(
  index: number,
  role: "input" | "output",
  inputCount: number,
  outputCount: number,
): number {
  if (role === "output" && outputCount === 1 && inputCount > 1) {
    return Math.floor((inputCount - 1) / 2);
  }
  return index;
}

/** True when a port label adds info beyond generic Input/Output placeholders. */
export function isPortLabelSignificant(label: string): boolean {
  if (label === "Input" || label === "Output") return false;
  if (/^Input \d+$/.test(label) || /^Output \d+$/.test(label)) return false;
  if (/^Input [A-Z]$/.test(label)) return false;
  if (/^Entry \d+$/.test(label)) return false;
  return true;
}

/** Which side inputs appear on for a given flow direction */
export function inputPosition(dir: FlowDirection): Position {
  return dir === "RL" ? Position.Right : Position.Left;
}

/** Which side outputs appear on for a given flow direction */
export function outputPosition(dir: FlowDirection): Position {
  return dir === "RL" ? Position.Left : Position.Right;
}

/** CSS side keyword for input handles */
export function inputSide(dir: FlowDirection): "left" | "right" {
  return dir === "RL" ? "right" : "left";
}

/** CSS side keyword for output handles */
export function outputSide(dir: FlowDirection): "left" | "right" {
  return dir === "RL" ? "left" : "right";
}
