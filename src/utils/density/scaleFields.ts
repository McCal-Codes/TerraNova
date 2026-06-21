/**
 * Shared scale resolution for noise nodes (V2 Scale divisor, legacy Frequency multiplier).
 */

export function resolveScale(fields: Record<string, unknown>, fallback = 1.0): number {
  if (fields.Scale != null) return Number(fields.Scale);
  if (fields.Frequency != null) {
    const freq = Number(fields.Frequency);
    return freq !== 0 ? 1.0 / freq : fallback;
  }
  return fallback;
}

export function resolveAxisScale(fields: Record<string, unknown>, axisField: string): number {
  return Number(fields[axisField] ?? fields.Scale ?? resolveScale(fields));
}

/** FastNoise-style cellular jitter is 0–1. Out-of-range values inflate voronoi distance. */
export function resolveCellularJitter(raw: unknown, fallback = 0.5): number {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, Math.abs(n)));
}
