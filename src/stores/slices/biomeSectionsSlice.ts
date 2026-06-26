import { useUIStore } from "../uiStore";
import { emit } from "../storeEvents";
import { saveSession } from "@/utils/sessionPersist";
import { normalizeDensitySectionNodeTypes } from "@/utils/densitySectionNodes";
import { normalizeMaterialSectionNodeTypes } from "@/utils/materialSectionNodes";
import { sortPropSectionKeys } from "@/utils/propSectionKeys";
import type {
  EditorState,
  SliceCreator,
  BiomeSectionsSliceState,
  BiomeSectionData,
  SectionHistoryEntry,
} from "./types";

type PropSectionBundle = { section: BiomeSectionData; meta: { Runtime: number; Skip: boolean } };

function collectOrderedPropSections(
  sections: Record<string, BiomeSectionData>,
  biomeConfig: EditorState["biomeConfig"],
): PropSectionBundle[] {
  return sortPropSectionKeys(Object.keys(sections).filter((k) => k.startsWith("Props[")))
    .map((k) => {
      const origIdx = parseInt(/\[(\d+)\]/.exec(k)?.[1] ?? "0", 10);
      return {
        section: sections[k],
        meta: biomeConfig?.propMeta[origIdx] ?? { Runtime: 0, Skip: false },
      };
    });
}

function rewritePropSectionKeys(
  sections: Record<string, BiomeSectionData>,
  ordered: PropSectionBundle[],
): Record<string, BiomeSectionData> {
  const next = { ...sections };
  for (const key of Object.keys(next)) {
    if (key.startsWith("Props[")) delete next[key];
  }
  for (let i = 0; i < ordered.length; i++) {
    next[`Props[${i}]`] = ordered[i].section;
  }
  return next;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export const biomeSectionsInitialState = {
  biomeSections: null as Record<string, BiomeSectionData> | null,
  activeBiomeSection: null as string | null,
  biomeConfig: null as EditorState["biomeConfig"],
};

// ---------------------------------------------------------------------------
// Slice creator
// ---------------------------------------------------------------------------

export const createBiomeSectionsSlice: SliceCreator<BiomeSectionsSliceState> = (set, get) => {
  function markDirty() {
    emit("editor:dirty");
  }

  return {
    ...biomeSectionsInitialState,

    setBiomeSections: (sections) => set({ biomeSections: sections }),
    setActiveBiomeSection: (section) => {
      set({ activeBiomeSection: section });
      saveSession({ activeBiomeSection: section });
    },
    setBiomeConfig: (config) => set({ biomeConfig: config }),

    flushActiveBiomeSection: () => {
      const { activeBiomeSection, biomeSections, nodes, edges, outputNodeId } = get();
      if (!biomeSections || !activeBiomeSection || !biomeSections[activeBiomeSection]) return;

      let sectionNodes = structuredClone(nodes);
      if (activeBiomeSection === "MaterialProvider") {
        sectionNodes = normalizeMaterialSectionNodeTypes(sectionNodes);
      } else if (activeBiomeSection === "Terrain") {
        sectionNodes = normalizeDensitySectionNodeTypes(sectionNodes);
      }

      set({
        biomeSections: {
          ...biomeSections,
          [activeBiomeSection]: {
            ...biomeSections[activeBiomeSection],
            nodes: sectionNodes,
            edges: structuredClone(edges),
            outputNodeId,
          },
        },
      });
    },

    switchBiomeSection: (target) => {
      const { activeBiomeSection, biomeSections, nodes, edges, outputNodeId } = get();
      if (!biomeSections || target === activeBiomeSection) return;

      // Save current section's graph state + history
      const updated = { ...biomeSections };
      if (activeBiomeSection && updated[activeBiomeSection]) {
        const currentSection = updated[activeBiomeSection];
        let sectionNodes = structuredClone(nodes);
        if (activeBiomeSection === "MaterialProvider") {
          sectionNodes = normalizeMaterialSectionNodeTypes(sectionNodes);
        } else if (activeBiomeSection === "Terrain") {
          sectionNodes = normalizeDensitySectionNodeTypes(sectionNodes);
        }
        updated[activeBiomeSection] = {
          ...currentSection,
          nodes: sectionNodes,
          edges: structuredClone(edges),
          outputNodeId,
        };
      }

      // Load target section (including its history)
      const targetData = updated[target];
      if (targetData) {
        let targetNodes = structuredClone(targetData.nodes);
        if (target === "MaterialProvider") {
          targetNodes = normalizeMaterialSectionNodeTypes(targetNodes);
        } else if (target === "Terrain") {
          targetNodes = normalizeDensitySectionNodeTypes(targetNodes);
        }
        set({
          biomeSections: updated,
          activeBiomeSection: target,
          nodes: targetNodes,
          edges: structuredClone(targetData.edges),
          outputNodeId: targetData.outputNodeId ?? null,
          selectedNodeId: null,
        });
        saveSession({ activeBiomeSection: target });
        // Reload per-tab bookmarks for the new section
        useUIStore.getState().reloadBookmarks(undefined, undefined, target);
      }
    },

    addPropSection: () => {
      get().addPropSectionWithGraph([], [], { Runtime: 0, Skip: false });
    },

    addPropSectionWithGraph: (nodes, edges, meta = { Runtime: 0, Skip: false }) => {
      const {
        biomeSections,
        biomeConfig,
        activeBiomeSection,
        nodes: liveNodes,
        edges: liveEdges,
        outputNodeId: liveOutputNodeId,
      } = get();
      if (!biomeSections) return null;

      // Flush the currently active section's live canvas state (position-only changes
      // from node drags go through setNodes and are not yet in biomeSections).
      const syncedBiomeSections = { ...biomeSections };
      if (activeBiomeSection && syncedBiomeSections[activeBiomeSection]) {
        syncedBiomeSections[activeBiomeSection] = {
          ...syncedBiomeSections[activeBiomeSection],
          nodes: structuredClone(liveNodes),
          edges: structuredClone(liveEdges),
          outputNodeId: liveOutputNodeId,
        };
      }

      const existingPropKeys = Object.keys(syncedBiomeSections).filter((k) => k.startsWith("Props["));
      const nextIndex = existingPropKeys.length;
      const key = `Props[${nextIndex}]`;
      const sectionNodes = structuredClone(nodes);
      const sectionEdges = structuredClone(edges);
      const initialEntry: SectionHistoryEntry = {
        nodes: sectionNodes,
        edges: sectionEdges,
        outputNodeId: null,
        label: "Initial",
      };
      const newSection: BiomeSectionData = {
        nodes: sectionNodes,
        edges: sectionEdges,
        outputNodeId: null,
        history: [initialEntry],
        historyIndex: 0,
      };
      const updatedMeta = biomeConfig
        ? [...biomeConfig.propMeta, { ...meta }]
        : [{ ...meta }];

      set({
        biomeSections: { ...syncedBiomeSections, [key]: newSection },
        biomeConfig: biomeConfig ? { ...biomeConfig, propMeta: updatedMeta } : null,
        activeBiomeSection: key,
        nodes: sectionNodes,
        edges: sectionEdges,
        outputNodeId: null,
        selectedNodeId: null,
      });
      saveSession({ activeBiomeSection: key });
      useUIStore.getState().reloadBookmarks(undefined, undefined, key);
      markDirty();
      return key;
    },

    replacePropSectionGraph: (propIndex, nodes, edges, meta) => {
      const { biomeSections, biomeConfig, activeBiomeSection } = get();
      if (!biomeSections) return;

      const key = `Props[${propIndex}]`;
      if (!biomeSections[key]) return;

      const sectionNodes = structuredClone(nodes);
      const sectionEdges = structuredClone(edges);
      const initialEntry: SectionHistoryEntry = {
        nodes: sectionNodes,
        edges: sectionEdges,
        outputNodeId: null,
        label: "Replaced from source",
      };
      const updatedSection: BiomeSectionData = {
        nodes: sectionNodes,
        edges: sectionEdges,
        outputNodeId: null,
        history: [initialEntry],
        historyIndex: 0,
      };

      const updatedMeta = biomeConfig ? [...biomeConfig.propMeta] : [];
      if (meta && updatedMeta[propIndex]) {
        updatedMeta[propIndex] = { ...updatedMeta[propIndex], ...meta };
      }

      const patch: Partial<EditorState> = {
        biomeSections: { ...biomeSections, [key]: updatedSection },
        biomeConfig: biomeConfig ? { ...biomeConfig, propMeta: updatedMeta } : null,
      };

      if (activeBiomeSection === key) {
        patch.nodes = sectionNodes;
        patch.edges = sectionEdges;
        patch.outputNodeId = null;
        patch.selectedNodeId = null;
      }

      set(patch);
      markDirty();
    },

    removePropSection: (key: string) => {
      const { biomeSections, activeBiomeSection, biomeConfig, nodes, edges, outputNodeId } = get();
      if (!biomeSections || !key.startsWith("Props[")) return;

      // Sync the active section's live canvas state back before modifying
      const synced = { ...biomeSections };
      if (activeBiomeSection && synced[activeBiomeSection]) {
        synced[activeBiomeSection] = {
          ...synced[activeBiomeSection],
          nodes: structuredClone(nodes),
          edges: structuredClone(edges),
          outputNodeId,
        };
      }

      delete synced[key];

      // Collect remaining Props with their ORIGINAL indices (for correct meta mapping)
      const remainingProps = sortPropSectionKeys(
        Object.keys(synced).filter((k) => k.startsWith("Props[")),
      )
        .map((k) => {
          const origIdx = parseInt(/\[(\d+)\]/.exec(k)?.[1] ?? "0");
          return { section: synced[k], meta: biomeConfig?.propMeta[origIdx] ?? { Runtime: 0, Skip: false } };
        });

      // Remove old prop keys
      for (const k of Object.keys(synced)) {
        if (k.startsWith("Props[")) delete synced[k];
      }

      // Re-add with contiguous indices
      for (let i = 0; i < remainingProps.length; i++) {
        synced[`Props[${i}]`] = remainingProps[i].section;
      }

      // Update propMeta to match
      const updatedMeta = remainingProps.map((p) => p.meta);

      // If the removed section was active, switch to Terrain
      const newActive = activeBiomeSection === key ? "Terrain" : activeBiomeSection;
      const switchTarget = newActive && synced[newActive] ? newActive : Object.keys(synced)[0] ?? null;

      const result: Partial<EditorState> = {
        biomeSections: synced,
        biomeConfig: biomeConfig ? { ...biomeConfig, propMeta: updatedMeta } : null,
      };

      if (switchTarget !== activeBiomeSection) {
        const targetData = switchTarget ? synced[switchTarget] : null;
        result.activeBiomeSection = switchTarget;
        result.nodes = targetData ? structuredClone(targetData.nodes) : [];
        result.edges = targetData ? structuredClone(targetData.edges) : [];
        result.outputNodeId = targetData?.outputNodeId ?? null;
        result.selectedNodeId = null;
      }

      set(result);
      markDirty();
    },

    duplicatePropSection: (propIndex: number) => {
      const { biomeSections, activeBiomeSection, biomeConfig, nodes, edges, outputNodeId } = get();
      if (!biomeSections) return null;

      const sourceKey = `Props[${propIndex}]`;
      if (!biomeSections[sourceKey]) return null;

      const synced = { ...biomeSections };
      if (activeBiomeSection && synced[activeBiomeSection]) {
        synced[activeBiomeSection] = {
          ...synced[activeBiomeSection],
          nodes: structuredClone(nodes),
          edges: structuredClone(edges),
          outputNodeId,
        };
      }

      const ordered = collectOrderedPropSections(synced, biomeConfig);
      const source = ordered[propIndex];
      if (!source) return null;

      const clonedNodes = structuredClone(source.section.nodes);
      const clonedEdges = structuredClone(source.section.edges);
      const clone: PropSectionBundle = {
        section: {
          nodes: clonedNodes,
          edges: clonedEdges,
          outputNodeId: source.section.outputNodeId,
          history: [{
            nodes: structuredClone(clonedNodes),
            edges: structuredClone(clonedEdges),
            outputNodeId: source.section.outputNodeId ?? null,
            label: "Duplicated",
          }],
          historyIndex: 0,
        },
        meta: { ...source.meta },
      };

      ordered.splice(propIndex + 1, 0, clone);
      const updatedSections = rewritePropSectionKeys(synced, ordered);
      const updatedMeta = ordered.map((entry) => entry.meta);
      const newKey = `Props[${propIndex + 1}]`;

      set({
        biomeSections: updatedSections,
        biomeConfig: biomeConfig ? { ...biomeConfig, propMeta: updatedMeta } : null,
        activeBiomeSection: newKey,
        nodes: structuredClone(clone.section.nodes),
        edges: structuredClone(clone.section.edges),
        outputNodeId: clone.section.outputNodeId ?? null,
        selectedNodeId: null,
      });
      saveSession({ activeBiomeSection: newKey });
      useUIStore.getState().reloadBookmarks(undefined, undefined, newKey);
      markDirty();
      return newKey;
    },

    reorderPropSection: (fromIndex: number, toIndex: number) => {
      const { biomeSections, activeBiomeSection, biomeConfig, nodes, edges, outputNodeId } = get();
      if (!biomeSections || fromIndex === toIndex) return;

      const synced = { ...biomeSections };
      if (activeBiomeSection && synced[activeBiomeSection]) {
        synced[activeBiomeSection] = {
          ...synced[activeBiomeSection],
          nodes: structuredClone(nodes),
          edges: structuredClone(edges),
          outputNodeId,
        };
      }

      const ordered = collectOrderedPropSections(synced, biomeConfig);
      if (fromIndex < 0 || fromIndex >= ordered.length || toIndex < 0 || toIndex >= ordered.length) {
        return;
      }

      const [moved] = ordered.splice(fromIndex, 1);
      ordered.splice(toIndex, 0, moved);

      const updatedSections = rewritePropSectionKeys(synced, ordered);
      const updatedMeta = ordered.map((entry) => entry.meta);

      let newActive = activeBiomeSection;
      if (activeBiomeSection?.startsWith("Props[")) {
        const activeIdx = parseInt(/\[(\d+)\]/.exec(activeBiomeSection)?.[1] ?? "0", 10);
        if (activeIdx === fromIndex) {
          newActive = `Props[${toIndex}]`;
        } else if (fromIndex < activeIdx && toIndex >= activeIdx) {
          newActive = `Props[${activeIdx - 1}]`;
        } else if (fromIndex > activeIdx && toIndex <= activeIdx) {
          newActive = `Props[${activeIdx + 1}]`;
        }
      }

      const patch: Partial<EditorState> = {
        biomeSections: updatedSections,
        biomeConfig: biomeConfig ? { ...biomeConfig, propMeta: updatedMeta } : null,
      };

      if (newActive !== activeBiomeSection) {
        const targetData = newActive ? updatedSections[newActive] : null;
        patch.activeBiomeSection = newActive;
        patch.nodes = targetData ? structuredClone(targetData.nodes) : [];
        patch.edges = targetData ? structuredClone(targetData.edges) : [];
        patch.outputNodeId = targetData?.outputNodeId ?? null;
        patch.selectedNodeId = null;
        saveSession({ activeBiomeSection: newActive });
        if (newActive) {
          useUIStore.getState().reloadBookmarks(undefined, undefined, newActive);
        }
      }

      set(patch);
      markDirty();
    },
  };
};
