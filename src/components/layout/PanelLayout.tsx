import { lazy, Suspense, useState, useCallback, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AssetTree } from "@/components/sidebar/AssetTree";
import { FileActions } from "@/components/sidebar/FileActions";
import { NodePalette } from "@/components/editor/NodePalette";
import { BookmarkPanel } from "@/components/editor/BookmarkPanel";
import { CenterPanel } from "@/components/editor/CenterPanel";
import { PropertyPanel } from "@/components/properties/PropertyPanel";

const DocsPanel = lazy(() =>
  import("@/components/docs/DocsPanel").then((m) => ({ default: m.DocsPanel })),
);
import { HistoryPanel } from "@/components/editor/HistoryPanel";
import { ValidationPanel } from "@/components/editor/ValidationPanel";
import { Toolbar } from "@/components/layout/Toolbar";
import { useGraphDiagnostics } from "@/hooks/useGraphDiagnostics";
import { PreviewEvaluationHost } from "@/components/preview/PreviewEvaluationHost";
import { useSessionRestoreFile } from "@/hooks/useSessionRestore";
import { useTauriIO } from "@/hooks/useTauriIO";
import { useUIStore, type SidebarSectionId } from "@/stores/uiStore";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import { useDiagnosticsStore } from "@/stores/diagnosticsStore";
import { useProjectLegacyStore } from "@/stores/projectLegacyStore";
import { computeIssueBadgeCount } from "@/utils/issueBadgeCount";
import { useDeveloperMode } from "@/hooks/useDeveloperMode";
import { useSettingsStore } from "@/stores/settingsStore";
import { DevToolsPanel } from "@/components/dev/DevToolsPanel";
import { ChromeIconButton, SegmentTabBar } from "@/components/ui/editorChrome";

const MIN_PANEL_WIDTH = 180;
const DEFAULT_LEFT = 240;
const DEFAULT_RIGHT = 320;
const COMPACT_RIGHT = 272;
const STORAGE_KEY = "terranova-panel-widths";

function isAssetInspectorFile(path: string | null): boolean {
  if (!path) return false;
  const normalized = path.replace(/\\/g, "/").toLowerCase();
  return normalized.includes("/server/weathers/") || normalized.includes("/server/environments/");
}

function loadPersistedWidths(): { left: number; right: number } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        left: Math.max(MIN_PANEL_WIDTH, parsed.left ?? DEFAULT_LEFT),
        right: Math.max(MIN_PANEL_WIDTH, parsed.right ?? DEFAULT_RIGHT),
      };
    }
  } catch {
    // Ignore corrupted localStorage
  }
  return { left: DEFAULT_LEFT, right: DEFAULT_RIGHT };
}

// ---------------------------------------------------------------------------
// Section configuration
// ---------------------------------------------------------------------------

const SECTION_CONFIG: Record<SidebarSectionId, { title: string; icon: string }> = {
  nodes: { title: "Nodes", icon: "\u25A6" },
  files: { title: "Files", icon: "\u2630" },
  history: { title: "History", icon: "\u21BA" },
  validation: { title: "Issues", icon: "\u26A0" },
  bookmarks: { title: "Bookmarks", icon: "\u2606" },
};

function SectionContent({ id }: { id: SidebarSectionId }) {
  switch (id) {
    case "nodes":
      return <NodePalette />;
    case "files":
      return (
        <>
          <FileActions />
          <AssetTree />
        </>
      );
    case "history":
      return <HistoryPanel />;
    case "validation":
      return <ValidationPanel />;
    case "bookmarks":
      return <BookmarkPanel />;
  }
}

// ---------------------------------------------------------------------------
// Classic tab sidebar (original behavior)
// ---------------------------------------------------------------------------

type LeftTab = "files" | "nodes" | "history" | "validation";

function BookmarkSection() {
  const [collapsed, setCollapsed] = useState(true);
  const bookmarkCount = useUIStore((s) => s.bookmarks.size);

  return (
    <div className="border-t border-tn-border shrink-0">
      <button
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        aria-controls="bookmark-panel-content"
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium text-tn-text-muted hover:text-tn-text"
      >
        <span className="text-[9px]" aria-hidden="true">{collapsed ? "\u25B6" : "\u25BC"}</span>
        <span>Bookmarks</span>
        {bookmarkCount > 0 && (
          <span className="ml-auto text-[9px] text-tn-accent" aria-label={`${bookmarkCount} bookmarks`}>{bookmarkCount}</span>
        )}
      </button>
      {!collapsed && (
        <div id="bookmark-panel-content" className="h-[200px]">
          <BookmarkPanel />
        </div>
      )}
    </div>
  );
}

function TabSidebar() {
  const [leftTab, setLeftTab] = useState<LeftTab>("nodes");
  const diagnosticsCount = useDiagnosticsStore((s) => s.diagnostics.length);
  const projectLegacyHits = useProjectLegacyStore((s) => s.hits);
  const currentFile = useProjectStore((s) => s.currentFile);
  const issueCount = computeIssueBadgeCount(diagnosticsCount, projectLegacyHits, currentFile);

  const sidebarTabs = [
    { id: "nodes" as const, label: "Nodes" },
    { id: "files" as const, label: "Files" },
    { id: "history" as const, label: "History" },
    {
      id: "validation" as const,
      label: "Issues",
      badge: issueCount > 0 ? (
        <span className="rounded-full bg-amber-500/20 px-1.5 text-[9px] font-medium text-amber-400">
          {issueCount}
        </span>
      ) : undefined,
    },
  ];

  return (
    <>
      <SegmentTabBar
        tabs={sidebarTabs}
        active={leftTab}
        onChange={setLeftTab}
        ariaLabel="Editor sidebar"
      />

      {/* Tab content — both rendered always; inactive hidden via CSS to preserve state */}
      <div className="flex-1 overflow-y-auto">
        <div className={leftTab === "nodes" ? "flex flex-col h-full" : "hidden"} id="nodes-panel" role="tabpanel" aria-labelledby="tab-nodes">
          <div className="flex-1 overflow-y-auto">
            <NodePalette />
          </div>
          <BookmarkSection />
        </div>
        <div className={leftTab === "files" ? "" : "hidden"} id="files-panel" role="tabpanel" aria-labelledby="tab-files">
          <FileActions />
          <AssetTree />
        </div>
        <div className={leftTab === "history" ? "h-full" : "hidden"} id="history-panel" role="tabpanel" aria-labelledby="tab-history">
          <HistoryPanel />
        </div>
        <div className={leftTab === "validation" ? "h-full" : "hidden"} id="validation-panel" role="tabpanel" aria-labelledby="tab-validation">
          <ValidationPanel />
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Accordion sidebar
// ---------------------------------------------------------------------------

function AccordionSidebar() {
  const sectionOrder = useUIStore((s) => s.sidebarSectionOrder);
  const expanded = useUIStore((s) => s.sidebarExpanded);
  const toggleSection = useUIStore((s) => s.toggleSection);
  const reorderSections = useUIStore((s) => s.reorderSections);
  const bookmarkCount = useUIStore((s) => s.bookmarks.size);
  const diagnosticsCount = useDiagnosticsStore((s) => s.diagnostics.length);
  const projectLegacyHits = useProjectLegacyStore((s) => s.hits);
  const currentFile = useProjectStore((s) => s.currentFile);
  const issueCount = computeIssueBadgeCount(diagnosticsCount, projectLegacyHits, currentFile);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function getBadge(id: SidebarSectionId): React.ReactNode {
    if (id === "bookmarks" && bookmarkCount > 0) {
      return <span className="text-[9px] text-tn-accent">{bookmarkCount}</span>;
    }
    if (id === "validation" && issueCount > 0) {
      return <span className="text-[9px] text-amber-400">{issueCount}</span>;
    }
    return null;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {sectionOrder.map((id, index) => {
        const config = SECTION_CONFIG[id];
        const isExpanded = expanded[id];
        const isDropTarget = dragOverIndex === index && draggedIndex !== null && draggedIndex !== index;

        return (
          <div
            key={id}
            className={isDropTarget ? "border-t-2 border-tn-accent" : ""}
          >
            {/* Accordion header */}
            <button
              className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-tn-text-muted hover:text-tn-text hover:bg-tn-accent/10 border-b border-tn-border shrink-0 select-none"
              onClick={() => toggleSection(id)}
              draggable
              onDragStart={(e) => {
                setDraggedIndex(index);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverIndex(index);
              }}
              onDragLeave={() => {
                setDragOverIndex((prev) => (prev === index ? null : prev));
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedIndex !== null && draggedIndex !== index) {
                  reorderSections(draggedIndex, index);
                }
                setDraggedIndex(null);
                setDragOverIndex(null);
              }}
              onDragEnd={() => {
                setDraggedIndex(null);
                setDragOverIndex(null);
              }}
            >
              <span className="text-[9px] w-3 text-center cursor-grab active:cursor-grabbing opacity-40">{"\u2261"}</span>
              <span className="text-[10px] w-4 text-center">{config.icon}</span>
              <span>{config.title}</span>
              {getBadge(id)}
              <span className="ml-auto text-[9px] opacity-60">{isExpanded ? "\u25BC" : "\u25B6"}</span>
            </button>

            {/* Section content */}
            {isExpanded && (
              <SectionContent id={id} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main layout
// ---------------------------------------------------------------------------

export function PanelLayout() {
  const initial = loadPersistedWidths();
  const [leftWidth, setLeftWidth] = useState(initial.left);
  const [rightWidth, setRightWidth] = useState(initial.right);
  const [docsPanelMounted, setDocsPanelMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const leftPanelVisible = useUIStore((s) => s.leftPanelVisible);
  const rightPanelVisible = useUIStore((s) => s.rightPanelVisible);
  const rightPanelMode = useUIStore((s) => s.rightPanelMode);
  const setRightPanelVisible = useUIStore((s) => s.setRightPanelVisible);
  const setRightPanelMode = useUIStore((s) => s.setRightPanelMode);

  useEffect(() => {
    if (rightPanelMode === "docs") {
      setDocsPanelMounted(true);
    }
  }, [rightPanelMode]);
  const useAccordion = useUIStore((s) => s.useAccordionSidebar);
  const compactAssetInspector = useUIStore((s) => s.compactAssetInspector);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const rawJsonContent = useEditorStore((s) => s.rawJsonContent);
  const currentFile = useProjectStore((s) => s.currentFile);
  const assetInspectorActive = !selectedNodeId && Boolean(rawJsonContent) && isAssetInspectorFile(currentFile);
  const devActive = useDeveloperMode();
  const showDevToolsDock = useSettingsStore((s) => s.showDevToolsDock);
  const displayRightWidth = compactAssetInspector && assetInspectorActive
    ? Math.min(rightWidth, COMPACT_RIGHT)
    : rightWidth;

  // Drive diagnostics computation (debounced, pushes to diagnosticsStore)
  useGraphDiagnostics();

  // Restore previously open file after session reload (Phase 2)
  const { openFile } = useTauriIO();
  useSessionRestoreFile(openFile);

  // Persist widths to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ left: leftWidth, right: rightWidth }));
    } catch {
      // Ignore write failures (e.g., storage full)
    }
  }, [leftWidth, rightWidth]);

  // Ctrl+` toggles between Properties and Docs panels
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === "`") {
        e.preventDefault();
        setRightPanelMode(rightPanelMode === "docs" ? "properties" : "docs");
        if (!rightPanelVisible) setRightPanelVisible(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rightPanelMode, rightPanelVisible, setRightPanelMode, setRightPanelVisible]);

  const handleDrag = useCallback(
    (side: "left" | "right") => (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = side === "left" ? leftWidth : displayRightWidth;

      function onMouseMove(ev: MouseEvent) {
        const delta = ev.clientX - startX;
        const newWidth = side === "left" ? startWidth + delta : startWidth - delta;
        const clamped = Math.max(MIN_PANEL_WIDTH, newWidth);
        if (side === "left") setLeftWidth(clamped);
        else setRightWidth(clamped);
      }

      function onMouseUp() {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      }

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [displayRightWidth, leftWidth],
  );

  return (
    <>
      <PreviewEvaluationHost />
      <div ref={containerRef} className="flex flex-1 overflow-hidden">
      {/* Left sidebar */}
      {leftPanelVisible && (
        <>
          <div
            className="flex flex-col bg-tn-surface border-r border-tn-border shrink-0 transition-all duration-150"
            style={{ width: leftWidth }}
          >
            {useAccordion ? <AccordionSidebar /> : <TabSidebar />}
          </div>

          {/* Left drag handle */}
          <div
            className="w-1 cursor-col-resize hover:bg-tn-accent/30 active:bg-tn-accent/50 shrink-0"
            onMouseDown={handleDrag("left")}
          />
        </>
      )}

      {/* Center: editor canvas */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <Toolbar />
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <CenterPanel />
          {devActive && showDevToolsDock && <DevToolsPanel />}
        </div>
      </div>

      {!rightPanelVisible && (
        <div className="flex w-8 shrink-0 items-center justify-center border-l border-tn-border bg-tn-surface/90">
          <ChromeIconButton
            size="sm"
            label="Show right panel"
            onClick={() => setRightPanelVisible(true)}
            icon={<ChevronLeft className="h-4 w-4" strokeWidth={2} />}
          />
        </div>
      )}

      {/* Right panel */}
      {rightPanelVisible && (
        <>
          {/* Right drag handle */}
          <div
            className="w-1 cursor-col-resize hover:bg-tn-accent/30 active:bg-tn-accent/50 shrink-0"
            onMouseDown={handleDrag("right")}
          />

          <div className="flex w-8 shrink-0 items-center justify-center border-l border-tn-border bg-tn-surface/90">
            <ChromeIconButton
              size="sm"
              label="Hide right panel"
              onClick={() => setRightPanelVisible(false)}
              icon={<ChevronRight className="h-4 w-4" strokeWidth={2} />}
            />
          </div>

          {/* Right panel: properties / docs — both stay mounted so scroll+state is preserved */}
          <div
            className="flex flex-col bg-tn-surface border-l border-tn-border overflow-hidden shrink-0 transition-all duration-150 min-h-0"
            style={{ width: displayRightWidth }}
          >
            <SegmentTabBar
              tabs={[
                { id: "properties" as const, label: "Properties" },
                { id: "docs" as const, label: "Docs" },
              ]}
              active={rightPanelMode}
              onChange={(mode) => setRightPanelMode(mode)}
              ariaLabel="Right panel"
            />
            {/* Lazy-mount docs on first visit; keep mounted afterward for scroll + nav history */}
            <div className={`flex-1 min-h-0 ${rightPanelMode === "docs" ? "flex flex-col" : "hidden"}`}>
              {docsPanelMounted && (
                <Suspense fallback={<div className="flex flex-1 items-center justify-center text-xs text-tn-text-muted">Loading docs…</div>}>
                  <DocsPanel />
                </Suspense>
              )}
            </div>
            <div className={`flex-1 min-h-0 ${rightPanelMode === "properties" ? "flex flex-col" : "hidden"}`}>
              <PropertyPanel />
            </div>
          </div>
        </>
      )}
    </div>
    </>
  );
}
