import { memo, useCallback, useRef, useState } from "react";
import { LayoutPanelLeft, Map } from "lucide-react";
import { useEditorStore } from "@/stores/editorStore";
import { usePreviewStore } from "@/stores/previewStore";
import { useUIStore } from "@/stores/uiStore";
import { EditorCanvas } from "./EditorCanvas";
import { WorldBiomeMapperPanel } from "./biomeMapper/WorldBiomeMapperPanel";
import { BiomeSelectorMapPanel } from "./biomeMapper/BiomeSelectorMapPanel";
import { WorldStructureSettingsPanel } from "./biomeMapper/WorldStructureSettingsPanel";
import { ImportWorldStructureDialog } from "@/components/dialogs/ImportWorldStructureDialog";
import { BiomeSectionTabs } from "./BiomeSectionTabs";
import { BiomeOverviewCanvas } from "./BiomeOverviewCanvas";
import { SettingsEditorView } from "./SettingsEditorView";
import { WeatherEditorView } from "./WeatherEditorView";
import { EnvironmentEditorView } from "./EnvironmentEditorView";
import { JsonEditorView } from "./JsonEditorView";
import { InstanceEditorView } from "./InstanceEditorView";
import { PreviewPanel } from "../preview/PreviewPanel";
import { ComparisonView } from "../preview/ComparisonView";
import { EditorContextBar } from "./EditorContextBar";
import { EditorWorkspace } from "./EditorWorkspace";
import { usePropEditingContext, useAutoSplitOnPropSection, usePropPreviewSectionDefaults } from "@/hooks/usePropEditingContext";
import { usePreviewPropertiesLayout } from "@/hooks/usePreviewPropertiesLayout";

const SplitView = memo(function SplitView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const splitRatio = usePreviewStore((s) => s.splitRatio);
  const setSplitRatio = usePreviewStore((s) => s.setSplitRatio);
  const splitDirection = usePreviewStore((s) => s.splitDirection);
  const dragging = useRef(false);
  const isVertical = splitDirection === "vertical";

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = isVertical
        ? Math.max(0.15, Math.min(0.85, (ev.clientX - rect.left) / rect.width))
        : Math.max(0.15, Math.min(0.85, (ev.clientY - rect.top) / rect.height));
      setSplitRatio(ratio);
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [setSplitRatio, isVertical]);

  if (isVertical) {
    return (
      <div ref={containerRef} className="flex flex-row h-full">
        <div style={{ width: `${splitRatio * 100}%` }} className="min-w-0 overflow-hidden">
          <EditorCanvas />
        </div>
        <div
          className="shrink-0 w-1.5 bg-tn-border hover:bg-tn-accent/50 cursor-col-resize transition-colors"
          onMouseDown={onMouseDown}
        />
        <div style={{ flex: 1 }} className="min-w-0 overflow-hidden">
          <PreviewPanel />
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      <div style={{ height: `${splitRatio * 100}%` }} className="min-h-0 overflow-hidden">
        <EditorCanvas />
      </div>
      <div
        className="shrink-0 h-1.5 bg-tn-border hover:bg-tn-accent/50 cursor-row-resize transition-colors"
        onMouseDown={onMouseDown}
      />
      <div style={{ flex: 1 }} className="min-h-0 overflow-hidden">
        <PreviewPanel />
      </div>
    </div>
  );
});

/** Density-context view: canvas/preview with floating view-mode overlay */
const DensityView = memo(function DensityView() {
  const viewMode = usePreviewStore((s) => s.viewMode);
  const originalWrapper = useEditorStore((s) => s.originalWrapper);
  const setJsonViewDraft = useEditorStore((s) => s.setJsonViewDraft);

  return (
    <div className="flex flex-col h-full">
      <EditorContextBar />
      <EditorWorkspace>
        {viewMode === "graph" && <EditorCanvas />}
        {viewMode === "preview" && <PreviewPanel />}
        {viewMode === "split" && <SplitView />}
        {viewMode === "compare" && <ComparisonView />}
        {viewMode === "json" && <JsonEditorView content={originalWrapper} onChange={setJsonViewDraft} />}
      </EditorWorkspace>
    </div>
  );
});

export function CenterPanel() {
  const editingContext = useEditorStore((s) => s.editingContext);
  const { isPropContext, propSectionKey } = usePropEditingContext();
  useAutoSplitOnPropSection(isPropContext);
  usePropPreviewSectionDefaults(isPropContext, propSectionKey);
  usePreviewPropertiesLayout();

  if (editingContext === "InvalidJson") {
    return <InvalidJsonReadOnlyView />;
  }

  if (editingContext === "NoiseRange") {
    return <NoiseRangeView />;
  }

  if (editingContext === "Settings") {
    return <SettingsEditorView />;
  }

  if (editingContext === "Weather") {
    return <WeatherEditorView />;
  }

  if (editingContext === "Environment") {
    return <EnvironmentEditorView />;
  }

  if (editingContext === "Instance") {
    return <InstanceEditorView />;
  }

  if (editingContext === "RawJson") {
    return <JsonEditorView />;
  }

  if (editingContext === "Biome") {
    return <BiomeView />;
  }

  // Density and other node-graph contexts get the view mode tabs
  if (editingContext) {
    return <DensityView />;
  }

  return <EditorCanvas />;
}

function InvalidJsonReadOnlyView() {
  const invalidJsonFile = useEditorStore((s) => s.invalidJsonFile);

  if (!invalidJsonFile) {
    return (
      <div className="flex h-full items-center justify-center bg-tn-bg text-sm text-tn-text-muted">
        No invalid JSON file is open.
      </div>
    );
  }

  const fileName = invalidJsonFile.path.split(/[/\\]/).pop() ?? invalidJsonFile.path;

  return (
    <div className="flex h-full min-h-0 flex-col bg-tn-bg">
      <div
        role="alert"
        className="shrink-0 border-b border-amber-500/30 bg-amber-950/35 px-4 py-3 text-sm text-amber-100"
      >
        <div className="font-medium">Invalid JSON opened read-only</div>
        <div className="mt-1 text-xs leading-relaxed text-amber-100/80">
          {fileName} could not be parsed, so visual editing and saving are disabled to prevent overwriting this file.
          Fix the JSON externally, then reopen it.
        </div>
        <div className="mt-2 rounded border border-amber-500/20 bg-black/20 px-2 py-1 font-mono text-[11px] text-amber-50/90">
          {invalidJsonFile.error}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <JsonEditorView rawText={invalidJsonFile.rawText} readOnly />
      </div>
    </div>
  );
}

/** Side-by-side or stacked biome mapper + selector density graph. */
const NoiseRangeSplitView = memo(function NoiseRangeSplitView({
  mapperPanel,
}: {
  mapperPanel: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const splitRatio = usePreviewStore((s) => s.splitRatio);
  const setSplitRatio = usePreviewStore((s) => s.setSplitRatio);
  const splitDirection = usePreviewStore((s) => s.splitDirection);
  const dragging = useRef(false);
  const isVertical = splitDirection === "vertical";

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = isVertical
        ? Math.max(0.2, Math.min(0.8, (ev.clientX - rect.left) / rect.width))
        : Math.max(0.2, Math.min(0.8, (ev.clientY - rect.top) / rect.height));
      setSplitRatio(ratio);
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [setSplitRatio, isVertical]);

  if (isVertical) {
    return (
      <div ref={containerRef} className="flex h-full flex-row">
        <div style={{ width: `${splitRatio * 100}%` }} className="min-w-0 overflow-hidden border-r border-tn-border">
          {mapperPanel}
        </div>
        <div
          className="w-1.5 shrink-0 cursor-col-resize bg-tn-border transition-colors hover:bg-tn-accent/50"
          onMouseDown={onMouseDown}
        />
        <div className="min-w-0 flex-1 overflow-hidden">
          <EditorCanvas />
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex h-full flex-col">
      <div style={{ height: `${splitRatio * 100}%` }} className="min-h-0 shrink-0 overflow-hidden border-b border-tn-border">
        {mapperPanel}
      </div>
      <div
        className="h-1.5 shrink-0 cursor-row-resize bg-tn-border transition-colors hover:bg-tn-accent/50"
        onMouseDown={onMouseDown}
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        <EditorCanvas />
      </div>
    </div>
  );
});

/** NoiseRange: mapper-first layout; selector graph and preview via layout picker. */
const NoiseRangeView = memo(function NoiseRangeView() {
  const viewMode = usePreviewStore((s) => s.viewMode);
  const surface = useUIStore((s) => s.noiseRangeSurface);
  const setSurface = useUIStore((s) => s.setNoiseRangeSurface);
  const originalWrapper = useEditorStore((s) => s.originalWrapper);
  const setJsonViewDraft = useEditorStore((s) => s.setJsonViewDraft);
  const [importOpen, setImportOpen] = useState(false);

  const openSelectorGraph = useCallback(() => {
    setSurface("selector");
    usePreviewStore.getState().setViewMode("graph");
  }, [setSurface]);

  const openSplitView = useCallback(() => {
    setSurface("split");
    const preview = usePreviewStore.getState();
    preview.setViewMode("split");
    preview.setSplitDirection("vertical");
  }, [setSurface]);

  const mapperPanel = (
    <WorldBiomeMapperPanel
      onImport={() => setImportOpen(true)}
      onOpenSelectorGraph={openSelectorGraph}
      onOpenSplitView={openSplitView}
      mapPanel={<BiomeSelectorMapPanel />}
      worldSettingsPanel={<WorldStructureSettingsPanel />}
    />
  );

  return (
    <div className="flex h-full flex-col">
      <EditorContextBar />
      <ImportWorldStructureDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <EditorWorkspace>
        {viewMode === "preview" && <PreviewPanel />}
        {viewMode === "compare" && <ComparisonView />}
        {viewMode === "json" && (
          <JsonEditorView content={originalWrapper} onChange={setJsonViewDraft} />
        )}
        {viewMode !== "preview" && viewMode !== "compare" && viewMode !== "json" && (
          surface === "selector" ? (
            <EditorCanvas />
          ) : surface === "split" && viewMode === "split" ? (
            <NoiseRangeSplitView mapperPanel={mapperPanel} />
          ) : (
            mapperPanel
          )
        )}
      </EditorWorkspace>
    </div>
  );
});

/** Biome graph surface — section tab editor or unified overview. */
const BiomeGraphCanvas = memo(function BiomeGraphCanvas() {
  const biomeCanvasMode = useEditorStore((s) => s.biomeCanvasMode);
  return biomeCanvasMode === "overview" ? <BiomeOverviewCanvas /> : <EditorCanvas />;
});

/** Split view that respects biome overview mode in the graph pane. */
const BiomeSplitView = memo(function BiomeSplitView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const splitRatio = usePreviewStore((s) => s.splitRatio);
  const setSplitRatio = usePreviewStore((s) => s.setSplitRatio);
  const splitDirection = usePreviewStore((s) => s.splitDirection);
  const dragging = useRef(false);
  const isVertical = splitDirection === "vertical";

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = isVertical
        ? Math.max(0.15, Math.min(0.85, (ev.clientX - rect.left) / rect.width))
        : Math.max(0.15, Math.min(0.85, (ev.clientY - rect.top) / rect.height));
      setSplitRatio(ratio);
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [setSplitRatio, isVertical]);

  if (isVertical) {
    return (
      <div ref={containerRef} className="flex flex-row h-full">
        <div style={{ width: `${splitRatio * 100}%` }} className="min-w-0 overflow-hidden">
          <BiomeGraphCanvas />
        </div>
        <div
          className="shrink-0 w-1.5 bg-tn-border hover:bg-tn-accent/50 cursor-col-resize transition-colors"
          onMouseDown={onMouseDown}
        />
        <div style={{ flex: 1 }} className="min-w-0 overflow-hidden">
          <PreviewPanel />
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      <div style={{ height: `${splitRatio * 100}%` }} className="min-h-0 overflow-hidden">
        <BiomeGraphCanvas />
      </div>
      <div
        className="shrink-0 h-1.5 bg-tn-border hover:bg-tn-accent/50 cursor-row-resize transition-colors"
        onMouseDown={onMouseDown}
      />
      <div style={{ flex: 1 }} className="min-h-0 overflow-hidden">
        <PreviewPanel />
      </div>
    </div>
  );
});

/** Toggle between per-section tabs and unified Hytale-style overview canvas. */
const BiomeCanvasModeToggle = memo(function BiomeCanvasModeToggle() {
  const biomeCanvasMode = useEditorStore((s) => s.biomeCanvasMode);
  const setBiomeCanvasMode = useEditorStore((s) => s.setBiomeCanvasMode);
  const flushActiveBiomeSection = useEditorStore((s) => s.flushActiveBiomeSection);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-tn-border bg-tn-bg/80">
      <span className="text-[10px] font-medium uppercase tracking-wide text-tn-text-muted/80">
        Canvas
      </span>
      <div
        className="inline-flex rounded-lg border border-tn-border bg-tn-surface p-0.5"
        role="tablist"
        aria-label="Biome canvas mode"
      >
        <button
          type="button"
          role="tab"
          aria-selected={biomeCanvasMode === "tabs"}
          onClick={() => setBiomeCanvasMode("tabs")}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors ${
            biomeCanvasMode === "tabs"
              ? "bg-tn-accent/15 text-tn-accent shadow-sm"
              : "text-tn-text-muted hover:text-tn-text hover:bg-white/5"
          }`}
        >
          <LayoutPanelLeft className="h-3 w-3" aria-hidden />
          Section tabs
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={biomeCanvasMode === "overview"}
          onClick={() => {
            flushActiveBiomeSection();
            setBiomeCanvasMode("overview");
          }}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors ${
            biomeCanvasMode === "overview"
              ? "bg-tn-accent/15 text-tn-accent shadow-sm"
              : "text-tn-text-muted hover:text-tn-text hover:bg-white/5"
          }`}
        >
          <Map className="h-3 w-3" aria-hidden />
          Overview
        </button>
      </div>
    </div>
  );
});

/** Biome layout with section tabs header + floating view mode overlay */
const BiomeView = memo(function BiomeView() {
  const viewMode = usePreviewStore((s) => s.viewMode);
  const originalWrapper = useEditorStore((s) => s.originalWrapper);
  const setJsonViewDraft = useEditorStore((s) => s.setJsonViewDraft);
  const biomeCanvasMode = useEditorStore((s) => s.biomeCanvasMode);
  const { isPropContext } = usePropEditingContext();
  useAutoSplitOnPropSection(isPropContext);

  const showSectionTabs = biomeCanvasMode === "tabs";

  return (
    <div className="flex flex-col h-full">
      <BiomeCanvasModeToggle />
      {showSectionTabs ? (
        <div className="shrink-0 bg-tn-surface border-b border-tn-border overflow-x-auto">
          <BiomeSectionTabs />
        </div>
      ) : null}
      <EditorContextBar />
      <EditorWorkspace>
        {viewMode === "graph" && <BiomeGraphCanvas />}
        {viewMode === "preview" && <PreviewPanel />}
        {viewMode === "split" && <BiomeSplitView />}
        {viewMode === "compare" && <ComparisonView />}
        {viewMode === "json" && <JsonEditorView content={originalWrapper} onChange={setJsonViewDraft} />}
      </EditorWorkspace>
    </div>
  );
});
