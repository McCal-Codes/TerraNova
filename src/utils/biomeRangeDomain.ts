import type { BiomeRangeEntry, NoiseRangeConfig } from "@/stores/slices/types";

export const BIOME_RANGE_AXIS_MIN = -1;
export const BIOME_RANGE_AXIS_MAX = 1;
export const DEFAULT_MIN_GAP = 0.02;

export type BiomeDragMode = "min" | "max" | "move";

export interface BiomeRangeGap {
  start: number;
  end: number;
}

export interface BiomeRangeOverlap {
  biomeA: string;
  biomeB: string;
  start: number;
  end: number;
}

export interface BiomeRangeValidation {
  gaps: BiomeRangeGap[];
  overlaps: BiomeRangeOverlap[];
  uncoveredSpan: BiomeRangeGap | null;
  defaultNotListed: boolean;
  duplicateNames: string[];
  missingBiomeFiles: string[];
  unassignedProjectBiomes: string[];
}

/** Deterministic HSL color from biome name */
export function biomeColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  const h = ((hash % 360) + 360) % 360;
  return `hsl(${h}, 58%, 58%)`;
}

/** Map a noise value [-1,1] to a percentage for UI layout */
export function biomeRangePct(v: number): number {
  return ((v + 1) / 2) * 100;
}

export function clampAxis(v: number): number {
  return Math.max(BIOME_RANGE_AXIS_MIN, Math.min(BIOME_RANGE_AXIS_MAX, v));
}

export function estimateCoveragePercent(range: Pick<BiomeRangeEntry, "Min" | "Max">): number {
  const width = Math.max(0, range.Max - range.Min);
  return (width / (BIOME_RANGE_AXIS_MAX - BIOME_RANGE_AXIS_MIN)) * 100;
}

export function normalizeRanges(
  ranges: BiomeRangeEntry[],
  minGap = DEFAULT_MIN_GAP,
): BiomeRangeEntry[] {
  return [...ranges]
    .map((r) => {
      const clampedMin = clampAxis(r.Min);
      return {
        Biome: r.Biome,
        Min: clampedMin,
        Max: clampAxis(Math.max(clampedMin + minGap, r.Max)),
      };
    })
    .sort((a, b) => a.Min - b.Min || a.Max - b.Max);
}

export function resolveBiomeAt(
  value: number,
  ranges: BiomeRangeEntry[],
  defaultBiome: string,
): string {
  for (const r of ranges) {
    if (value >= r.Min && value <= r.Max) return r.Biome;
  }
  return defaultBiome;
}

export function resolveBiomeIndexAt(
  value: number,
  ranges: BiomeRangeEntry[],
): number | null {
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    if (value >= r.Min && value <= r.Max) return i;
  }
  return null;
}

function findGaps(sorted: BiomeRangeEntry[]): BiomeRangeGap[] {
  const gaps: BiomeRangeGap[] = [];
  if (sorted.length === 0) return gaps;

  if (sorted[0].Min > BIOME_RANGE_AXIS_MIN) {
    gaps.push({ start: BIOME_RANGE_AXIS_MIN, end: sorted[0].Min });
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const end = sorted[i].Max;
    const nextStart = sorted[i + 1].Min;
    if (nextStart > end) {
      gaps.push({ start: end, end: nextStart });
    }
  }

  const last = sorted[sorted.length - 1];
  if (last.Max < BIOME_RANGE_AXIS_MAX) {
    gaps.push({ start: last.Max, end: BIOME_RANGE_AXIS_MAX });
  }

  return gaps;
}

function findOverlaps(sorted: BiomeRangeEntry[]): BiomeRangeOverlap[] {
  const overlaps: BiomeRangeOverlap[] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      const start = Math.max(a.Min, b.Min);
      const end = Math.min(a.Max, b.Max);
      if (end > start) {
        overlaps.push({ biomeA: a.Biome, biomeB: b.Biome, start, end });
      }
    }
  }
  return overlaps;
}

export function validateBiomeRanges(
  ranges: BiomeRangeEntry[],
  config: NoiseRangeConfig | null,
  options?: { projectBiomeNames?: string[] },
): BiomeRangeValidation {
  const sorted = normalizeRanges(ranges);
  const gaps = findGaps(sorted);
  const overlaps = findOverlaps(sorted);

  const fullSpanCovered =
    sorted.length > 0 &&
    sorted[0].Min <= BIOME_RANGE_AXIS_MIN &&
    sorted[sorted.length - 1].Max >= BIOME_RANGE_AXIS_MAX &&
    gaps.length === 0;

  const uncoveredSpan = fullSpanCovered || sorted.length === 0
    ? null
    : gaps.reduce(
        (largest, gap) => {
          const width = gap.end - gap.start;
          const largestWidth = largest.end - largest.start;
          return width > largestWidth ? gap : largest;
        },
        gaps[0] ?? { start: BIOME_RANGE_AXIS_MIN, end: BIOME_RANGE_AXIS_MAX },
      );

  const names = ranges.map((r) => r.Biome.trim()).filter(Boolean);
  const seen = new Set<string>();
  const duplicateNames: string[] = [];
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) duplicateNames.push(name);
    seen.add(key);
  }

  const defaultBiome = config?.DefaultBiome?.trim() ?? "";
  const defaultNotListed =
    ranges.length > 0 &&
    defaultBiome.length > 0 &&
    !ranges.some((r) => r.Biome.trim().toLowerCase() === defaultBiome.toLowerCase());

  const projectSet = new Set(
    (options?.projectBiomeNames ?? []).map((n) => n.trim().toLowerCase()).filter(Boolean),
  );
  const missingBiomeFiles =
    projectSet.size > 0
      ? names.filter((n) => !projectSet.has(n.toLowerCase()))
      : [];

  const rangeNameSet = new Set(names.map((n) => n.toLowerCase()));

  return {
    gaps,
    overlaps,
    uncoveredSpan,
    defaultNotListed,
    duplicateNames: [...new Set(duplicateNames)],
    missingBiomeFiles,
    unassignedProjectBiomes: options?.projectBiomeNames?.filter(
      (n) => !rangeNameSet.has(n.trim().toLowerCase()),
    ) ?? [],
  };
}

export function splitEqual(count: number): Array<{ Min: number; Max: number }> {
  const n = Math.max(1, Math.floor(count));
  const span = BIOME_RANGE_AXIS_MAX - BIOME_RANGE_AXIS_MIN;
  const width = span / n;
  const slots: Array<{ Min: number; Max: number }> = [];
  for (let i = 0; i < n; i++) {
    const min = BIOME_RANGE_AXIS_MIN + i * width;
    const max = i === n - 1 ? BIOME_RANGE_AXIS_MAX : BIOME_RANGE_AXIS_MIN + (i + 1) * width;
    slots.push({ Min: min, Max: max });
  }
  return slots;
}

export function splitWeighted(
  entries: Array<{ biome: string; weight: number }>,
): BiomeRangeEntry[] {
  const total = entries.reduce((sum, e) => sum + Math.max(0, e.weight), 0);
  if (total <= 0 || entries.length === 0) return [];

  const span = BIOME_RANGE_AXIS_MAX - BIOME_RANGE_AXIS_MIN;
  let cursor = BIOME_RANGE_AXIS_MIN;
  return entries.map((entry, index) => {
    const isLast = index === entries.length - 1;
    const width = isLast
      ? BIOME_RANGE_AXIS_MAX - cursor
      : (Math.max(0, entry.weight) / total) * span;
    const min = cursor;
    const max = isLast ? BIOME_RANGE_AXIS_MAX : cursor + width;
    cursor = max;
    return { Biome: entry.biome, Min: min, Max: max };
  });
}

export function applyDragDelta(
  orig: Pick<BiomeRangeEntry, "Min" | "Max">,
  mode: BiomeDragMode,
  delta: number,
  minGap = DEFAULT_MIN_GAP,
): Pick<BiomeRangeEntry, "Min" | "Max"> {
  let newMin = orig.Min;
  let newMax = orig.Max;

  if (mode === "move") {
    const w = orig.Max - orig.Min;
    newMin = Math.max(BIOME_RANGE_AXIS_MIN, Math.min(BIOME_RANGE_AXIS_MAX - w, orig.Min + delta));
    newMax = newMin + w;
  } else if (mode === "min") {
    newMin = Math.max(BIOME_RANGE_AXIS_MIN, Math.min(orig.Max - minGap, orig.Min + delta));
  } else {
    newMax = Math.min(BIOME_RANGE_AXIS_MAX, Math.max(orig.Min + minGap, orig.Max + delta));
  }

  return { Min: newMin, Max: newMax };
}

export function clampMinInput(
  value: number,
  currentMax: number,
  minGap = DEFAULT_MIN_GAP,
): number {
  return Math.max(BIOME_RANGE_AXIS_MIN, Math.min(currentMax - minGap, value));
}

export function clampMaxInput(
  value: number,
  currentMin: number,
  minGap = DEFAULT_MIN_GAP,
): number {
  return Math.min(BIOME_RANGE_AXIS_MAX, Math.max(currentMin + minGap, value));
}

/** Close the largest gap by extending adjacent ranges to meet at the midpoint. */
export function closeLargestGap(ranges: BiomeRangeEntry[]): BiomeRangeEntry[] {
  const sorted = normalizeRanges(ranges);
  const gaps = findGaps(sorted);
  if (gaps.length === 0) return sorted;

  const gap = gaps.reduce((largest, g) =>
    g.end - g.start > largest.end - largest.start ? g : largest,
  );

  const midpoint = (gap.start + gap.end) / 2;
  return sorted.map((r) => {
    if (Math.abs(r.Max - gap.start) < 1e-9) return { ...r, Max: midpoint };
    if (Math.abs(r.Min - gap.end) < 1e-9) return { ...r, Min: midpoint };
    return r;
  });
}

/** Split all ranges equally, preserving biome names in sorted order. */
export function splitRangesEqually(ranges: BiomeRangeEntry[]): BiomeRangeEntry[] {
  const sorted = normalizeRanges(ranges);
  const slots = splitEqual(sorted.length || 1);
  if (sorted.length === 0) return [];
  return sorted.map((r, i) => ({
    Biome: r.Biome,
    Min: slots[i]?.Min ?? r.Min,
    Max: slots[i]?.Max ?? r.Max,
  }));
}
