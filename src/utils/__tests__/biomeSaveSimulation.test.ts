import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { graphToJson, graphToJsonMulti } from "../graphToJson";
import { jsonToGraph } from "../jsonToGraph";
import { internalToHytaleBiome } from "../internalToHytale";
import { normalizeMaterialSectionNodeTypes } from "../materialSectionNodes";
import { hytaleToInternalBiome } from "../hytaleToInternal";
import { sanitizeGraphNodesAndEdges } from "../sanitizeGraphNodes";

const AUTUMN_BONES =
  "C:/Users/wolft/AppData/Roaming/Hytale/UserData/Saves/Worldgen V1/mods/McCal.Autmn Forest/Server/HytaleGenerator/Biomes/Autmn Forest Bones.json";

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
      const dist = prop.PropDistribution as Record<string, unknown> | undefined;
      const positions = (prop.Positions ?? dist?.Positions) as Record<string, unknown> | undefined;
      const assignments = (prop.Assignments ?? dist?.Prop) as Record<string, unknown> | undefined;
      const allNodes: Node[] = [];
      const allEdges: Edge[] = [];
      if (positions) {
        const g = graphSection(positions, `pos_${i}`, "Positions");
        allNodes.push(...g.nodes);
        allEdges.push(...g.edges);
      }
      if (assignments) {
        const g = graphSection(assignments, `asgn_${i}`, "Assignments");
        allNodes.push(...g.nodes);
        allEdges.push(...g.edges);
      }
      sections[`Props[${i}]`] = sanitizeGraphNodesAndEdges(allNodes, allEdges);
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
      const entry: Record<string, unknown> = {
        Runtime: (prop as Record<string, unknown>).Runtime ?? 0,
        Skip: (prop as Record<string, unknown>).Skip ?? false,
      };
      if (section?.nodes.length) {
        const assets = graphToJsonMulti(section.nodes, section.edges);
        if (assets[0]) entry.Positions = assets[0];
        if (assets[1]) entry.Assignments = assets[1];
      }
      return entry;
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

  it("saves Autmn Forest Bones (all sections) without throwing", () => {
    const raw = readFileSync(AUTUMN_BONES, "utf8");
    const hytaleWrapper = JSON.parse(raw) as Record<string, unknown>;
    const { wrapper } = hytaleToInternalBiome(hytaleWrapper);
    expect(() => simulateBiomeSave(wrapper)).not.toThrow();
  });

  it("tolerates sparse node arrays in MaterialProvider section", () => {
    const raw = readFileSync(AUTUMN_BONES, "utf8");
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
