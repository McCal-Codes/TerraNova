import { memo } from "react";
import { Braces, GitCompareArrows, PanelLeft, PanelTop, ScanLine, Workflow } from "lucide-react";
import { usePreviewStore } from "@/stores/previewStore";
import type { ViewMode, SplitDirection } from "@/stores/previewStore";
import { useUIStore, type NoiseRangeSurface } from "@/stores/uiStore";
import { chromeIconClass, ViewModeSegmentBar } from "@/components/ui/editorChrome";

type NoiseRangePresetId =
  | "placement"
  | "selector"
  | "split-v"
  | "split-h"
  | "preview"
  | "compare"
  | "json";

interface NoiseRangePreset {
  id: NoiseRangePresetId;
  label: string;
  icon: React.ReactNode;
  activate: (
    setSurface: (surface: NoiseRangeSurface) => void,
    setViewMode: (vm: ViewMode) => void,
    setSplitDirection: (dir: SplitDirection) => void,
  ) => void;
  isActive: (surface: NoiseRangeSurface, vm: ViewMode, dir: SplitDirection) => boolean;
}

const PRESETS: NoiseRangePreset[] = [
  {
    id: "placement",
    label: "Biome placement",
    icon: <PanelTop className={chromeIconClass} strokeWidth={2} />,
    activate: (setSurface, setViewMode) => {
      setSurface("placement");
      setViewMode("graph");
    },
    isActive: (surface, vm) => surface === "placement" && vm === "graph",
  },
  {
    id: "selector",
    label: "Selector graph only",
    icon: <Workflow className={chromeIconClass} strokeWidth={2} />,
    activate: (setSurface, setViewMode) => {
      setSurface("selector");
      setViewMode("graph");
    },
    isActive: (surface, vm) => surface === "selector" && vm === "graph",
  },
  {
    id: "split-v",
    label: "Placement beside selector graph",
    icon: <PanelLeft className={chromeIconClass} strokeWidth={2} />,
    activate: (setSurface, setViewMode, setSplitDirection) => {
      setSurface("split");
      setViewMode("split");
      setSplitDirection("vertical");
    },
    isActive: (surface, vm, dir) => surface === "split" && vm === "split" && dir === "vertical",
  },
  {
    id: "split-h",
    label: "Placement above selector graph",
    icon: <PanelTop className={chromeIconClass} strokeWidth={2} />,
    activate: (setSurface, setViewMode, setSplitDirection) => {
      setSurface("split");
      setViewMode("split");
      setSplitDirection("horizontal");
    },
    isActive: (surface, vm, dir) => surface === "split" && vm === "split" && dir === "horizontal",
  },
  {
    id: "preview",
    label: "Density preview",
    icon: <ScanLine className={chromeIconClass} strokeWidth={2} />,
    activate: (_setSurface, setViewMode) => setViewMode("preview"),
    isActive: (_surface, vm) => vm === "preview",
  },
  {
    id: "compare",
    label: "Compare previews",
    icon: <GitCompareArrows className={chromeIconClass} strokeWidth={2} />,
    activate: (_setSurface, setViewMode) => setViewMode("compare"),
    isActive: (_surface, vm) => vm === "compare",
  },
  {
    id: "json",
    label: "JSON editor",
    icon: <Braces className={chromeIconClass} strokeWidth={2} />,
    activate: (_setSurface, setViewMode) => setViewMode("json"),
    isActive: (_surface, vm) => vm === "json",
  },
];

export const NoiseRangeLayoutPicker = memo(function NoiseRangeLayoutPicker() {
  const surface = useUIStore((s) => s.noiseRangeSurface);
  const setSurface = useUIStore((s) => s.setNoiseRangeSurface);
  const viewMode = usePreviewStore((s) => s.viewMode);
  const setViewMode = usePreviewStore((s) => s.setViewMode);
  const splitDirection = usePreviewStore((s) => s.splitDirection);
  const setSplitDirection = usePreviewStore((s) => s.setSplitDirection);

  const activeId =
    PRESETS.find((preset) => preset.isActive(surface, viewMode, splitDirection))?.id ?? "placement";

  return (
    <ViewModeSegmentBar
      ariaLabel="World structure layout"
      modes={PRESETS.map((preset) => ({
        id: preset.id,
        label: preset.label,
        icon: preset.icon,
      }))}
      active={activeId}
      onChange={(id) => {
        const preset = PRESETS.find((p) => p.id === id);
        if (preset) preset.activate(setSurface, setViewMode, setSplitDirection);
      }}
    />
  );
});
