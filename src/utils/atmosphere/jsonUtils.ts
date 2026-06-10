export type JsonRecord = Record<string, unknown>;

export const HOURS_PER_DAY = 24;

export function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

export function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

export function normalizeHour(hour: number): number {
  const normalized = hour % HOURS_PER_DAY;
  return normalized < 0 ? normalized + HOURS_PER_DAY : normalized;
}

export function hourDistance(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, HOURS_PER_DAY - diff);
}

export function normalizeAssetName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  const withoutExtension = trimmed.replace(/\.json$/i, "");
  if (withoutExtension.toLowerCase() === "default") return "Default";
  return withoutExtension;
}

export function deepMergeRecords(base: JsonRecord, override: JsonRecord): JsonRecord {
  const merged: JsonRecord = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const baseValue = merged[key];
    const baseObj = asRecord(baseValue);
    const valueObj = asRecord(value);
    if (baseObj && valueObj) {
      merged[key] = deepMergeRecords(baseObj, valueObj);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}
