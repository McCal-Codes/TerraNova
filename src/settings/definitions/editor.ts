import { DEFAULT_FLOW_DIRECTION, type FlowDirection } from "@/constants";
import { useSettingsStore } from "@/stores/settingsStore";
import { defineSetting, type AnySettingDefinition } from "../types";

const s = () => useSettingsStore.getState();

export const EDITOR_SETTINGS: AnySettingDefinition[] = [
  defineSetting<FlowDirection>({
    id: "editor.flowDirection",
    storeKey: "flowDirection",
    category: "editor",
    section: "graph",
    label: "Graph flow direction",
    description: "Which way node connections run across the canvas.",
    defaultValue: DEFAULT_FLOW_DIRECTION,
    scopes: ["user"],
    searchTerms: ["direction", "layout", "left to right", "right to left", "lr", "rl"],
    control: {
      kind: "radio",
      options: [
        {
          value: "LR",
          label: "Left to right",
          description: "Inputs on left, output on right (TerraNova default)",
          badge: "Default",
        },
        {
          value: "RL",
          label: "Right to left",
          description: "Output on left, inputs on right (Hytale native)",
        },
      ],
    },
    read: () => s().flowDirection,
    write: (value) => s().setFlowDirection(value),
  }),

  defineSetting<boolean>({
    id: "editor.autoLayoutOnOpen",
    storeKey: "autoLayoutOnOpen",
    category: "editor",
    section: "graph",
    label: "Auto-layout on open",
    description: "Arrange nodes automatically when a project is opened.",
    defaultValue: false,
    scopes: ["user"],
    searchTerms: ["arrange", "tidy", "dagre", "automatic layout"],
    control: { kind: "toggle" },
    read: () => s().autoLayoutOnOpen,
    write: (value) => s().setAutoLayoutOnOpen(value),
  }),

  defineSetting<boolean>({
    id: "editor.showNodeIdsOnCanvas",
    storeKey: "showNodeIdsOnCanvas",
    category: "editor",
    section: "graph",
    label: "Show node IDs on canvas",
    description: "Display each node's internal identifier beneath its title.",
    defaultValue: false,
    scopes: ["user"],
    searchTerms: ["node id", "identifier", "debug"],
    control: { kind: "toggle" },
    read: () => s().showNodeIdsOnCanvas,
    write: (value) => s().setShowNodeIdsOnCanvas(value),
  }),

  defineSetting<boolean>({
    id: "editor.confirmOnNodeDelete",
    storeKey: "confirmOnNodeDelete",
    category: "editor",
    section: "editing",
    label: "Confirm before deleting nodes",
    description: "Ask for confirmation when deleting a node from the canvas.",
    defaultValue: false,
    scopes: ["user"],
    searchTerms: ["confirmation", "prompt", "delete", "remove", "undo"],
    control: { kind: "toggle" },
    read: () => s().confirmOnNodeDelete,
    write: (value) => s().setConfirmOnNodeDelete(value),
  }),

  defineSetting<boolean>({
    id: "editor.instantSave",
    storeKey: "instantSaveEnabled",
    category: "editor",
    section: "saving",
    label: "Instant save",
    description: "Write project changes to disk automatically after editing.",
    defaultValue: false,
    scopes: ["user"],
    searchTerms: ["autosave", "auto save", "automatic save", "write changes", "instant"],
    control: { kind: "toggle" },
    read: () => s().instantSaveEnabled,
    write: (value) => s().setInstantSaveEnabled(value),
  }),

  defineSetting<number>({
    id: "editor.instantSaveDebounceMs",
    storeKey: "instantSaveDebounceMs",
    category: "editor",
    section: "saving",
    label: "Save delay",
    description: "How long to wait after the last edit before saving. Recommended: 200–500 ms.",
    defaultValue: 200,
    scopes: ["user"],
    searchTerms: ["debounce", "autosave delay", "throttle", "wait"],
    control: { kind: "number", min: 100, max: 5000, step: 50, unit: "ms" },
    validate: (value) =>
      Number.isFinite(value) && value >= 100 ? null : "Save delay must be at least 100 ms.",
    read: () => s().instantSaveDebounceMs,
    write: (value) => s().setInstantSaveDebounceMs(value),
  }),
];
