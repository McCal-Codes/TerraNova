import { describe, it, expect } from "vitest";
import {
  applyDragDelta,
  closeLargestGap,
  estimateCoveragePercent,
  normalizeRanges,
  resolveBiomeAt,
  resolveBiomeIndexAt,
  splitEqual,
  splitRangesEqually,
  splitWeighted,
  validateBiomeRanges,
} from "../biomeRangeDomain";

describe("biomeRangeDomain", () => {
  it("resolveBiomeAt picks matching range", () => {
    const ranges = [
      { Biome: "Plains", Min: -1, Max: -0.3 },
      { Biome: "Forest", Min: -0.3, Max: 0.3 },
      { Biome: "Mountains", Min: 0.3, Max: 1 },
    ];
    expect(resolveBiomeAt(-0.5, ranges, "Fallback")).toBe("Plains");
    expect(resolveBiomeAt(0.5, ranges, "Fallback")).toBe("Mountains");
    expect(resolveBiomeAt(2, ranges, "Fallback")).toBe("Fallback");
  });

  it("resolveBiomeIndexAt returns index or null", () => {
    const ranges = [
      { Biome: "A", Min: -1, Max: 0 },
      { Biome: "B", Min: 0, Max: 1 },
    ];
    expect(resolveBiomeIndexAt(-0.5, ranges)).toBe(0);
    expect(resolveBiomeIndexAt(0.5, ranges)).toBe(1);
    expect(resolveBiomeIndexAt(2, ranges)).toBe(null);
  });

  it("validateBiomeRanges detects gaps and default not listed", () => {
    const result = validateBiomeRanges(
      [{ Biome: "Only", Min: -0.5, Max: 0.5 }],
      { DefaultBiome: "Missing", DefaultTransitionDistance: 32, MaxBiomeEdgeDistance: 48 },
    );
    expect(result.gaps.length).toBeGreaterThan(0);
    expect(result.defaultNotListed).toBe(true);
  });

  it("validateBiomeRanges detects overlaps", () => {
    const result = validateBiomeRanges(
      [
        { Biome: "A", Min: -1, Max: 0.2 },
        { Biome: "B", Min: 0, Max: 1 },
      ],
      null,
    );
    expect(result.overlaps.length).toBe(1);
  });

  it("validateBiomeRanges flags missing project biome files", () => {
    const result = validateBiomeRanges(
      [{ Biome: "Ghost", Min: -1, Max: 1 }],
      { DefaultBiome: "Ghost", DefaultTransitionDistance: 16, MaxBiomeEdgeDistance: 32 },
      { projectBiomeNames: ["Plains"] },
    );
    expect(result.missingBiomeFiles).toContain("Ghost");
    expect(result.unassignedProjectBiomes).toContain("Plains");
  });

  it("splitEqual partitions axis", () => {
    const slots = splitEqual(3);
    expect(slots).toHaveLength(3);
    expect(slots[0].Min).toBeCloseTo(-1);
    expect(slots[2].Max).toBeCloseTo(1);
  });

  it("splitWeighted respects weights", () => {
    const ranges = splitWeighted([
      { biome: "Rare", weight: 1 },
      { biome: "Common", weight: 3 },
    ]);
    expect(ranges[1].Max - ranges[1].Min).toBeGreaterThan(ranges[0].Max - ranges[0].Min);
  });

  it("splitRangesEqually preserves names", () => {
    const result = splitRangesEqually([
      { Biome: "B", Min: 0, Max: 1 },
      { Biome: "A", Min: -1, Max: 0 },
    ]);
    expect(result.map((r) => r.Biome)).toEqual(["A", "B"]);
    expect(result[0].Min).toBeCloseTo(-1);
    expect(result[1].Max).toBeCloseTo(1);
  });

  it("applyDragDelta clamps move drag", () => {
    const moved = applyDragDelta({ Min: -0.5, Max: 0.5 }, "move", 2);
    expect(moved.Min).toBeLessThanOrEqual(0.5);
    expect(moved.Max - moved.Min).toBeCloseTo(1);
  });

  it("closeLargestGap merges adjacent ranges", () => {
    const closed = closeLargestGap([
      { Biome: "A", Min: -1, Max: -0.2 },
      { Biome: "B", Min: 0.2, Max: 1 },
    ]);
    expect(closed[0].Max).toBeCloseTo(0);
    expect(closed[1].Min).toBeCloseTo(0);
  });

  it("normalizeRanges sorts and clamps", () => {
    const normalized = normalizeRanges([
      { Biome: "B", Min: 2, Max: 3 },
      { Biome: "A", Min: -2, Max: 0 },
    ]);
    expect(normalized[0].Biome).toBe("A");
    expect(normalized[0].Min).toBe(-1);
    expect(normalized[1].Max).toBe(1);
  });

  it("normalizeRanges uses clamped min for minGap — produces valid range when Max is recoverable", () => {
    // Bug scenario: Min is below axis min but Max could be a valid range
    // after clamping. Previously, unclamped Min was used in the minGap
    // computation, causing the clamped Max to equal the clamped Min
    // (a degenerate zero-width range).
    const normalized = normalizeRanges([
      { Biome: "X", Min: -1.5, Max: -1.1 },
    ]);
    expect(normalized[0].Min).toBe(-1);
    // Max must be strictly greater than Min (non-degenerate range)
    expect(normalized[0].Max).toBeGreaterThan(-1);
    // Max should be at least clampedMin + DEFAULT_MIN_GAP = -1 + 0.02 = -0.98
    expect(normalized[0].Max).toBeCloseTo(-0.98);
  });

  it("estimateCoveragePercent", () => {
    expect(estimateCoveragePercent({ Min: -1, Max: 1 })).toBeCloseTo(100);
    expect(estimateCoveragePercent({ Min: -1, Max: 0 })).toBeCloseTo(50);
  });
});
