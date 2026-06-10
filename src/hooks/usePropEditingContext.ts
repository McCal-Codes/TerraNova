import { useEffect, useMemo, useRef } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { usePreviewStore } from "@/stores/previewStore";
import { findPositionsRootNodeId, isPropEditingContext, resolvePropPrefabPreviewSource } from "@/utils/propEditingContext";

export function usePropEditingContext() {
  const editingContext = useEditorStore((s) => s.editingContext);
  const activeBiomeSection = useEditorStore((s) => s.activeBiomeSection);
  const nodes = useEditorStore((s) => s.nodes);

  return useMemo(() => {
    const isPropContext = isPropEditingContext(editingContext, activeBiomeSection);
    return {
      isPropContext,
      positionRootNodeId: isPropContext ? findPositionsRootNodeId(nodes) : null,
      propSectionKey: activeBiomeSection?.startsWith("Props[")
        ? activeBiomeSection
        : null,
    };
  }, [editingContext, activeBiomeSection, nodes]);
}

/** Switch to split view once when entering a prop editing context. */
export function useAutoSplitOnPropSection(isPropContext: boolean) {
  const viewMode = usePreviewStore((s) => s.viewMode);
  const didAutoSplitRef = useRef(false);
  const wasPropContextRef = useRef(false);

  useEffect(() => {
    if (!isPropContext) {
      wasPropContextRef.current = false;
      didAutoSplitRef.current = false;
      return;
    }

    if (wasPropContextRef.current || didAutoSplitRef.current) {
      wasPropContextRef.current = true;
      return;
    }

    wasPropContextRef.current = true;
    if (viewMode === "graph" || viewMode === "preview") {
      usePreviewStore.getState().setViewMode("split");
      didAutoSplitRef.current = true;
    }
  }, [isPropContext, viewMode]);
}

/** Default prop preview tab when switching prop sections (2D unless a prefab path exists). */
export function usePropPreviewSectionDefaults(
  isPropContext: boolean,
  propSectionKey: string | null,
) {
  const lastSectionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isPropContext) {
      lastSectionRef.current = null;
      return;
    }

    const sectionKey = propSectionKey ?? "standalone-prop";
    if (lastSectionRef.current === sectionKey) return;
    lastSectionRef.current = sectionKey;

    const nodes = useEditorStore.getState().nodes;
    const prefab = resolvePropPrefabPreviewSource(nodes, null);
    if (!prefab) {
      usePreviewStore.getState().setPropPreviewMode("placement");
    }
    usePreviewStore.getState().setPropManualPrefabPath(null);
  }, [isPropContext, propSectionKey]);
}
