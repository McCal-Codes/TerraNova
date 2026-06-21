import type { Edge, Node } from "@xyflow/react";
import { jsonToGraph } from "@/utils/jsonToGraph";
import { hytaleToInternalBiome } from "@/utils/hytaleToInternal";
import { extractMaterialConfig, type BiomeMaterialConfig } from "@/utils/materialResolver";
import { collectExternalImportedNames } from "@/utils/densityExportRegistry";

export function biomeGraphFromBiome(biome: Record<string, unknown>) {
  const { wrapper } = hytaleToInternalBiome(biome);
  const terrain = wrapper.Terrain as Record<string, unknown> | undefined;
  if (!terrain?.Density || typeof terrain.Density !== "object") {
    throw new Error("Reference biome missing Terrain.Density");
  }
  const { nodes, edges } = jsonToGraph(
    terrain.Density as Record<string, unknown>,
    0,
    0,
    "terrain",
  );
  const outputNodeId = nodes.length > 0 ? nodes[nodes.length - 1]!.id : null;

  let materialNodes: Node[] = [];
  let materialEdges: Edge[] = [];
  const materialProvider = wrapper.MaterialProvider;
  if (materialProvider && typeof materialProvider === "object") {
    const mat = jsonToGraph(
      materialProvider as Record<string, unknown>,
      0,
      2000,
      "mat",
      "MaterialProvider",
    );
    materialNodes = mat.nodes;
    materialEdges = mat.edges;
  }

  const importNames = collectExternalImportedNames(
    [...nodes, ...materialNodes],
    [...edges, ...materialEdges],
  );

  return {
    nodes,
    edges,
    outputNodeId,
    materialNodes,
    materialEdges,
    materialConfig: extractMaterialConfig(wrapper) as BiomeMaterialConfig | null,
    importNames,
  };
}

export function terrainGraphFromBiome(biome: Record<string, unknown>) {
  const graph = biomeGraphFromBiome(biome);
  return {
    nodes: graph.nodes,
    edges: graph.edges,
    outputNodeId: graph.outputNodeId,
    materialConfig: graph.materialConfig,
  };
}
