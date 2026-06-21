import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { graphToJson } from "../graphToJson";
import { jsonToGraph } from "../jsonToGraph";
import { internalToHytaleBiome } from "../internalToHytale";
import { normalizeMaterialSectionNodeTypes } from "../materialSectionNodes";
import { hytaleToInternalBiome } from "../hytaleToInternal";
import { sanitizeGraphNodesAndEdges } from "../sanitizeGraphNodes";
import {
  buildPropEntryFromSection,
  buildPropSectionGraph,
} from "../propSectionAssets";

const FOREST_HILLS_BIOME = join(
  process.cwd(),
  "templates/forest-hills/Server/HytaleGenerator/Biomes/ForestHillsBiome.json",
);

function graphSection(
  asset: Record<string, unknown>,
  idPrefix: string,
  rootField?: string,
): { nodes: Node[]; edges: Edge[] } {
  return jsonToGraph(asset, 0, 0, idPrefix, rootField);
}

function buildSectionsFromInternalWrapper(wrapper: Record<string, unknown>) {
  const sections: Record<string, { nodes: Node[]; edges: Edge[] }> = {};

  const terrain = wrapper.Terrain as Record<string, unknown> | undefined;
  if (terrain?.Density) {
    sections.Terrain = graphSection(terrain.Density as Record<string, unknown>, "terrain", "Terrain");
  }

  if (wrapper.MaterialProvider) {
    const g = graphSection(
      wrapper.MaterialProvider as Record<string, unknown>,
      "mat",
      "MaterialProvider",
    );
    sections.MaterialProvider = {
      nodes: normalizeMaterialSectionNodeTypes(g.nodes),
      edges: g.edges,
    };
  }

  if (wrapper.EnvironmentProvider) {
    sections.EnvironmentProvider = graphSection(
      wrapper.EnvironmentProvider as Record<string, unknown>,
      "env",
      "EnvironmentProvider",
    );
  }

  if (wrapper.TintProvider) {
    sections.TintProvider = graphSection(
      wrapper.TintProvider as Record<string, unknown>,
      "tint",
      "TintProvider",
    );
  }

  const props = wrapper.Props;
  if (Array.isArray(props)) {
    for (let i = 0; i < props.length; i++) {
      const prop = props[i] as Record<string, unknown>;
      const graph = buildPropSectionGraph(prop, `prop_${i}`);
      sections[`Props[${i}]`] = sanitizeGraphNodesAndEdges(graph.nodes, graph.edges);
    }
  }

  return sections;
}

function simulateBiomeSave(wrapper: Record<string, unknown>) {
  const sections = buildSectionsFromInternalWrapper(wrapper);
  const output = { ...wrapper } as Record<string, unknown>;

  if (sections.Terrain) {
    output.Terrain = {
      ...(wrapper.Terrain as Record<string, unknown>),
      Density: graphToJson(sections.Terrain.nodes, sections.Terrain.edges),
    };
  }

  if (sections.MaterialProvider) {
    output.MaterialProvider = graphToJson(
      sections.MaterialProvider.nodes,
      sections.MaterialProvider.edges,
    );
  }

  if (sections.EnvironmentProvider) {
    output.EnvironmentProvider =
      graphToJson(sections.EnvironmentProvider.nodes, sections.EnvironmentProvider.edges) ??
      wrapper.EnvironmentProvider;
  }

  if (sections.TintProvider) {
    output.TintProvider =
      graphToJson(sections.TintProvider.nodes, sections.TintProvider.edges) ?? wrapper.TintProvider;
  }

  const props = wrapper.Props;
  if (Array.isArray(props)) {
    output.Props = props.map((prop, i) => {
      const section = sections[`Props[${i}]`];
      const raw = prop as Record<string, unknown>;
      const meta = {
        Runtime: typeof raw.Runtime === "number" ? raw.Runtime : 0,
        Skip: typeof raw.Skip === "boolean" ? raw.Skip : false,
      };
      if (!section?.nodes.length) {
        return { Runtime: meta.Runtime, Skip: meta.Skip };
      }
      return buildPropEntryFromSection(section.nodes, section.edges, meta);
    });
  }

  return internalToHytaleBiome(
    output,
    Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, v.nodes])),
  );
}

describe("biome save simulation", () => {
  it("graphToJson ignores undefined node entries", () => {
    expect(() =>
      graphToJson(
        [
          undefined,
          {
            id: "a",
            type: "Constant",
            position: { x: 0, y: 0 },
            data: { type: "Constant", fields: { Value: 1 } },
          },
        ] as never[],
        [],
      ),
    ).not.toThrow();
  });

  it("saves bundled forest-hills biome (all sections) without throwing", () => {
    const raw = readFileSync(FOREST_HILLS_BIOME, "utf8");
    const hytaleWrapper = JSON.parse(raw) as Record<string, unknown>;
    const { wrapper } = hytaleToInternalBiome(hytaleWrapper);
    expect(() => simulateBiomeSave(wrapper)).not.toThrow();
  });

  it("tolerates sparse node arrays in MaterialProvider section", () => {
    const raw = readFileSync(FOREST_HILLS_BIOME, "utf8");
    const hytaleWrapper = JSON.parse(raw) as Record<string, unknown>;
    const { wrapper } = hytaleToInternalBiome(hytaleWrapper);
    const sections = buildSectionsFromInternalWrapper(wrapper);
    const mat = sections.MaterialProvider;
    expect(mat).toBeDefined();
    if (!mat) return;

    const sparseNodes = [...mat.nodes];
    sparseNodes[1] = undefined as unknown as Node;

    expect(() =>
      internalToHytaleBiome(
        {
          ...wrapper,
          MaterialProvider: graphToJson(sparseNodes, mat.edges),
        },
        { MaterialProvider: sparseNodes },
      ),
    ).not.toThrow();
  });
});
