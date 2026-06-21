import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { hytaleToInternalBiome } from "@/utils/hytaleToInternal";
import { buildPropSectionGraph } from "@/utils/propSectionAssets";
import { summarizePropSectionFromGraph } from "@/utils/propSectionSummary";
import { sanitizeGraphNodesAndEdges } from "@/utils/sanitizeGraphNodes";

const FIXTURES = [
  {
    label: "Basic",
    path: "templates/hytale-release/HytaleGenerator/Biomes/Basic.json",
    expectMode: "propDistribution" as const,
    expectVariant: "Constant",
    expectPositions: "Scaler",
  },
  {
    label: "Boreal1 Henges",
    path: "templates/hytale-release/HytaleGenerator/Biomes/Boreal1/Boreal1_Henges.json",
    expectMode: "propDistribution" as const,
    expectVariant: "Union",
    expectImported: true,
  },
  {
    label: "Plains1 Gorges",
    path: "templates/hytale-release/HytaleGenerator/Biomes/Plains1/Plains1_Gorges.json",
    expectMode: "flatSplit" as const,
    expectVariant: null,
  },
];

function loadPropGraph(relativePath: string, propIndex = 0) {
  const fullPath = join(process.cwd(), relativePath);
  const raw = JSON.parse(readFileSync(fullPath, "utf8")) as Record<string, unknown>;
  const wrapper = hytaleToInternalBiome(raw).wrapper;
  const props = wrapper.Props as Record<string, unknown>[] | undefined;
  expect(Array.isArray(props) && props.length > propIndex).toBe(true);
  const graph = buildPropSectionGraph(props![propIndex] as Record<string, unknown>, "test");
  return sanitizeGraphNodesAndEdges(graph.nodes, graph.edges);
}

describe("summarizePropSectionFromGraph", () => {
  it.each(FIXTURES.filter((f) => existsSync(join(process.cwd(), f.path))))(
    "$label summarizes nested prop shapes",
    ({ path, expectMode, expectVariant, expectPositions, expectImported }) => {
      const { nodes, edges } = loadPropGraph(path);
      const summary = summarizePropSectionFromGraph(nodes, edges);
      expect(summary.mode).toBe(expectMode);
      if (expectVariant) {
        expect(summary.distributionVariant).toBe(expectVariant);
      }
      if (expectPositions) {
        expect(summary.positionsType).toBe(expectPositions);
      }
      if (expectImported) {
        expect(summary.importedName).toBeTruthy();
        expect(summary.shortLabel).toContain("Imported");
      }
      expect(summary.shortLabel.length).toBeGreaterThan(0);
    },
  );

  it("returns Prop layer for empty graph", () => {
    const summary = summarizePropSectionFromGraph([], []);
    expect(summary.shortLabel).toBe("Prop layer");
    expect(summary.mode).toBe("flatSplit");
  });
});
