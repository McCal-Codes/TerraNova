import {
  buildColorString,
  readHexColor,
  upsertValueKeyframe,
  type HourValue,
} from "@/utils/atmosphere";
import { CollapsibleEditorSection } from "../CollapsibleEditorSection";
import type { ColorTrackKey, WeatherDoc } from "./weatherEditorConstants";

interface WeatherQuickEditSectionProps {
  doc: WeatherDoc;
  previewHour: number;
  open: boolean;
  onToggle: () => void;
  skyTop: string;
  skyBottom: string;
  sunsetColor: string;
  fogColor: string;
  sunColor: string;
  waterTint: string;
  sunScale: number;
  fogDensity: number;
  onSetSimpleColor: (trackKey: ColorTrackKey, color: string) => void;
  onUpdateDoc: (updater: (previous: WeatherDoc) => WeatherDoc) => void;
  onUpdateSunScales: (next: HourValue[]) => void;
  onUpdateFogDensities: (next: HourValue[]) => void;
}

export function WeatherQuickEditSection({
  doc,
  previewHour,
  open,
  onToggle,
  skyTop,
  skyBottom,
  sunsetColor,
  fogColor,
  sunColor,
  waterTint,
  sunScale,
  fogDensity,
  onSetSimpleColor,
  onUpdateDoc,
  onUpdateSunScales,
  onUpdateFogDensities,
}: WeatherQuickEditSectionProps) {
  return (
    <CollapsibleEditorSection
      title="Quick Edit"
      description="Fast color and fog edits at the selected preview hour."
      badge={`${previewHour}:00`}
      open={open}
      onToggle={onToggle}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {([
          { key: "SkyTopColors", label: "Sky Top", value: skyTop },
          { key: "SkyBottomColors", label: "Sky Bottom", value: skyBottom },
          { key: "SkySunsetColors", label: "Sunset", value: sunsetColor },
          { key: "FogColors", label: "Fog", value: fogColor },
          { key: "SunColors", label: "Sun", value: sunColor },
          { key: "WaterTints", label: "Water Tint", value: waterTint },
        ] as const).map((control) => (
          <label key={control.key} className="rounded border border-tn-border/40 bg-tn-bg/70 px-3 py-2">
            <span className="mb-2 block text-[10px] uppercase tracking-wider text-tn-text-muted">{control.label}</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={readHexColor(control.value)}
                onChange={(event) => onSetSimpleColor(control.key, buildColorString(event.target.value, 1))}
                className="h-8 w-10 shrink-0 cursor-pointer rounded border border-tn-border/70 bg-transparent p-0"
              />
              <input
                type="text"
                value={readHexColor(control.value)}
                onChange={(event) => onSetSimpleColor(control.key, buildColorString(event.target.value, 1))}
                className="min-w-0 flex-1 rounded border border-tn-border bg-tn-bg px-2 py-1 text-[11px] font-mono text-tn-text"
              />
            </div>
          </label>
        ))}

        <div className="rounded border border-tn-border/40 bg-tn-bg/70 px-3 py-2">
          <span className="mb-2 block text-[10px] uppercase tracking-wider text-tn-text-muted">Fog Distance</span>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] text-tn-text-muted">
              Near
              <input
                type="number"
                step={1}
                value={doc.FogDistance?.[0] ?? -96}
                onChange={(event) => {
                  const value = Number.parseFloat(event.target.value);
                  if (!Number.isFinite(value)) return;
                  onUpdateDoc((previous) => ({
                    ...previous,
                    FogDistance: [value, (previous.FogDistance ?? [-96, 1024])[1]],
                  }));
                }}
                className="mt-1 w-full rounded border border-tn-border bg-tn-bg px-2 py-1 text-[11px] font-mono text-right text-tn-text"
              />
            </label>
            <label className="text-[10px] text-tn-text-muted">
              Far
              <input
                type="number"
                step={1}
                value={doc.FogDistance?.[1] ?? 1024}
                onChange={(event) => {
                  const value = Number.parseFloat(event.target.value);
                  if (!Number.isFinite(value)) return;
                  onUpdateDoc((previous) => ({
                    ...previous,
                    FogDistance: [(previous.FogDistance ?? [-96, 1024])[0], value],
                  }));
                }}
                className="mt-1 w-full rounded border border-tn-border bg-tn-bg px-2 py-1 text-[11px] font-mono text-right text-tn-text"
              />
            </label>
          </div>
        </div>

        <div className="rounded border border-tn-border/40 bg-tn-bg/70 px-3 py-2">
          <span className="mb-2 block text-[10px] uppercase tracking-wider text-tn-text-muted">Simple Values</span>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] text-tn-text-muted">
              Sun Scale
              <input
                type="number"
                step={0.05}
                value={sunScale}
                onChange={(event) => {
                  const value = Number.parseFloat(event.target.value);
                  if (!Number.isFinite(value)) return;
                  onUpdateSunScales(upsertValueKeyframe(((doc.SunScales as HourValue[] | undefined) ?? []), previewHour, value));
                }}
                className="mt-1 w-full rounded border border-tn-border bg-tn-bg px-2 py-1 text-[11px] font-mono text-right text-tn-text"
              />
            </label>
            <label className="text-[10px] text-tn-text-muted">
              Fog Density
              <input
                type="number"
                step={0.05}
                value={fogDensity}
                onChange={(event) => {
                  const value = Number.parseFloat(event.target.value);
                  if (!Number.isFinite(value)) return;
                  onUpdateFogDensities(upsertValueKeyframe(((doc.FogDensities as HourValue[] | undefined) ?? []), previewHour, value));
                }}
                className="mt-1 w-full rounded border border-tn-border bg-tn-bg px-2 py-1 text-[11px] font-mono text-right text-tn-text"
              />
            </label>
          </div>
        </div>
      </div>
    </CollapsibleEditorSection>
  );
}
