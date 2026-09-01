import type { ReactNode } from "react";
import { PreviewSliceHintBanner } from "@/components/preview/PreviewSliceHintBanner";
import {
  USGS_HUD,
  formatContourLabel,
  pickUsgsScaleBarBlocks,
  usgsHypsometricLegendGradient,
} from "@/utils/topoMapStyle";

const panelSurface =
  "rounded-md border bg-[#faf6eb] shadow-sm border-[#c4b89a]";

function HudPanel({
  title,
  children,
  className = "",
  live = false,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  live?: boolean;
}) {
  return (
    <section
      aria-label={title}
      aria-live={live ? "polite" : undefined}
      className={`${panelSurface} min-w-0 px-3 py-2 ${className}`}
    >
      <h3 className="mb-1.5 border-b border-[#c4b89a]/60 pb-1 font-serif text-[9px] font-semibold uppercase tracking-[0.12em] text-[#5c3d1e]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <dt className="text-[10px] leading-snug text-[#4a3728]/70">{label}</dt>
      <dd className="text-right text-[10px] font-medium leading-snug tabular-nums text-[#4a3728]">
        {value}
      </dd>
    </>
  );
}

function MetaList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <dl className={`grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 ${className}`}>
      {children}
    </dl>
  );
}

function NorthArrow() {
  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5" role="img" aria-label="North up">
      <span className="font-serif text-[9px] font-bold leading-none text-[#4a3728]">N</span>
      <svg width="18" height="20" viewBox="0 0 18 20" aria-hidden>
        <path
          d="M9 1 L15 17 L9 13 L3 17 Z"
          fill="#5c3d1e"
          stroke="#5c3d1e"
          strokeWidth="0.5"
        />
      </svg>
    </div>
  );
}

function LegendItem({ swatch, label }: { swatch: ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-2 text-[10px] text-[#4a3728]">
      <span className="flex h-3 w-4 shrink-0 items-center justify-center" aria-hidden>
        {swatch}
      </span>
      <span>{label}</span>
    </li>
  );
}

export interface TopoMapHudProps {
  contourInterval: number;
  rangeMin: number;
  rangeMax: number;
  yLevel: number;
  p02: number;
  p98: number;
  zoom: number;
  evalResolution?: number;
  mapSize: number;
  canvasScale: number;
  hoverInfo: { x: number; z: number; value: number } | null;
  showHydrography?: boolean;
  waterSurfaceY?: number | null;
  sliceHint?: string | null;
}

export function TopoMapHud({
  contourInterval,
  rangeMin,
  rangeMax,
  yLevel,
  p02,
  p98,
  zoom,
  evalResolution,
  mapSize,
  canvasScale,
  hoverInfo,
  showHydrography = false,
  waterSurfaceY = null,
  sliceHint = null,
}: TopoMapHudProps) {
  const worldRange = rangeMax - rangeMin;
  const pixelsPerBlock = mapSize > 0 && worldRange > 0 ? (mapSize * canvasScale) / worldRange : 0;
  const scaleBlocks = pickUsgsScaleBarBlocks(worldRange, 56, pixelsPerBlock);
  const scaleBarPx = Math.min(88, Math.max(0, scaleBlocks * pixelsPerBlock));
  const inset = `${USGS_HUD.insetPx}px`;

  return (
    <aside
      className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between gap-2"
      style={{ padding: inset }}
      aria-label="Topographic map legend and readouts"
    >
      {/* Top rail */}
      <div className="flex items-start justify-between gap-2">
        <HudPanel title="Density range" className="max-w-[42%]">
          <MetaList>
            {zoom !== 1 && <MetaRow label="Zoom" value={`${zoom.toFixed(1)}×`} />}
            {evalResolution != null && zoom !== 1 && (
              <MetaRow label="Grid" value={`${evalResolution}²`} />
            )}
            <MetaRow label="2nd pct" value={p02.toFixed(3)} />
            <MetaRow label="98th pct" value={p98.toFixed(3)} />
          </MetaList>
        </HudPanel>

        <HudPanel title="Sheet information" className="max-w-[48%]">
          <div className="flex items-start gap-3">
            <MetaList className="min-w-0 flex-1">
              <MetaRow label="Contour" value={formatContourLabel(contourInterval)} />
              <MetaRow
                label="Extent"
                value={`${Math.round(rangeMin)} – ${Math.round(rangeMax)}`}
              />
              <MetaRow label="Y slice" value={yLevel} />
              {showHydrography && waterSurfaceY != null && (
                <MetaRow label="Water surface" value={Math.round(waterSurfaceY)} />
              )}
            </MetaList>
            <NorthArrow />
          </div>
        </HudPanel>
      </div>

      {sliceHint && (
        <div className="pointer-events-none flex justify-center px-2">
          <PreviewSliceHintBanner variant="topo" className="max-w-md text-center">
            {sliceHint}
          </PreviewSliceHintBanner>
        </div>
      )}

      {/* Bottom rail */}
      <div className="flex items-end justify-between gap-2">
        <HudPanel title="Cursor" live className="max-w-[42%]">
          <div className="space-y-2">
            {hoverInfo ? (
              <MetaList>
                <MetaRow label="Elevation" value={hoverInfo.value.toFixed(3)} />
                <MetaRow label="X" value={hoverInfo.x} />
                <MetaRow label="Z" value={hoverInfo.z} />
              </MetaList>
            ) : (
              <p className="text-[10px] leading-snug text-[#4a3728]/55">
                Move pointer over map for elevation and coordinates.
              </p>
            )}

            {scaleBarPx >= 20 && (
              <div
                role="img"
                aria-label={`Scale bar: ${scaleBlocks} blocks`}
                className="border-t border-[#c4b89a]/60 pt-2"
              >
                <div
                  className="flex h-2 overflow-hidden rounded-sm border border-[#5c3d1e]"
                  style={{ width: scaleBarPx }}
                >
                  <div className="h-full bg-[#4a3728]" style={{ width: "50%" }} />
                  <div className="h-full flex-1 bg-[#faf6eb]" />
                </div>
                <div
                  className="mt-1 flex justify-between font-mono text-[9px] tabular-nums text-[#4a3728]/80"
                  style={{ width: scaleBarPx }}
                >
                  <span>0</span>
                  <span>{scaleBlocks} blocks</span>
                </div>
              </div>
            )}
          </div>
        </HudPanel>

        <HudPanel title="Legend" className="max-w-[52%]">
          <figure>
            <figcaption className="sr-only">Map symbol legend</figcaption>
            <div
              className="mb-2 flex items-center gap-2"
              role="img"
              aria-label="Hypsometric tint from low to high density"
            >
              <span className="shrink-0 font-mono text-[9px] text-[#4a3728]/70">low</span>
              <div
                className="h-2.5 min-w-[4.5rem] flex-1 rounded-sm border border-[#c4b89a]"
                style={{ background: usgsHypsometricLegendGradient() }}
              />
              <span className="shrink-0 font-mono text-[9px] text-[#4a3728]/70">high</span>
            </div>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <LegendItem
                label="Index contour"
                swatch={<span className="block h-0.5 w-full bg-[#5c3d1e]" />}
              />
              <LegendItem
                label="Depression"
                swatch={<span className="block w-full border-b border-dashed border-[#6b7f9a]" />}
              />
              <LegendItem
                label="Woodland"
                swatch={<span className="block h-2.5 w-2.5 rounded-[1px] bg-[#8cbe96]/85" />}
              />
              {showHydrography && (
                <LegendItem
                  label="Hydrography"
                  swatch={<span className="block h-2.5 w-2.5 rounded-[1px] bg-[#8cb8de]/90" />}
                />
              )}
              <LegendItem
                label="Cliff hachure"
                swatch={<span className="block w-full border-t border-[#4a3728]/55" />}
              />
              <LegendItem
                label="Spot elevation"
                swatch={<span className="font-serif text-[9px] leading-none text-[#5c3d1e]">▲</span>}
              />
            </ul>
          </figure>
        </HudPanel>
      </div>
    </aside>
  );
}
