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
