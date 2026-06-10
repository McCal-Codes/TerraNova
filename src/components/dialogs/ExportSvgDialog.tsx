import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import { useEditorStore } from "@/stores/editorStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useProjectStore } from "@/stores/projectStore";
import {
  copySvgImageToClipboard,
  copySvgTextToClipboard,
  DEFAULT_SVG_EXPORT_SETTINGS,
  formatSvgExportStatsLine,
  generateSvg,
  isLargeSvgExport,
  parseSvgExportStats,
  resolveSvgExportBaseName,
  resolveSvgExportFileName,
  type SvgExportBackground,
  type SvgExportOptions,
} from "@/utils/exportSvg";

interface ExportSvgDialogProps {
  open: boolean;
  onClose: () => void;
  onExportSvg: (options: SvgExportOptions) => Promise<boolean>;
  onExportPng: (options: SvgExportOptions) => Promise<boolean>;
  reactFlow: ReactFlowInstance;
}

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

const PREVIEW_BACKGROUNDS: Record<SvgExportBackground, string> = {
  dark: "#1c1a17",
  light: "#f5f4f0",
  transparent:
    "repeating-conic-gradient(#80808030 0% 25%, transparent 0% 50%) 50% / 16px 16px, #e8e6e0",
};

const PREVIEW_ZOOM_MIN = 0.25;
const PREVIEW_ZOOM_MAX = 4;
const PREVIEW_ZOOM_STEP = 0.25;

function clampPreviewZoom(value: number): number {
  const stepped = Math.round(value / PREVIEW_ZOOM_STEP) * PREVIEW_ZOOM_STEP;
  return Math.min(PREVIEW_ZOOM_MAX, Math.max(PREVIEW_ZOOM_MIN, stepped));
}

function formatPreviewZoom(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function buildExportOptions(settings: SvgExportOptions): SvgExportOptions {
  const usePadding = settings.scope === "full" || settings.scope === "selection";
  return {
    ...settings,
    padding: usePadding ? settings.padding : 0,
    showGrid: settings.background === "transparent" ? false : settings.showGrid,
  };
}

export function ExportSvgDialog({
  open,
  onClose,
  onExportSvg,
  onExportPng,
  reactFlow,
}: ExportSvgDialogProps) {
  const svgSettings = useSettingsStore((s) => s.svgExportSettings);
  const setSvgExportSettings = useSettingsStore((s) => s.setSvgExportSettings);
  const [previewSettings, setPreviewSettings] = useState(svgSettings);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [exportingFormat, setExportingFormat] = useState<"svg" | "png" | null>(null);
  const [copyingFormat, setCopyingFormat] = useState<"text" | "image" | null>(null);
  const currentFile = useProjectStore((s) => s.currentFile);
  const wasOpenRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const previewViewportRef = useRef<HTMLDivElement>(null);
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [previewNaturalSize, setPreviewNaturalSize] = useState<{ w: number; h: number } | null>(null);

  const selectedCount = useEditorStore(
    useCallback(
      (s) => s.nodes.reduce((count, n) => count + (n.selected ? 1 : 0), 0),
      [],
    ),
  );
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const hasSelection = selectedCount > 0 || selectedNodeId != null;

  const exportOptions = useMemo(() => buildExportOptions(svgSettings), [svgSettings]);

  useEffect(() => {
    if (open) setPreviewSettings(svgSettings);
  }, [open, svgSettings]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setPreviewSettings(svgSettings), 150);
    return () => window.clearTimeout(timer);
  }, [open, svgSettings]);

  useEffect(() => {
    if (open && !wasOpenRef.current && hasSelection) {
      setSvgExportSettings({ scope: "selection" });
    }
    wasOpenRef.current = open;
  }, [open, hasSelection, setSvgExportSettings]);

  const fitPreviewToViewport = useCallback(() => {
    const viewport = previewViewportRef.current;
    if (!viewport || !previewNaturalSize) {
      setPreviewZoom(1);
      return;
    }
    const pad = 20;
    const scale = Math.min(
      (viewport.clientWidth - pad) / previewNaturalSize.w,
      (viewport.clientHeight - pad) / previewNaturalSize.h,
      1,
    );
    setPreviewZoom(clampPreviewZoom(scale));
  }, [previewNaturalSize]);

  useEffect(() => {
    if (open) {
      setPreviewZoom(1);
      setPreviewNaturalSize(null);
    }
  }, [open]);

  const previewOptions = useMemo(() => buildExportOptions(previewSettings), [previewSettings]);

  const previewSvg = useMemo(() => {
    if (!open) return null;
    try {
      return generateSvg(reactFlow, previewOptions);
    } catch {
      return null;
    }
  }, [open, reactFlow, previewOptions]);

  const previewDataUrl = useMemo(() => {
    if (!previewSvg) return null;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(previewSvg)}`;
  }, [previewSvg]);

  useEffect(() => {
    if (!open || !previewNaturalSize) return;
    const timer = window.setTimeout(fitPreviewToViewport, 0);
    return () => window.clearTimeout(timer);
  }, [open, previewNaturalSize, fitPreviewToViewport, previewDataUrl]);

  const exportSvg = useMemo(() => {
    if (!open) return null;
    try {
      return generateSvg(reactFlow, exportOptions);
    } catch {
      return null;
    }
  }, [open, reactFlow, exportOptions]);

  const exportStats = useMemo(
    () => (exportSvg ? parseSvgExportStats(exportSvg) : null),
    [exportSvg],
  );

  const previewUpdating =
    JSON.stringify(previewOptions) !== JSON.stringify(exportOptions);

  const exporting = exportingFormat != null;
  const copying = copyingFormat != null;
  const busy = exporting || copying;
  const exportDisabled = svgSettings.scope === "selection" && !hasSelection;
  const actionsDisabled = exportDisabled || busy || !exportSvg;

  const exportFileName = useMemo(() => {
    const base = resolveSvgExportBaseName(currentFile);
    return resolveSvgExportFileName(base, svgSettings.scope, "svg");
  }, [currentFile, svgSettings.scope]);

  const settingsDirty = useMemo(
    () => JSON.stringify(svgSettings) !== JSON.stringify(DEFAULT_SVG_EXPORT_SETTINGS),
    [svgSettings],
  );

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    primaryActionRef.current?.focus();
    return () => {
      previouslyFocusedRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setExportingFormat(null);
      setCopyingFormat(null);
    }
  }, [open]);

  const runExport = useCallback(
    async (format: "svg" | "png") => {
      if (busy || exportDisabled || !exportSvg) return;
      setExportingFormat(format);
      try {
        const ok =
          format === "svg"
            ? await onExportSvg(exportOptions)
            : await onExportPng(exportOptions);
        if (ok) onClose();
      } finally {
        setExportingFormat(null);
      }
    },
    [busy, exportDisabled, exportSvg, exportOptions, onExportSvg, onExportPng, onClose],
  );

  const runCopy = useCallback(
    async (format: "text" | "image") => {
      if (busy || actionsDisabled || !exportSvg) return;
      setCopyingFormat(format);
      try {
        if (format === "text") await copySvgTextToClipboard(exportSvg);
        else await copySvgImageToClipboard(exportSvg);
      } finally {
        setCopyingFormat(null);
      }
    },
    [busy, actionsDisabled, exportSvg],
  );

  const handleDialogKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (busy) return;

      if (e.key === "Tab" && panelRef.current) {
        const focusable = getFocusableElements(panelRef.current);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Enter" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        if (!exportDisabled && exportSvg) {
          void runExport(e.shiftKey ? "png" : "svg");
        }
      }
    },
    [busy, onClose, exportDisabled, exportSvg, runExport],
  );

  if (!open) return null;

  const largeExport = exportStats ? isLargeSvgExport(exportStats) : false;
  const showPadding = svgSettings.scope === "full" || svgSettings.scope === "selection";
  const gridAvailable = svgSettings.background !== "transparent";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={busy ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-graph-dialog-title"
      aria-describedby="export-graph-dialog-desc"
    >
      <div
        ref={panelRef}
        className="bg-tn-panel border border-tn-border rounded-lg shadow-xl w-full max-w-[680px] max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
      >
        <header className="px-5 pt-5 pb-4 border-b border-tn-border/80 shrink-0 space-y-1.5">
          <h2 id="export-graph-dialog-title" className="text-sm font-semibold leading-snug">
            Export Graph
          </h2>
          {exportStats && (
            <p
              id="export-graph-dialog-desc"
              className="text-[11px] text-tn-text-muted leading-relaxed"
            >
              {formatSvgExportStatsLine(exportStats)}
            </p>
          )}
          <p className="text-[10px] text-tn-text-muted/80 leading-relaxed">
            Saves as <span className="font-mono text-tn-text-muted">{exportFileName}</span>
          </p>
          {largeExport && (
            <p className="text-[11px] text-amber-400/90 leading-relaxed">
              Large export — PNG rasterization may take a moment.
            </p>
          )}
        </header>

        <div className="flex flex-col sm:flex-row min-h-0 flex-1 overflow-hidden">
          <aside className="sm:w-[44%] sm:max-w-[300px] shrink-0 min-w-0 overflow-hidden px-5 py-4 sm:border-r border-tn-border/80 border-b sm:border-b-0 bg-tn-bg/30 flex flex-col gap-3">
            <div
              ref={previewViewportRef}
              className="relative h-40 sm:min-h-[220px] sm:flex-1 rounded-md border border-tn-border overflow-auto"
              style={{ background: PREVIEW_BACKGROUNDS[svgSettings.background] }}
              onWheel={(e) => {
                if (!previewDataUrl) return;
                e.preventDefault();
                setPreviewZoom((zoom) =>
                  clampPreviewZoom(zoom + (e.deltaY < 0 ? PREVIEW_ZOOM_STEP : -PREVIEW_ZOOM_STEP)),
                );
              }}
              onDoubleClick={fitPreviewToViewport}
              title="Scroll to zoom · double-click to fit in view"
            >
              {previewDataUrl ? (
                <div
                  className="flex items-center justify-center p-2"
                  style={{
                    width: previewZoom >= 1 ? `${previewZoom * 100}%` : "100%",
                    height: previewZoom >= 1 ? `${previewZoom * 100}%` : "100%",
                    minWidth: "100%",
                    minHeight: "100%",
                  }}
                >
                  <img
                    src={previewDataUrl}
                    alt="Graph export preview"
                    draggable={false}
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                        setPreviewNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
                      }
                    }}
                    className="object-contain select-none"
                    style={{
                      width: previewZoom >= 1 ? "100%" : `${previewZoom * 100}%`,
                      height: previewZoom >= 1 ? "100%" : `${previewZoom * 100}%`,
                      maxWidth: previewZoom >= 1 ? "none" : "100%",
                      maxHeight: previewZoom >= 1 ? "none" : "100%",
                    }}
                  />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <span className="text-xs text-tn-text-muted">Preview unavailable</span>
                </div>
              )}
              {previewUpdating && (
                <div className="absolute inset-x-0 bottom-0 px-3 py-1.5 bg-tn-panel/90 border-t border-tn-border/60 text-center">
                  <span className="text-[10px] text-tn-text-muted">Updating preview…</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 min-w-0 w-full shrink-0">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] text-tn-text-muted shrink-0">Zoom</span>
                  <ZoomButton
                    onClick={fitPreviewToViewport}
                    title="Fit graph in preview pane"
                  >
                    Fit
                  </ZoomButton>
                  <ZoomButton
                    onClick={() => setPreviewZoom(1)}
                    title="100% zoom"
                    active={previewZoom === 1}
                  >
                    100%
                  </ZoomButton>
                </div>
                <span className="text-[10px] text-tn-text-muted tabular-nums shrink-0">
                  {formatPreviewZoom(previewZoom)}
                </span>
              </div>
              <div className="flex items-center gap-2 min-w-0 w-full">
                <ZoomButton
                  onClick={() => setPreviewZoom((z) => clampPreviewZoom(z - PREVIEW_ZOOM_STEP))}
                  title="Zoom out"
                  disabled={previewZoom <= PREVIEW_ZOOM_MIN}
                >
                  −
                </ZoomButton>
                <input
                  type="range"
                  min={PREVIEW_ZOOM_MIN}
                  max={PREVIEW_ZOOM_MAX}
                  step={PREVIEW_ZOOM_STEP}
                  value={previewZoom}
                  onChange={(e) => setPreviewZoom(clampPreviewZoom(Number(e.target.value)))}
                  className="flex-1 min-w-0 h-1 accent-tn-accent cursor-pointer"
                  aria-label="Preview zoom"
                />
                <ZoomButton
                  onClick={() => setPreviewZoom((z) => clampPreviewZoom(z + PREVIEW_ZOOM_STEP))}
                  title="Zoom in"
                  disabled={previewZoom >= PREVIEW_ZOOM_MAX}
                >
                  +
                </ZoomButton>
              </div>
            </div>
            <Hint className="mt-0.5">
              Scroll over preview to zoom; double-click or Fit to frame the graph. Export resolution is unchanged.
            </Hint>
          </aside>

          <div className="flex-1 min-w-0 overflow-y-auto px-5 py-4 space-y-5">
            <OptionGroup title="Scope">
              <SegmentedControl>
                <Segment
                  active={svgSettings.scope === "full"}
                  onClick={() => setSvgExportSettings({ scope: "full" })}
                >
                  Full
                </Segment>
                <Segment
                  active={svgSettings.scope === "viewport"}
                  onClick={() => setSvgExportSettings({ scope: "viewport" })}
                >
                  Viewport
                </Segment>
                <Segment
                  active={svgSettings.scope === "selection"}
                  onClick={() => setSvgExportSettings({ scope: "selection" })}
                  disabled={!hasSelection}
                  title={!hasSelection ? "Select nodes on the canvas first" : undefined}
                >
                  {hasSelection ? `Selected (${selectedCount})` : "Selected"}
                </Segment>
              </SegmentedControl>
              {svgSettings.scope === "viewport" && (
                <Hint>Exports the current canvas view with no extra padding.</Hint>
              )}
              {svgSettings.scope === "selection" && !hasSelection && (
                <Hint tone="warn">Select nodes on the canvas first.</Hint>
              )}
              {svgSettings.scope === "selection" && hasSelection && (
                <Hint>Includes external wires (dashed) and overlapping frames.</Hint>
              )}
            </OptionGroup>

            <OptionGroup title="Layout">
              <OptionRow label="Flow">
                <SegmentedControl>
                  <Segment
                    active={svgSettings.flowDirection === "canvas"}
                    onClick={() => setSvgExportSettings({ flowDirection: "canvas" })}
                  >
                    Canvas
                  </Segment>
                  <Segment
                    active={svgSettings.flowDirection === "LR"}
                    onClick={() => setSvgExportSettings({ flowDirection: "LR" })}
                  >
                    L → R
                  </Segment>
                  <Segment
                    active={svgSettings.flowDirection === "RL"}
                    onClick={() => setSvgExportSettings({ flowDirection: "RL" })}
                  >
                    R → L
                  </Segment>
                </SegmentedControl>
              </OptionRow>
              <OptionRow label="Resolution">
                <SegmentedControl>
                  <Segment
                    active={svgSettings.resolution === 1920}
                    onClick={() => setSvgExportSettings({ resolution: 1920 })}
                    title="1920 px longest side — good for sharing"
                  >
                    1920
                  </Segment>
                  <Segment
                    active={svgSettings.resolution === 3840}
                    onClick={() => setSvgExportSettings({ resolution: 3840 })}
                    title="3840 px longest side — sharper for print and docs"
                  >
                    3840
                  </Segment>
                </SegmentedControl>
              </OptionRow>
              <OptionRow label="Mode">
                <SegmentedControl>
                  <Segment
                    active={svgSettings.mode === "presentation"}
                    onClick={() => setSvgExportSettings({ mode: "presentation" })}
                  >
                    Clean
                  </Segment>
                  <Segment
                    active={svgSettings.mode === "debug"}
                    onClick={() => setSvgExportSettings({ mode: "debug" })}
                  >
                    Debug
                  </Segment>
                </SegmentedControl>
              </OptionRow>
              {showPadding && (
                <OptionRow label="Padding">
                  <input
                    type="number"
                    min={0}
                    max={200}
                    value={svgSettings.padding}
                    onChange={(e) =>
                      setSvgExportSettings({
                        padding: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    className="w-16 px-2.5 py-1.5 rounded border border-tn-border bg-tn-bg text-xs text-right"
                  />
                </OptionRow>
              )}
            </OptionGroup>

            <OptionGroup title="Appearance">
              <OptionRow label="Background">
                <SegmentedControl>
                  <Segment
                    active={svgSettings.background === "dark"}
                    onClick={() =>
                      setSvgExportSettings({
                        background: "dark",
                        showGrid: svgSettings.showGrid,
                      })
                    }
                  >
                    Dark
                  </Segment>
                  <Segment
                    active={svgSettings.background === "light"}
                    onClick={() =>
                      setSvgExportSettings({
                        background: "light",
                        showGrid: svgSettings.showGrid,
                      })
                    }
                  >
                    Light
                  </Segment>
                  <Segment
                    active={svgSettings.background === "transparent"}
                    onClick={() =>
                      setSvgExportSettings({ background: "transparent", showGrid: false })
                    }
                  >
                    Clear
                  </Segment>
                </SegmentedControl>
              </OptionRow>
              <div className="flex flex-wrap gap-x-5 gap-y-2.5 pt-2">
                {gridAvailable && (
                  <Checkbox
                    checked={svgSettings.showGrid}
                    onChange={(checked) => setSvgExportSettings({ showGrid: checked })}
                    label="Show grid"
                  />
                )}
                <Checkbox
                  checked={svgSettings.includeAnnotations}
                  onChange={(checked) => setSvgExportSettings({ includeAnnotations: checked })}
                  label="Comments & frames"
                />
              </div>
            </OptionGroup>

            {settingsDirty && (
              <div className="pt-1">
                <GhostButton
                  disabled={busy}
                  onClick={() => setSvgExportSettings(DEFAULT_SVG_EXPORT_SETTINGS)}
                  title="Restore default export settings"
                >
                  Reset defaults
                </GhostButton>
              </div>
            )}
          </div>
        </div>

        <footer className="px-5 py-4 border-t border-tn-border/80 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 shrink-0 bg-tn-panel">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-3 text-xs">
              <GhostButton
                disabled={actionsDisabled}
                onClick={() => void runCopy("text")}
                title="Paste SVG markup"
              >
                {copyingFormat === "text" ? "Copying…" : "Copy text"}
              </GhostButton>
              <span className="h-3.5 w-px bg-tn-border/80 shrink-0" aria-hidden />
              <GhostButton
                disabled={actionsDisabled}
                onClick={() => void runCopy("image")}
                title="Paste PNG image"
              >
                {copyingFormat === "image" ? "Copying…" : "Copy image"}
              </GhostButton>
            </div>
            <Hint>Enter saves SVG · Shift+Enter saves PNG · Esc closes</Hint>
          </div>
          <div className="flex items-center gap-2.5">
            <ActionButton disabled={busy} onClick={onClose}>
              Cancel
            </ActionButton>
            <ActionButton disabled={actionsDisabled} onClick={() => void runExport("png")}>
              {exportingFormat === "png" ? "Exporting…" : "PNG"}
            </ActionButton>
            <ActionButton
              ref={primaryActionRef}
              variant="primary"
              disabled={actionsDisabled}
              onClick={() => void runExport("svg")}
            >
              {exportingFormat === "svg" ? "Exporting…" : "SVG"}
            </ActionButton>
          </div>
        </footer>
      </div>
    </div>
  );
}

function OptionGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="text-[10px] font-medium uppercase tracking-wider text-tn-text-muted/80">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function OptionRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className="text-xs text-tn-text-muted shrink-0 min-w-[4.5rem]">{label}</span>
      <div className="min-w-0 flex justify-end">{children}</div>
    </div>
  );
}

function Hint({
  children,
  tone = "muted",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "muted" | "warn";
  className?: string;
}) {
  return (
    <p
      className={`text-[10px] leading-relaxed ${
        tone === "warn" ? "text-amber-400/90" : "text-tn-text-muted"
      } ${className}`}
    >
      {children}
    </p>
  );
}

function SegmentedControl({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex rounded-md border border-tn-border overflow-hidden bg-tn-bg">
      {children}
    </div>
  );
}

function Segment({
  active,
  onClick,
  children,
  disabled = false,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-3 py-1.5 text-xs whitespace-nowrap border-r border-tn-border last:border-r-0 transition-colors ${
        active
          ? "bg-tn-accent/15 text-tn-accent font-medium"
          : "text-tn-text-muted hover:bg-tn-surface hover:text-tn-text"
      } disabled:opacity-40 disabled:pointer-events-none`}
    >
      {children}
    </button>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-tn-text-muted cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-3.5 h-3.5 accent-tn-accent rounded"
      />
      {label}
    </label>
  );
}

function GhostButton({
  children,
  onClick,
  disabled = false,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="px-2 py-1 -mx-2 rounded text-tn-text-muted hover:text-tn-accent hover:bg-tn-surface/60 disabled:opacity-40 disabled:pointer-events-none"
    >
      {children}
    </button>
  );
}

function ZoomButton({
  children,
  onClick,
  disabled = false,
  title,
  active = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-2 py-1 text-[10px] rounded border transition-colors disabled:opacity-40 disabled:pointer-events-none ${
        active
          ? "border-tn-accent/50 bg-tn-accent/10 text-tn-accent"
          : "border-tn-border text-tn-text-muted hover:bg-tn-surface"
      }`}
    >
      {children}
    </button>
  );
}

const ActionButton = forwardRef(function ActionButton(
  {
    children,
    onClick,
    disabled = false,
    variant = "default",
  }: {
    children: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    variant?: "default" | "primary";
  },
  ref: React.ForwardedRef<HTMLButtonElement>,
) {
  const base =
    "px-3 py-1.5 text-xs rounded border whitespace-nowrap disabled:opacity-40 disabled:pointer-events-none";
  const styles =
    variant === "primary"
      ? "border-tn-accent text-tn-accent hover:bg-tn-accent/10"
      : "border-tn-border hover:bg-tn-surface text-tn-text-muted";
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles}`}
    >
      {children}
    </button>
  );
});
