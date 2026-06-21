import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useEditorStore } from "@/stores/editorStore";
import { useBiomeSelectorPreview } from "@/hooks/useBiomeSelectorPreview";
import { previewCalloutClasses, previewHudChipActiveClass, previewHudChipClass } from "@/components/ui/surfaceStyles";
import { biomeColor } from "@/utils/biomeRangeColors";
import { estimateCoveragePercent, validateBiomeRanges } from "@/utils/biomeRangeDomain";
import { biomeAtMapPixel } from "@/utils/biomeSelectorPreview";

const RESOLUTIONS = [32, 64, 128] as const;

export function BiomeSelectorMapPanel() {
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const biomeRanges = useEditorStore((s) => s.biomeRanges);
  const noiseRangeConfig = useEditorStore((s) => s.noiseRangeConfig);
  const setSelectedBiomeIndex = useEditorStore((s) => s.setSelectedBiomeIndex);

  const [resolution, setResolution] = useState<(typeof RESOLUTIONS)[number]>(64);
  const [tooltip, setTooltip] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const validation = validateBiomeRanges(biomeRanges, noiseRangeConfig);
  const hasCoverageIssues = validation.gaps.length > 0 || validation.overlaps.length > 0;

  const { map, imageData, loading } = useBiomeSelectorPreview({
    nodes,
    edges,
    ranges: biomeRanges,
    defaultBiome: noiseRangeConfig?.DefaultBiome ?? "",
    resolution,
    enabled: biomeRanges.length > 0 && nodes.length > 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageData) return;
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(imageData, 0, 0);
  }, [imageData]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!map) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor(((e.clientX - rect.left) / rect.width) * map.width);
      const y = Math.floor(((e.clientY - rect.top) / rect.height) * map.height);
      const hit = biomeAtMapPixel(
        map,
        biomeRanges,
        noiseRangeConfig?.DefaultBiome ?? "",
        x,
        y,
      );
      if (hit.index !== null) setSelectedBiomeIndex(hit.index);
      setTooltip(`${hit.biome} @ noise ${hit.noise.toFixed(3)}`);
    },
    [map, biomeRanges, noiseRangeConfig, setSelectedBiomeIndex],
  );

  return (
    <div className="flex flex-col gap-2">
      {hasCoverageIssues && (
        <div className={`flex items-start gap-2 rounded border px-2 py-1.5 text-[10px] ${previewCalloutClasses.warning}`}>
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
          <p>Fix range gaps or overlaps before trusting the selector map.</p>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {RESOLUTIONS.map((res) => (
          <button
            key={res}
            type="button"
            onClick={() => setResolution(res)}
            className={resolution === res ? previewHudChipActiveClass : previewHudChipClass}
          >
            {res}×{res}
          </button>
        ))}
      </div>

      <div className="relative aspect-square max-h-40 w-full overflow-hidden rounded border border-tn-border bg-black/30">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-tn-panel/80">
            <Loader2 className="h-4 w-4 animate-spin text-tn-text-muted" />
          </div>
        )}
        {!loading && !imageData && (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-[10px] text-tn-text-muted">
            Add a selector Density graph on the canvas below to preview biome regions.
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="h-full w-full cursor-crosshair object-contain image-pixelated"
          onClick={handleCanvasClick}
          role="img"
          aria-label="Biome selector map preview"
        />
      </div>

      {tooltip && <p className="font-mono text-[10px] text-tn-text-muted">{tooltip}</p>}

      {biomeRanges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {biomeRanges.map((r) => (
            <div key={r.Biome} className="flex items-center gap-1 text-[9px] text-tn-text-muted">
              <span
                className="h-2 w-2 shrink-0 rounded-sm"
                style={{ backgroundColor: biomeColor(r.Biome) }}
              />
              <span className="max-w-[80px] truncate">{r.Biome}</span>
              <span className="tabular-nums">{estimateCoveragePercent(r).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
