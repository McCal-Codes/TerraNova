import { asRecord, normalizeHour, toFiniteNumber, type JsonRecord } from "./jsonUtils";

export interface HourColor {
  Hour: number;
  Color: string;
}

export interface HourValue {
  Hour: number;
  Value: number;
}

interface HourValueEntry<T> {
  hour: number;
  value: T;
}

const HEX6_COLOR_RE = /^#([0-9a-fA-F]{6})$/;
const HEX8_COLOR_RE = /^#([0-9a-fA-F]{8})$/;
const RGBA_HEX_COLOR_RE = /^rgba\(\s*#([0-9a-fA-F]{6})(?:[0-9a-fA-F]{2})?\s*,\s*[0-9]*\.?[0-9]+\s*\)$/i;

export function normalizeColorToken(color: unknown): string | null {
  if (typeof color !== "string") return null;
  const trimmed = color.trim();

  const hex6 = HEX6_COLOR_RE.exec(trimmed);
  if (hex6) return `#${hex6[1].toLowerCase()}`;

  const hex8 = HEX8_COLOR_RE.exec(trimmed);
  if (hex8) return `#${hex8[1].slice(0, 6).toLowerCase()}`;

  const rgbaHex = RGBA_HEX_COLOR_RE.exec(trimmed);
  if (rgbaHex) return `#${rgbaHex[1].toLowerCase()}`;

  return null;
}

export function readHexColor(color: string): string {
  const normalized = normalizeColorToken(color);
  return normalized ?? "#888888";
}

export function readAlpha(color: string): number {
  const match = color.match(/rgba\(#[0-9a-fA-F]{6},\s*([\d.]+)\)/i);
  if (!match) return 1;
  const alpha = Number.parseFloat(match[1]);
  if (!Number.isFinite(alpha)) return 1;
  return Math.min(1, Math.max(0, alpha));
}

export function buildColorString(hex: string, alpha: number): string {
  const normalized = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#888888";
  const safeAlpha = Math.min(1, Math.max(0, alpha));
  if (safeAlpha >= 0.999) {
    return normalized;
  }
  return `rgba(${normalized}, ${safeAlpha.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")})`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerpHex(start: string, end: string, amount: number): string {
  const t = clamp(amount, 0, 1);
  const startR = Number.parseInt(start.slice(1, 3), 16);
  const startG = Number.parseInt(start.slice(3, 5), 16);
  const startB = Number.parseInt(start.slice(5, 7), 16);
  const endR = Number.parseInt(end.slice(1, 3), 16);
  const endG = Number.parseInt(end.slice(3, 5), 16);
  const endB = Number.parseInt(end.slice(5, 7), 16);
  const red = Math.round(startR + ((endR - startR) * t));
  const green = Math.round(startG + ((endG - startG) * t));
  const blue = Math.round(startB + ((endB - startB) * t));
  return `#${red.toString(16).padStart(2, "0")}${green.toString(16).padStart(2, "0")}${blue.toString(16).padStart(2, "0")}`;
}

function parseHourlyValues<T>(
  timeline: unknown,
  valueExtractor: (entry: JsonRecord) => T | null,
): HourValueEntry<T>[] {
  if (!Array.isArray(timeline)) return [];
  const entries: HourValueEntry<T>[] = [];
  for (const rawEntry of timeline) {
    const entry = asRecord(rawEntry);
    if (!entry) continue;
    const parsedHour = toFiniteNumber(entry.Hour);
    if (parsedHour === null) continue;
    const parsedValue = valueExtractor(entry);
    if (parsedValue === null) continue;
    entries.push({
      hour: normalizeHour(parsedHour),
      value: parsedValue,
    });
  }
  return entries.sort((left, right) => left.hour - right.hour);
}

/** Step-hold sampling: last keyframe at or before hour (matches 3D preview / Hytale resolver). */
export function sampleColorAtHour(timeline: unknown, hour: number): string | null {
  const rawColors = parseHourlyValues<string>(timeline, (entry) => (
    typeof entry.Color === "string" ? entry.Color : null
  ));
  if (rawColors.length === 0) return null;
  const normalized = normalizeHour(hour);
  let selected = rawColors[rawColors.length - 1].value;
  for (const entry of rawColors) {
    if (entry.hour > normalized) break;
    selected = entry.value;
  }
  return normalizeColorToken(selected);
}

/** Linear interpolation between color keyframes (editor smooth preview). */
export function interpolateColorAtHour(timeline: unknown, hour: number, fallback = "#888888"): string {
  if (!Array.isArray(timeline) || timeline.length === 0) {
    return fallback;
  }

  const keyframes = (timeline as HourColor[])
    .filter((entry) => typeof entry?.Hour === "number" && typeof entry?.Color === "string")
    .sort((left, right) => left.Hour - right.Hour);

  if (keyframes.length === 0) {
    return fallback;
  }

  const first = keyframes[0];
  const last = keyframes[keyframes.length - 1];

  if (hour <= first.Hour) {
    return readHexColor(first.Color);
  }
  if (hour >= last.Hour) {
    return readHexColor(last.Color);
  }

  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const start = keyframes[index];
    const end = keyframes[index + 1];
    if (hour >= start.Hour && hour <= end.Hour) {
      const span = Math.max(1, end.Hour - start.Hour);
      return lerpHex(readHexColor(start.Color), readHexColor(end.Color), (hour - start.Hour) / span);
    }
  }

  return readHexColor(last.Color);
}

export function sampleValueAtHour(timeline: unknown, hour: number): number | null {
  const values = parseHourlyValues<number>(timeline, (entry) => {
    const value = toFiniteNumber(entry.Value);
    return value;
  });
  if (values.length === 0) return null;
  const normalized = normalizeHour(hour);
  let selected = values[values.length - 1].value;
  for (const entry of values) {
    if (entry.hour > normalized) break;
    selected = entry.value;
  }
  return selected;
}

export function interpolateValueAtHour(timeline: unknown, hour: number, fallback = 0): number {
  if (!Array.isArray(timeline) || timeline.length === 0) {
    return fallback;
  }

  const keyframes = (timeline as HourValue[])
    .filter((entry) => typeof entry?.Hour === "number" && typeof entry?.Value === "number")
    .sort((left, right) => left.Hour - right.Hour);

  if (keyframes.length === 0) {
    return fallback;
  }

  const first = keyframes[0];
  const last = keyframes[keyframes.length - 1];

  if (hour <= first.Hour) {
    return first.Value;
  }
  if (hour >= last.Hour) {
    return last.Value;
  }

  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const start = keyframes[index];
    const end = keyframes[index + 1];
    if (hour >= start.Hour && hour <= end.Hour) {
      const span = Math.max(1, end.Hour - start.Hour);
      return start.Value + (((end.Value - start.Value) * (hour - start.Hour)) / span);
    }
  }

  return last.Value;
}

export function normalizeHourInput(value: number): number {
  return clamp(Math.round(value), 0, 23);
}

export function upsertColorKeyframe(entries: HourColor[], hour: number, color: string): HourColor[] {
  const nextHour = normalizeHourInput(hour);
  const existingIndex = entries.findIndex((entry) => entry.Hour === nextHour);
  if (existingIndex >= 0) {
    return entries.map((entry, index) => (index === existingIndex ? { ...entry, Color: color } : entry));
  }
  return [...entries, { Hour: nextHour, Color: color }];
}

export function upsertValueKeyframe(entries: HourValue[], hour: number, value: number): HourValue[] {
  const nextHour = normalizeHourInput(hour);
  const existingIndex = entries.findIndex((entry) => entry.Hour === nextHour);
  if (existingIndex >= 0) {
    return entries.map((entry, index) => (index === existingIndex ? { ...entry, Value: value } : entry));
  }
  return [...entries, { Hour: nextHour, Value: value }];
}
