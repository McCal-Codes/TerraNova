import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { hytaleToInternalBiome } from "@/utils/hytaleToInternal";
import {
  buildPropEntryFromSection,
  buildPropSectionGraph,
  resolvePropGraphAssets,
} from "@/utils/propSectionAssets";
import { sanitizeGraphNodesAndEdges } from "@/utils/sanitizeGraphNodes";

const CORPUS: { label: string; path: string; minNodes: number; expectPropDistribution?: boolean }[] = [
  {
    label: "Basic",
    path: "templates/hytale-release/HytaleGenerator/Biomes/Basic.json",
    minNodes: 3,
    expectPropDistribution: true,
  },
  {
    label: "Boreal1 Henges",
    path: "templates/hytale-release/HytaleGenerator/Biomes/Boreal1/Boreal1_Henges.json",
    minNodes: 5,
    expectPropDistribution: true,
  },
  {
    label: "Plains1 Gorges",
    path: "templates/hytale-release/HytaleGenerator/Biomes/Plains1/Plains1_Gorges.json",
    minNodes: 2,
    expectPropDistribution: false,
  },
  {
    label: "Desert1 Oasis",
    path: "templates/hytale-release/HytaleGenerator/Biomes/Desert1/Desert1_Oasis.json",
    minNodes: 2,
    expectPropDistribution: false,
  },
  {
    label: "Default Void",
    path: "templates/hytale-release/HytaleGenerator/Biomes/Default_Void/Default_Void.json",
    minNodes: 1,
    expectPropDistribution: false,
  },
  {
    label: "The Underworld",
    path: "templates/references/TheUnderworld.json",
    minNodes: 2,
    expectPropDistribution: false,
  },
];

function loadInternalBiome(relativePath: string) {
  const fullPath = join(process.cwd(), relativePath);
  const raw = JSON.parse(readFileSync(fullPath, "utf8")) as Record<string, unknown>;
  return hytaleToInternalBiome(raw).wrapper;
}

describe("propSectionAssets reference corpus", () => {
  it.each(CORPUS.filter((c) => existsSync(join(process.cwd(), c.path))))(
    "$label: builds prop section graph with nodes",
    ({ path, minNodes, expectPropDistribution }) => {
      const wrapper = loadInternalBiome(path);
      const props = wrapper.Props as Record<string, unknown>[] | undefined;
      expect(Array.isArray(props) && props.length > 0).toBe(true);
      const prop = props![0] as Record<string, unknown>;
      const resolved = resolvePropGraphAssets(prop);
      if (expectPropDistribution) {
        expect(resolved.mode).toBe("propDistribution");
      }
      const graph = buildPropSectionGraph(prop, "corpus");
      const { nodes } = sanitizeGraphNodesAndEdges(graph.nodes, graph.edges);
      expect(nodes.length).toBeGreaterThanOrEqual(minNodes);
    },
  );

  it("Basic: round-trips PropDistribution wrapper on save simulation", () => {
    const basicPath = join(process.cwd(), CORPUS[0].path);
    if (!existsSync(basicPath)) return;

    const wrapper = loadInternalBiome(CORPUS[0].path);
    const prop = (wrapper.Props as Record<string, unknown>[])[0];
    const graph = buildPropSectionGraph(prop, "rt");
    const entry = buildPropEntryFromSection(graph.nodes, graph.edges, { Runtime: 0, Skip: false });
    expect(entry.PropDistribution).toBeDefined();
    expect(entry.Positions).toBeUndefined();
  });
});
