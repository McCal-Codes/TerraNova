import { useCallback, useEffect, useRef, useState } from "react";
import type { Node, Edge } from "@xyflow/react";
import { usePropPlacementStore } from "@/stores/propPlacementStore";
import { usePropPlacementEvaluation } from "@/hooks/usePropPlacementEvaluation";
import type { WorldRange } from "@/utils/positionEvaluator";
import { drawPropPlacementCanvas } from "./propPlacementCanvasDraw";

const COMPACT_SIZE = 300;
const RANGE_OPTIONS: { label: string; half: number }[] = [
  { label: "\u00b132", half: 32 },
  { label: "\u00b164", half: 64 },
  { label: "\u00b1128", half: 128 },
  { label: "\u00b1256", half: 256 },
];

interface PropPlacementCanvasViewProps {
  nodes: Node[];
  edges: Edge[];
  rootNodeId?: string;
  /** Fixed 300px canvas for property panel; otherwise fills container. */
  compact?: boolean;
  title?: string;
}

export function PropPlacementCanvasView({
  nodes,
  edges,
  rootNodeId,
  compact = false,
  title = "Placement Preview",
}: PropPlacementCanvasViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState(compact ? COMPACT_SIZE : COMPACT_SIZE);

  const worldRange = usePropPlacementStore((s) => s.worldRange);
  const showGrid = usePropPlacementStore((s) => s.showGrid);
  const showDensityOverlay = usePropPlacementStore((s) => s.showDensityOverlay);
  const seed = usePropPlacementStore((s) => s.seed);
  const positions = usePropPlacementStore((s) => s.positions);
  const positionCount = usePropPlacementStore((s) => s.positionCount);
  const evaluationError = usePropPlacementStore((s) => s.evaluationError);
  const isEvaluating = usePropPlacementStore((s) => s.isEvaluating);

  const setWorldRange = usePropPlacementStore((s) => s.setWorldRange);
  const setShowGrid = usePropPlacementStore((s) => s.setShowGrid);
  const setShowDensityOverlay = usePropPlacementStore((s) => s.setShowDensityOverlay);
  const setSeed = usePropPlacementStore((s) => s.setSeed);

  usePropPlacementEvaluation(nodes, edges, rootNodeId);

  useEffect(() => {
    if (compact) {
      setCanvasSize(COMPACT_SIZE);
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const size = Math.max(120, Math.floor(Math.min(width, height)));
      setCanvasSize(size);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [compact]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize * dpr;
    canvas.height = canvasSize * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawPropPlacementCanvas(ctx, {
      width: canvasSize,
      height: canvasSize,
      worldRange,
      positions,
      showGrid,
      showDensityOverlay,
      dotRadius: compact ? 2.5 : 3,
      showAxisLabels: true,
    });
  }, [canvasSize, positions, worldRange, showGrid, showDensityOverlay, compact]);

  const handleRangeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const half = parseInt(e.target.value, 10);
      const range: WorldRange = { minX: -half, maxX: half, minZ: -half, maxZ: half };
      setWorldRange(range);
    },
    [setWorldRange],
  );

  const handleSeedChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      if (!isNaN(val)) setSeed(val);
    },
    [setSeed],
  );

  const handleReseed = useCallback(() => {
    setSeed(Math.floor(Math.random() * 100000));
  }, [setSeed]);

  const currentHalf = (worldRange.maxX - worldRange.minX) / 2;

  return (
    <div className={`flex flex-col gap-2 ${compact ? "" : "h-full min-h-0"}`}>
      {title && (
        <h4 className="text-xs font-semibold text-tn-text-muted shrink-0">{title}</h4>
      )}

      <div className="flex items-center gap-2 flex-wrap text-[10px] shrink-0">
        <label className="flex items-center gap-1 text-tn-text-muted">
          Range:
          <select
            value={currentHalf}
            onChange={handleRangeChange}
            className="bg-tn-bg border border-tn-border rounded px-1 py-0.5 text-tn-text text-[10px]"
          >
            {RANGE_OPTIONS.map((opt) => (
              <option key={opt.half} value={opt.half}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1 text-tn-text-muted">
          Seed:
          <input
            type="number"
            value={seed}
            onChange={handleSeedChange}
            className="bg-tn-bg border border-tn-border rounded px-1 py-0.5 text-tn-text text-[10px] w-12"
          />
        </label>

        <label className="flex items-center gap-1 text-tn-text-muted">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
            className="accent-[#6B9E5A]"
          />
          Grid
        </label>

        <label className="flex items-center gap-1 text-tn-text-muted">
          <input
            type="checkbox"
            checked={showDensityOverlay}
            onChange={(e) => setShowDensityOverlay(e.target.checked)}
            className="accent-[#6B9E5A]"
          />
          Density
        </label>

        <button
          type="button"
          onClick={handleReseed}
          className="text-tn-text-muted hover:text-tn-text px-1"
          title="Randomize seed"
        >
          &#x21bb;
        </button>

        <span className="text-tn-text-muted ml-auto tabular-nums">
          {isEvaluating ? "Evaluating…" : `${positionCount.toLocaleString()} positions`}
        </span>
      </div>

      {evaluationError && (
        <div className="text-[10px] text-red-400 bg-red-400/10 rounded px-2 py-1 shrink-0">
          {evaluationError}
        </div>
      )}

      <div
        ref={containerRef}
        className={
          compact
            ? "flex justify-center"
            : "flex-1 min-h-0 flex items-center justify-center"
        }
      >
        <canvas
          ref={canvasRef}
          style={{
            width: canvasSize,
            height: canvasSize,
            imageRendering: "auto",
          }}
          className="border border-tn-border rounded max-w-full max-h-full"
        />
      </div>
    </div>
  );
}
