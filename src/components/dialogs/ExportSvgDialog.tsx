import { useState } from "react";
import type { SvgExportOptions } from "@/utils/exportSvg";

interface ExportSvgDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: (options: SvgExportOptions) => void;
}

export function ExportSvgDialog({ open, onClose, onExport }: ExportSvgDialogProps) {
  const [scope, setScope] = useState<SvgExportOptions["scope"]>("full");
  const [showGrid, setShowGrid] = useState(false);
  const [mode, setMode] = useState<SvgExportOptions["mode"]>("presentation");
  const [padding, setPadding] = useState(40);

  if (!open) return null;

  function handleExport() {
    onExport({ scope, showGrid, mode, padding: scope === "full" ? padding : 0 });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-tn-panel border border-tn-border rounded-lg shadow-xl w-[400px] p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold">Export SVG</h2>

        {/* Scope */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-tn-text-muted">Scope</label>
          <div className="flex gap-2">
            <ToggleButton active={scope === "full"} onClick={() => setScope("full")}>
              Entire Graph
            </ToggleButton>
            <ToggleButton active={scope === "viewport"} onClick={() => setScope("viewport")}>
              Current Viewport
            </ToggleButton>
          </div>
        </div>

        {/* Grid */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-tn-text-muted">Background Grid</label>
          <div className="flex gap-2">
            <ToggleButton active={!showGrid} onClick={() => setShowGrid(false)}>
              No Grid
            </ToggleButton>
            <ToggleButton active={showGrid} onClick={() => setShowGrid(true)}>
              Include Grid
            </ToggleButton>
          </div>
        </div>

        {/* Mode */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-tn-text-muted">Mode</label>
          <div className="flex gap-2">
            <ToggleButton active={mode === "presentation"} onClick={() => setMode("presentation")}>
              Presentation
            </ToggleButton>
            <ToggleButton active={mode === "debug"} onClick={() => setMode("debug")}>
              Debug
            </ToggleButton>
          </div>
          <p className="text-[10px] text-tn-text-muted mt-0.5">
            {mode === "debug" ? "Shows node IDs and raw type names" : "Clean output for documentation"}
          </p>
        </div>

        {/* Padding (only for full scope) */}
        {scope === "full" && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-tn-text-muted">Padding (px)</label>
            <input
              type="number"
              min={0}
              max={200}
              value={padding}
              onChange={(e) => setPadding(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-24 px-3 py-1.5 rounded border border-tn-border bg-tn-bg text-sm"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-tn-border">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded border border-tn-border hover:bg-tn-surface"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-1.5 text-sm rounded border border-tn-accent text-tn-accent hover:bg-tn-accent/10"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-1.5 text-sm rounded border ${
        active
          ? "border-tn-accent bg-tn-accent/10 text-tn-accent"
          : "border-tn-border bg-tn-bg hover:bg-tn-surface text-tn-text-muted"
      }`}
    >
      {children}
    </button>
  );
}
