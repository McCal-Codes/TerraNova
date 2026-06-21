import { useEffect, useRef, useState } from "react";
import { Info, Loader2 } from "lucide-react";
import type { MaterialPreviewView, MaterialScaffoldPreset } from "@/utils/materialColumnPreview";
import type { useMaterialColumnPreview } from "@/hooks/useMaterialEditingContext";
import { useEditorStore } from "@/stores/editorStore";
import { materialGraphUsesPassthroughNodes } from "@/utils/materialEvaluator";
import { getMaterialPreviewContextHint } from "@/utils/previewSliceHints";
import { appNestedCardClass } from "@/components/ui/surfaceStyles";
import { PreviewCheckbox, PreviewField, previewSelectClass } from "./controls/PreviewControlPrimitives";

const PRESETS: { id: MaterialScaffoldPreset; label: string }[] = [
  { id: "surface", label: "Surface column" },
  { id: "deepColumn", label: "Deep column" },
  { id: "caveCeiling", label: "Cave ceiling" },
  { id: "caveFloor", label: "Cave floor" },
];

export type MaterialPreviewSettings = {
  preset: MaterialScaffoldPreset;
  setPreset: (v: MaterialScaffoldPreset) => void;
  view: MaterialPreviewView;
  setView: (v: MaterialPreviewView) => void;
  surfaceY: number;
  setSurfaceY: (v: number) => void;
  useTerrainShape: boolean;
  setUseTerrainShape: (v: boolean) => void;
};

export function useMaterialPreviewSettings(): MaterialPreviewSettings {
  const [preset, setPreset] = useState<MaterialScaffoldPreset>("surface");
  const [view, setView] = useState<MaterialPreviewView>("column");
  const [surfaceY, setSurfaceY] = useState(64);
  const [useTerrainShape, setUseTerrainShape] = useState(false);
  return { preset, setPreset, view, setView, surfaceY, setSurfaceY, useTerrainShape, setUseTerrainShape };
}

export function MaterialPreviewControls({
  settings,
  loading = false,
}: {
  settings: MaterialPreviewSettings;
  loading?: boolean;
}) {
  const { preset, setPreset, view, setView, surfaceY, setSurfaceY, useTerrainShape, setUseTerrainShape } = settings;
  const nodes = useEditorStore((s) => s.nodes);
  const usesPassthrough = materialGraphUsesPassthroughNodes(nodes);

  return (
    <div className="flex flex-col gap-3 p-2">
      <div className="flex gap-1">
        {(["column", "surface"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`flex-1 rounded border px-2 py-1 text-[10px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent ${
              view === v
                ? "border-tn-accent bg-tn-accent/10 text-tn-accent"
                : "border-tn-border bg-tn-bg text-tn-text-muted hover:bg-tn-surface"
            }`}
          >
            {v === "column" ? "Column" : "Surface"}
          </button>
        ))}
      </div>
      <PreviewField label="Scaffold" htmlFor="material-scaffold">
        <select
          id="material-scaffold"
          className={previewSelectClass}
          value={preset}
          onChange={(e) => setPreset(e.target.value as MaterialScaffoldPreset)}
        >
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </PreviewField>
      <PreviewField label="Surface Y" htmlFor="material-surface-y">
        <input
          id="material-surface-y"
          type="number"
          min={0}
          max={256}
          value={surfaceY}
          onChange={(e) => setSurfaceY(Number(e.target.value) || 0)}
          className={previewSelectClass}
        />
      </PreviewField>
      <PreviewCheckbox
        checked={useTerrainShape}
        onChange={setUseTerrainShape}
        label="Use terrain shape"
      />
      {loading ? (
        <p className="text-[10px] text-tn-text-muted flex items-center gap-1" role="status">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Evaluating…
        </p>
      ) : null}
      <p className="text-[10px] leading-relaxed text-tn-text-muted">
        {getMaterialPreviewContextHint(usesPassthrough)}
      </p>
    </div>
  );
}

function MaterialColumnView({
  rows,
  yMin,
  yMax,
}: {
  rows: { y: number; material: string | null; color: string; isSolid: boolean }[];
  yMin: number;
  yMax: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || rows.length === 0) return;
    const parent = canvas.parentElement;
    const w = parent?.clientWidth ?? 280;
    const h = Math.min(420, Math.max(200, rows.length * 6));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#1c1a17";
    ctx.fillRect(0, 0, w, h);
    const rowH = h / rows.length;
    const barLeft = 48;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const y = i * rowH;
      if (!row.isSolid) {
        ctx.fillStyle = "#242119";
        ctx.fillRect(barLeft, y, w - barLeft - 8, Math.max(1, rowH - 1));
        continue;
      }
      ctx.fillStyle = row.color.startsWith("#") && row.color.length >= 7 ? row.color : "#666666";
      ctx.fillRect(barLeft, y, w - barLeft - 8, Math.max(1, rowH - 1));
    }
    ctx.fillStyle = "#9a9082";
    ctx.font = "10px monospace";
    ctx.fillText(String(Math.round(yMax)), 4, 12);
    ctx.fillText(String(Math.round(yMin)), 4, h - 4);
  }, [rows, yMin, yMax]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded border border-tn-border bg-tn-bg"
      role="img"
      aria-label="Material column preview"
    />
  );
}

function MaterialSurfaceCanvas({
  cells,
  resolution,
}: {
  cells: { x: number; z: number; color: string; material: string | null }[];
  resolution: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const size = 256;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#1c1a17";
    ctx.fillRect(0, 0, size, size);
    const cell = size / resolution;
    for (const c of cells) {
      if (!c.material) continue;
      ctx.fillStyle = c.color.startsWith("#") ? c.color : "#666";
      ctx.fillRect(c.x * cell, c.z * cell, cell, cell);
    }
  }, [cells, resolution]);

  return (
    <canvas
      ref={canvasRef}
      className="mx-auto rounded border border-tn-border bg-tn-bg"
      role="img"
      aria-label="Material surface map preview"
    />
  );
}

export function MaterialPreviewPanel({
  settings,
  preview,
}: {
  settings: MaterialPreviewSettings;
  preview: ReturnType<typeof useMaterialColumnPreview>;
}) {
  const { view } = settings;
  const { column, surface, loading } = preview;
  const nodes = useEditorStore((s) => s.nodes);
  const usesPassthrough = materialGraphUsesPassthroughNodes(nodes);

  return (
    <div className="absolute inset-0 flex flex-col min-h-0 bg-tn-bg p-3 gap-3 overflow-auto">
      {usesPassthrough ? (
        <div className={`shrink-0 ${appNestedCardClass} px-3 py-2`}>
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" aria-hidden />
            <p className="text-[11px] text-tn-text-muted leading-relaxed">
              {getMaterialPreviewContextHint(true)}
            </p>
          </div>
        </div>
      ) : null}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center">
        {loading ? (
          <p className="text-sm text-tn-text-muted flex items-center gap-2" role="status">
            <Loader2 className="h-4 w-4 animate-spin text-tn-accent" aria-hidden />
            Evaluating materials…
          </p>
        ) : !column ? (
          <p className="text-sm text-tn-text-muted text-center px-4">
            Add a MaterialProvider graph with SpaceAndDepth layers to preview materials.
          </p>
        ) : view === "column" ? (
          <MaterialColumnView rows={column.rows} yMin={column.yMin} yMax={column.yMax} />
        ) : surface ? (
          <MaterialSurfaceCanvas cells={surface.cells} resolution={surface.resolution} />
        ) : null}
      </div>
      {column && column.palette.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-t border-tn-border pt-2">
          {column.palette.map((m) => (
            <span
              key={m.name}
              className="inline-flex items-center gap-1 rounded border border-tn-border bg-tn-panel px-1.5 py-0.5 text-[10px] text-tn-text-muted"
            >
              <span
                className="h-2.5 w-2.5 rounded-sm border border-tn-border/60"
                style={{ backgroundColor: m.color }}
                aria-hidden
              />
              {m.name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
