import { memo } from "react";
import {
  Braces,
  GitCompareArrows,
  PanelLeft,
  PanelTop,
  ScanLine,
  Workflow,
} from "lucide-react";
import { usePreviewStore } from "@/stores/previewStore";
import type { ViewMode, SplitDirection } from "@/stores/previewStore";
import { chromeIconClass, ViewModeSegmentBar } from "@/components/ui/editorChrome";

type PresetId = "graph" | "preview" | "split-h" | "split-v" | "compare" | "json";

interface Preset {
  id: PresetId;
  label: string;
  icon: React.ReactNode;
  activate: (
    setViewMode: (vm: ViewMode) => void,
    setSplitDirection: (dir: SplitDirection) => void,
  ) => void;
  isActive: (vm: ViewMode, dir: SplitDirection) => boolean;
}

const PRESETS: Preset[] = [
  {
    id: "graph",
    label: "Graph only",
    icon: <Workflow className={chromeIconClass} strokeWidth={2} />,
    activate: (setViewMode) => setViewMode("graph"),
    isActive: (vm) => vm === "graph",
  },
  {
    id: "preview",
    label: "Preview only",
    icon: <ScanLine className={chromeIconClass} strokeWidth={2} />,
    activate: (setViewMode) => setViewMode("preview"),
    isActive: (vm) => vm === "preview",
  },
  {
    id: "split-h",
    label: "Split horizontal (graph above preview)",
    icon: <PanelTop className={chromeIconClass} strokeWidth={2} />,
    activate: (setViewMode, setSplitDirection) => {
      setViewMode("split");
      setSplitDirection("horizontal");
    },
    isActive: (vm, dir) => vm === "split" && dir === "horizontal",
  },
  {
    id: "split-v",
    label: "Split vertical (graph beside preview)",
    icon: <PanelLeft className={chromeIconClass} strokeWidth={2} />,
    activate: (setViewMode, setSplitDirection) => {
      setViewMode("split");
      setSplitDirection("vertical");
    },
    isActive: (vm, dir) => vm === "split" && dir === "vertical",
  },
  {
    id: "compare",
    label: "Compare previews",
    icon: <GitCompareArrows className={chromeIconClass} strokeWidth={2} />,
    activate: (setViewMode) => setViewMode("compare"),
    isActive: (vm) => vm === "compare",
  },
  {
    id: "json",
    label: "JSON editor",
    icon: <Braces className={chromeIconClass} strokeWidth={2} />,
    activate: (setViewMode) => setViewMode("json"),
    isActive: (vm) => vm === "json",
  },
];

export const LayoutPresetPicker = memo(function LayoutPresetPicker() {
  const viewMode = usePreviewStore((s) => s.viewMode);
  const setViewMode = usePreviewStore((s) => s.setViewMode);
  const splitDirection = usePreviewStore((s) => s.splitDirection);
  const setSplitDirection = usePreviewStore((s) => s.setSplitDirection);

  const activeId: PresetId =
    viewMode === "split"
      ? splitDirection === "vertical"
        ? "split-v"
        : "split-h"
      : viewMode;

  return (
    <ViewModeSegmentBar
      ariaLabel="Editor view mode"
      modes={PRESETS.map((preset) => ({
        id: preset.id,
        label: preset.label,
        icon: preset.icon,
      }))}
      active={activeId}
      onChange={(id) => {
        const preset = PRESETS.find((p) => p.id === id);
        if (preset) preset.activate(setViewMode, setSplitDirection);
      }}
    />
  );
});

const LAYOUT_PICKER_HIDDEN_CONTEXTS = new Set([
  "Settings",
  "Weather",
  "Environment",
  "Instance",
  "RawJson",
]);

/** True when the center panel supports graph / preview / split layouts. */
export function shouldShowLayoutPresetPicker(editingContext: string | null): boolean {
  if (!editingContext) return false;
  return !LAYOUT_PICKER_HIDDEN_CONTEXTS.has(editingContext);
}

