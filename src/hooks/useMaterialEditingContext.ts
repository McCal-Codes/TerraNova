import { useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { usePreviewStore } from "@/stores/previewStore";
import { useEvaluationFingerprint } from "@/hooks/useEvaluationFingerprint";
import { useConfigStore } from "@/stores/configStore";
import {
  evaluateMaterialColumnPreview,
  evaluateMaterialSurfacePreview,
  type MaterialColumnPreviewResult,
  type MaterialScaffoldPreset,
  type MaterialPreviewView,
  type MaterialSurfacePreviewResult,
} from "@/utils/materialColumnPreview";
import { resolveVoxelMaterialGraph } from "@/utils/voxelMaterialPreview";

export function isMaterialEditingContext(activeBiomeSection: string | null | undefined): boolean {
  return activeBiomeSection === "MaterialProvider";
}

export function useMaterialEditingContext() {
  const activeBiomeSection = useEditorStore((s) => s.activeBiomeSection);
  return useMemo(
    () => ({ isMaterialContext: isMaterialEditingContext(activeBiomeSection) }),
    [activeBiomeSection],
  );
}

/** Switch to split view once when entering Materials section. */
export function useAutoSplitOnMaterialSection(isMaterialContext: boolean) {
  const viewMode = usePreviewStore((s) => s.viewMode);
  const didAutoSplitRef = useRef(false);
  const wasMaterialRef = useRef(false);

  useEffect(() => {
    if (!isMaterialContext) {
      wasMaterialRef.current = false;
      didAutoSplitRef.current = false;
      return;
    }
    if (wasMaterialRef.current || didAutoSplitRef.current) {
      wasMaterialRef.current = true;
      return;
    }
    wasMaterialRef.current = true;
    if (viewMode === "graph" || viewMode === "preview") {
      usePreviewStore.getState().setViewMode("split");
      didAutoSplitRef.current = true;
    }
  }, [isMaterialContext, viewMode]);
}

export function useMaterialColumnPreview(options: {
  preset: MaterialScaffoldPreset;
  view: MaterialPreviewView;
  surfaceY: number;
  useTerrainShape: boolean;
}) {
  const evalFingerprint = useEvaluationFingerprint();
  const debounceMs = useConfigStore((s) => s.debounceMs);
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const biomeSections = useEditorStore((s) => s.biomeSections);

  const [column, setColumn] = useState<MaterialColumnPreviewResult | null>(null);
  const [surface, setSurface] = useState<MaterialSurfacePreviewResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      const materialGraph = resolveVoxelMaterialGraph({ nodes, edges, biomeSections });
      const terrainSection = biomeSections?.Terrain;
      const input = {
        materialGraph,
        preset: options.preset,
        surfaceY: options.surfaceY,
        useTerrainShape: options.useTerrainShape,
        terrainNodes: terrainSection?.nodes,
        terrainEdges: terrainSection?.edges,
      };
      setColumn(evaluateMaterialColumnPreview(input));
      setSurface(evaluateMaterialSurfacePreview(input));
      setLoading(false);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [
    nodes,
    edges,
    biomeSections,
    options.preset,
    options.view,
    options.surfaceY,
    options.useTerrainShape,
    debounceMs,
    evalFingerprint,
  ]);

  return { column, surface, loading };
}
