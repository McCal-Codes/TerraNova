import type { Node, Edge } from "@xyflow/react";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import type { BiomeRangeEntry, NoiseRangeConfig } from "@/stores/slices/types";
import { jsonToGraph } from "@/utils/jsonToGraph";
import { patchWorldStructureBiomeRefs } from "@/utils/packWizard/buildPackManifest";
import { mergeImportGraph } from "@/utils/importAnnotations";
import { buildImportLayoutOptions } from "@/utils/importLayout";

export type WorldStructureImportMode = "ranges" | "selector" | "full";

export function extractNoiseRangeFromWorldStructure(
  ws: Record<string, unknown>,
): {
  biomeRanges: BiomeRangeEntry[];
  noiseRangeConfig: NoiseRangeConfig;
} {
  const biomes = Array.isArray(ws.Biomes)
    ? (ws.Biomes as BiomeRangeEntry[]).map((b) => ({
      Biome: String(b.Biome ?? ""),
      Min: Number(b.Min ?? -1),
      Max: Number(b.Max ?? 1),
    }))
    : [];

  return {
    biomeRanges: biomes,
    noiseRangeConfig: {
      DefaultBiome: String(ws.DefaultBiome ?? ""),
      DefaultTransitionDistance: Number(ws.DefaultTransitionDistance ?? 32),
      MaxBiomeEdgeDistance: Number(ws.MaxBiomeEdgeDistance ?? 48),
    },
  };
}

export async function applyWorldStructureImport(
  imported: Record<string, unknown>,
  mode: WorldStructureImportMode,
  options?: { remapToBiome?: string },
): Promise<{ nodes: Node[]; edges: Edge[] } | null> {
  const store = useEditorStore.getState();
  const setDirty = useProjectStore.getState().setDirty;

  let ws = imported;
  if (options?.remapToBiome?.trim()) {
    ws = patchWorldStructureBiomeRefs(imported, options.remapToBiome.trim());
  }

  if (mode === "ranges" || mode === "full") {
    const { biomeRanges, noiseRangeConfig } = extractNoiseRangeFromWorldStructure(ws);
    store.bulkUpdateBiomeRanges(biomeRanges, "Import world structure ranges");
    store.setNoiseRangeConfig(noiseRangeConfig);
  }

  let graphResult: { nodes: Node[]; edges: Edge[] } | null = null;

  if (mode === "selector" || mode === "full") {
    const density = ws.Density;
    if (density && typeof density === "object" && "Type" in (density as Record<string, unknown>)) {
      const { nodes: newNodes, edges: newEdges } = jsonToGraph(density as Record<string, unknown>);
      const layoutResult = await mergeImportGraph(newNodes, newEdges, null, {
        ...buildImportLayoutOptions(null),
        autoFrame: { sectionKey: "Density", edges: newEdges },
      });
      store.setNodes(layoutResult.nodes);
      store.setEdges(newEdges);
      store.setImportLayoutMode(layoutResult.layoutMode);
      store.setHytaleLayoutOffsets(null);
      graphResult = { nodes: layoutResult.nodes, edges: newEdges };
      store.commitState("Import world structure selector");
    }
  }

  if (mode === "full") {
    const wrapper = { ...(store.originalWrapper ?? {}), ...ws };
    store.setOriginalWrapper(wrapper);
  }

  setDirty(true);
  return graphResult;
}
