import type { BiomeMaterialConfig } from "@/utils/materialResolver";
import type { SliceCreator, ConfigSliceState, SettingsConfig, InstanceConfig, InvalidJsonFileState, BiomeCanvasMode } from "./types";
import type { ImportLayoutMode, LayoutOffset } from "@/utils/applyHytaleImportLayout";

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export const configInitialState = {
  settingsConfig: null as SettingsConfig | null,
  instanceConfig: null as InstanceConfig | null,
  contentFields: { Base: 100, Water: 100, Bedrock: 0 } as Record<string, number>,
  materialConfig: null as BiomeMaterialConfig | null,
  originalWrapper: null as Record<string, unknown> | null,
  preservedNodeEditorMetadata: null,
  importLayoutMode: null as ImportLayoutMode | null,
  hytaleLayoutOffsets: null as Record<string, LayoutOffset> | null,
  biomeCanvasMode: "tabs" as BiomeCanvasMode,
  editingContext: null as string | null,
  rawJsonContent: null as Record<string, unknown> | null,
  jsonViewDraft: null as string | null,
  invalidJsonFile: null as InvalidJsonFileState | null,
};

// ---------------------------------------------------------------------------
// Slice creator
// ---------------------------------------------------------------------------

export const createConfigSlice: SliceCreator<ConfigSliceState> = (set) => ({
  ...configInitialState,

  setSettingsConfig: (config) => set({ settingsConfig: config }),
  setInstanceConfig: (config) => set({ instanceConfig: config }),
  setContentFields: (fields) => set({ contentFields: fields }),
  setMaterialConfig: (config) => set({ materialConfig: config }),
  setOriginalWrapper: (wrapper) => set({ originalWrapper: wrapper }),
  setPreservedNodeEditorMetadata: (metadata) => set({ preservedNodeEditorMetadata: metadata }),
  setImportLayoutMode: (mode) => set({ importLayoutMode: mode }),
  setHytaleLayoutOffsets: (offsets) => set({ hytaleLayoutOffsets: offsets }),
  setBiomeCanvasMode: (mode) => set({ biomeCanvasMode: mode }),
  setEditingContext: (context) => set({ editingContext: context }),
  setRawJsonContent: (content) => set({ rawJsonContent: content }),
  setJsonViewDraft: (draft) => set({ jsonViewDraft: draft }),
  setInvalidJsonFile: (file) => set({ invalidJsonFile: file }),
});
