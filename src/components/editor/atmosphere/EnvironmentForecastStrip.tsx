import { useMemo } from "react";
import {
  getEffectiveForecastHour,
  selectDominantForecastEntry,
  sampleWeatherSkyGradient,
  type JsonRecord,
} from "@/utils/atmosphere";
import { ATMOSPHERE_HOURS } from "@/utils/atmosphere/atmosphereHours";

const HOURS = ATMOSPHERE_HOURS;

interface HourCell {
  hour: number;
  gradient: string | undefined;
  title: string;
  inherited: boolean;
  weatherId: string | null;
  weatherPath: string | null;
}

interface EnvironmentForecastStripProps {
  localDoc: JsonRecord;
  mergedDoc: JsonRecord | null;
  previewHour: number;
  weatherDocs: Record<string, JsonRecord | null | undefined>;
  selectedDaypart: { start: number; end: number } | null;
  onSelectHour: (hour: number) => void;
  lookupStatus: "idle" | "loading" | "ready" | "error";
  weatherFileCount: number;
  lookupError: string | null;
  weatherPathIndex?: Record<string, string>;
  onOpenWeatherFile?: (path: string) => void;
}

export function EnvironmentForecastStrip({
  localDoc,
  mergedDoc,
  previewHour,
  weatherDocs,
  selectedDaypart,
  onSelectHour,
  lookupStatus,
  weatherFileCount,
  lookupError,
  weatherPathIndex,
  onOpenWeatherFile,
}: EnvironmentForecastStripProps) {
  const hourColors = useMemo((): HourCell[] => HOURS.map((hour) => {
    const effective = getEffectiveForecastHour(localDoc, mergedDoc, hour);
    const dominant = selectDominantForecastEntry(effective.entries);
    const weatherId = dominant?.WeatherId ?? null;
    const weatherPath = weatherId && weatherPathIndex
      ? weatherPathIndex[weatherId.toLowerCase()] ?? null
      : null;
    const weatherDoc = weatherId
      ? weatherDocs[weatherId.toLowerCase()] ?? null
      : null;
    const gradient = sampleWeatherSkyGradient(weatherDoc, hour);
    const openHint = weatherPath ? " — double-click to open weather file" : "";
    return {
      hour,
      gradient: dominant ? `linear-gradient(to bottom, ${gradient.top}, ${gradient.bottom})` : undefined,
      title: dominant
        ? `${hour}:00 ${dominant.WeatherId} (${dominant.Weight})${effective.source === "inherited" ? " inherited" : ""}${openHint}`
        : `${hour}:00 no forecast`,
      inherited: effective.source === "inherited",
      weatherId,
      weatherPath,
    };
  }), [localDoc, mergedDoc, weatherDocs, weatherPathIndex]);

  return (
    <div className="rounded border border-tn-border/50 bg-tn-bg/70 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tn-text-muted">24-Hour Schedule</p>
          <p className="mt-1 text-[11px] text-tn-text-muted">
            Click an hour to preview it. Double-click to open the dominant weather file when available. Dim cells inherit weather from Parent.
          </p>
        </div>
        <div className="text-right text-[10px] text-tn-text-muted">
          {lookupStatus === "ready" && <p>{weatherFileCount} weather files indexed</p>}
          {lookupStatus === "loading" && <p>Loading Server/Weathers...</p>}
          {lookupStatus === "error" && <p className="text-amber-300">{lookupError ?? "Weather lookup failed."}</p>}
        </div>
      </div>
      <div className="grid grid-cols-12 gap-1 sm:grid-cols-24">
        {hourColors.map(({ hour, gradient, title, inherited, weatherPath }) => {
          const inSelectedDaypart = selectedDaypart ? hour >= selectedDaypart.start && hour <= selectedDaypart.end : false;
          return (
            <button
              key={`timeline-${hour}`}
              type="button"
              onClick={() => onSelectHour(hour)}
              onDoubleClick={() => {
                if (weatherPath && onOpenWeatherFile) {
                  onOpenWeatherFile(weatherPath);
                }
              }}
              className={`rounded border transition-transform hover:-translate-y-0.5 ${
                previewHour === hour || inSelectedDaypart ? "border-tn-accent ring-1 ring-tn-accent/45" : "border-tn-border/50"
              }`}
              title={title}
              aria-label={title}
            >
              <div
                className="h-10 rounded-sm"
                style={{
                  background: gradient ?? "transparent",
                  opacity: inherited ? 0.72 : 1,
                }}
              />
              <p className="py-1 text-center text-[9px] font-mono text-tn-text-muted">{hour}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
