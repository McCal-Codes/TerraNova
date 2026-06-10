import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronUp, Wrench } from "lucide-react";
import { useEditorStore } from "@/stores/editorStore";
import { usePreviewStore } from "@/stores/previewStore";
import { useProjectStore } from "@/stores/projectStore";
import { sanitizeForInspector } from "@/utils/storeInspectorSnapshot";
import { copyTextToClipboard } from "@/utils/devTools";
import { useToastStore } from "@/stores/toastStore";
import { PreviewDebugPanel } from "@/components/preview/PreviewDebugPanel";
import { ExportDiffView } from "./ExportDiffView";
import {
  DevCheckbox,
  DevCodeBlock,
  DevIconButton,
  DevPanelHeader,
  DevSegmentedControl,
  DevTabBar,
  DevToolbar,
} from "./devUi";

type DevTab = "stores" | "preview" | "export-diff";
type StoreTarget = "editor" | "preview";

const DOCK_HEIGHT_KEY = "tn-dev-tools-dock-height";
const DOCK_COLLAPSED_KEY = "tn-dev-tools-dock-collapsed";
const DEFAULT_DOCK_HEIGHT = 200;
const LIVE_REFRESH_MS = 500;

const TABS = [
  { id: "stores" as const, label: "Stores" },
  { id: "preview" as const, label: "Preview" },
  { id: "export-diff" as const, label: "Export diff" },
];

function readDockHeight(): number {
  try {
    const n = Number(localStorage.getItem(DOCK_HEIGHT_KEY));
    if (Number.isFinite(n) && n >= 120 && n <= 480) return n;
  } catch {
    // ignore
  }
  return DEFAULT_DOCK_HEIGHT;
}

function readDockCollapsed(): boolean {
  try {
    const stored = localStorage.getItem(DOCK_COLLAPSED_KEY);
    if (stored === "0") return false;
    if (stored === "1") return true;
  } catch {
    // ignore
  }
  return true;
}

function buildEditorSnapshot(includeBuffers: boolean) {
  const s = useEditorStore.getState();
  return sanitizeForInspector(
    {
      editingContext: s.editingContext,
      activeBiomeSection: s.activeBiomeSection,
      selectedNodeId: s.selectedNodeId,
      outputNodeId: s.outputNodeId,
      nodeCount: s.nodes.length,
      edgeCount: s.edges.length,
      biomeConfig: s.biomeConfig,
      contentFields: s.contentFields,
      nodes: s.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
      })),
      edges: s.edges,
    },
    includeBuffers,
  );
}

function buildPreviewSnapshot(includeBuffers: boolean) {
  const s = usePreviewStore.getState();
  return sanitizeForInspector(
    {
      mode: s.mode,
      viewMode: s.viewMode,
      resolution: s.resolution,
      rangeMin: s.rangeMin,
      rangeMax: s.rangeMax,
      yLevel: s.yLevel,
      isLoading: s.isLoading,
      previewError: s.previewError,
      selectedPreviewNodeId: s.selectedPreviewNodeId,
      fidelityScore: s.fidelityScore,
      values: s.values,
      voxelDensities: s.voxelDensities,
      propManualPrefabPath: s.propManualPrefabPath,
    },
    includeBuffers,
  );
}

function buildStoreJson(target: StoreTarget, includeBuffers: boolean): string {
  const project = useProjectStore.getState();
  const base = target === "editor" ? buildEditorSnapshot(includeBuffers) : buildPreviewSnapshot(includeBuffers);
  return JSON.stringify(
    {
      project: {
        projectPath: project.projectPath,
        currentFile: project.currentFile,
        isDirty: project.isDirty,
      },
      [target === "editor" ? "editorStore" : "previewStore"]: base,
    },
    null,
    2,
  );
}

function StoreInspector() {
  const [target, setTarget] = useState<StoreTarget>("editor");
  const [includeBuffers, setIncludeBuffers] = useState(false);
  const [live, setLive] = useState(false);
  const [json, setJson] = useState("");
  const addToast = useToastStore((s) => s.addToast);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rebuild = useCallback(() => {
    setJson(buildStoreJson(target, includeBuffers));
  }, [target, includeBuffers]);

  useEffect(() => {
    rebuild();
  }, [rebuild]);

  useEffect(() => {
    if (!live) return;

    const schedule = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setJson(buildStoreJson(target, includeBuffers));
      }, LIVE_REFRESH_MS);
    };

    const unsubEditor = useEditorStore.subscribe(schedule);
    const unsubPreview = usePreviewStore.subscribe(schedule);
    const unsubProject = useProjectStore.subscribe(schedule);

    return () => {
      unsubEditor();
      unsubPreview();
      unsubProject();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [live, target, includeBuffers]);

  const copy = useCallback(() => {
    void copyTextToClipboard(json).then((ok) => {
      addToast(ok ? "Copied store snapshot" : "Copy failed", ok ? "success" : "error");
    });
  }, [json, addToast]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <DevToolbar
        trailing={
          <>
            <DevIconButton label="Refresh" icon="refresh" onClick={rebuild} />
            <DevIconButton label="Copy" icon="copy" onClick={copy} />
          </>
        }
      >
        <DevSegmentedControl
          value={target}
          onChange={setTarget}
          options={[
            { value: "editor", label: "Editor" },
            { value: "preview", label: "Preview" },
          ]}
        />
        <DevCheckbox
          label="Live update"
          checked={live}
          onChange={setLive}
        />
        <DevCheckbox
          label="Include buffers"
          checked={includeBuffers}
          onChange={setIncludeBuffers}
        />
      </DevToolbar>
      <div className="flex-1 min-h-0 border-t border-tn-border/60 bg-tn-bg/20">
        <DevCodeBlock empty="No store data">{json}</DevCodeBlock>
      </div>
    </div>
  );
}

export function DevToolsPanel() {
  const [collapsed, setCollapsed] = useState(readDockCollapsed);
  const [tab, setTab] = useState<DevTab>("stores");
  const [height, setHeight] = useState(readDockHeight);

  const setCollapsedPersisted = useCallback((value: boolean) => {
    setCollapsed(value);
    try {
      localStorage.setItem(DOCK_COLLAPSED_KEY, value ? "1" : "0");
    } catch {
      // ignore
    }
  }, []);

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startH = height;
      let latest = startH;

      function onMove(ev: MouseEvent) {
        latest = Math.min(480, Math.max(120, startH + (startY - ev.clientY)));
        setHeight(latest);
      }

      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        try {
          localStorage.setItem(DOCK_HEIGHT_KEY, String(latest));
        } catch {
          // ignore
        }
      }

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [height],
  );

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsedPersisted(false)}
        className="shrink-0 w-full border-t border-tn-border bg-tn-panel/80 flex items-center gap-2 px-3 py-1.5 text-left hover:bg-tn-surface/60 transition-colors"
        title="Open developer tools"
      >
        <Wrench className="w-3.5 h-3.5 text-tn-text-muted shrink-0" aria-hidden />
        <span className="text-[11px] text-tn-text-muted">Developer tools</span>
        <ChevronUp className="w-3.5 h-3.5 text-tn-text-muted ml-auto shrink-0" aria-hidden />
      </button>
    );
  }

  return (
    <div
      className="shrink-0 border-t border-tn-border bg-tn-panel/90 flex flex-col min-h-0"
      style={{ height }}
    >
      <div
        className="h-1 cursor-row-resize hover:bg-tn-accent/30 shrink-0"
        onMouseDown={onResizeStart}
        title="Drag to resize"
        aria-hidden
      />
      <DevPanelHeader title="Developer tools" onCollapse={() => setCollapsedPersisted(true)} collapseTitle="Close developer tools">
        <DevTabBar tabs={TABS} active={tab} onChange={setTab} />
      </DevPanelHeader>
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "stores" && <StoreInspector />}
        {tab === "preview" && <PreviewDebugPanel />}
        {tab === "export-diff" && <ExportDiffView />}
      </div>
    </div>
  );
}
