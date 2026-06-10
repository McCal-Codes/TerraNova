import {
  getEffectiveForecastHour,
  selectDominantForecastEntry,
  type JsonRecord,
  type WeatherForecastEntry,
} from "@/utils/atmosphere";
import type { WeatherAssetLookupStatus } from "@/hooks/useWeatherAssetIndex";
import { AtmosphereScenePreview } from "./AtmosphereScenePreview";
import { AtmosphereSceneSyncFooter } from "./AtmosphereSceneSyncFooter";
import { EnvironmentForecastStrip } from "./EnvironmentForecastStrip";
import { EnvironmentMetricCard } from "./EnvironmentMetricCard";
import { ForecastEntryEditorCard } from "./ForecastEntryEditorCard";
import { PreviewHourControls } from "./PreviewHourControls";
import { DAYPARTS, type EnvironmentDoc } from "./environmentEditorConstants";

interface DaypartSummary {
  id: string;
  label: string;
  start: number;
  end: number;
  accent: string;
  dominantWeatherId: string | null;
  uniqueWeatherCount: number;
  totalEntries: number;
}

interface EnvironmentPreviewPanelProps {
  doc: EnvironmentDoc;
  mergedEnvironment: JsonRecord | null;
  previewHour: number;
  onPreviewHourChange: (hour: number) => void;
  weatherDocs: Record<string, JsonRecord | null>;
  selectedDaypart: (typeof DAYPARTS)[number] | null;
  selectedDaypartId: string | null;
  onSelectDaypart: (id: string, startHour: number) => void;
  lookupStatus: WeatherAssetLookupStatus;
  weatherFileCount: number;
  lookupError: string | null;
  tagEntries: [string, unknown][];
  uniqueWeatherIds: string[];
  primaryForecast: WeatherForecastEntry | null;
  activeForecasts: WeatherForecastEntry[];
  daypartSummaries: DaypartSummary[];
  projectPath: string | null;
  weatherPathIndex: Record<string, string>;
  isHytaleAssetPath: (path: string) => boolean;
  onClearForecastHour: (hour: number) => void;
  onAddForecastEntry: (hour: number) => void;
  onUpdateForecastEntry: (
    hour: number,
    index: number,
    updater: (entry: WeatherForecastEntry) => WeatherForecastEntry,
  ) => void;
  onRemoveForecastEntry: (hour: number, index: number) => void;
  onOpenWeatherFile: (path: string) => void;
  onImportForecastWeather: (weatherId: string, sourcePath: string) => void;
  onLocateForecastWeather: (weatherId: string) => void;
  compact?: boolean;
}

export function EnvironmentPreviewPanel({
  doc,
  mergedEnvironment,
  previewHour,
  onPreviewHourChange,
  weatherDocs,
  selectedDaypart,
  selectedDaypartId,
  onSelectDaypart,
  lookupStatus,
  weatherFileCount,
  lookupError,
  tagEntries,
  uniqueWeatherIds,
  primaryForecast,
  activeForecasts,
  daypartSummaries,
  projectPath,
  weatherPathIndex,
  isHytaleAssetPath,
  onClearForecastHour,
  onAddForecastEntry,
  onUpdateForecastEntry,
  onRemoveForecastEntry,
  onOpenWeatherFile,
  onImportForecastWeather,
  onLocateForecastWeather,
  compact = false,
}: EnvironmentPreviewPanelProps) {
  const effectiveForecast = getEffectiveForecastHour(
    doc as JsonRecord,
    mergedEnvironment,
    previewHour,
  );
  const dominantEntry = selectDominantForecastEntry(effectiveForecast.entries);
  const sceneWeatherDoc = dominantEntry?.WeatherId
    ? weatherDocs[dominantEntry.WeatherId.toLowerCase()] ?? null
    : null;

  return (
    <div>
      {!compact && (
        <PreviewHourControls
          idPrefix="environment"
          previewHour={previewHour}
          onPreviewHourChange={onPreviewHourChange}
        />
      )}

      {sceneWeatherDoc ? (
        <div className="mb-3">
          <AtmosphereScenePreview
            doc={sceneWeatherDoc}
            previewHour={previewHour}
            onPreviewHourChange={onPreviewHourChange}
            weatherLabel={dominantEntry?.WeatherId ?? null}
            inherited={effectiveForecast.source === "inherited"}
            showSwatches={!compact}
            showHourSlider={compact && Boolean(onPreviewHourChange)}
            sliderIdPrefix="environment-scene"
          />
        </div>
      ) : (
        <div className="mb-3 rounded-xl border border-dashed border-tn-border/50 bg-tn-surface/20 px-4 py-8 text-center text-[11px] text-tn-text-muted">
          {dominantEntry?.WeatherId
            ? `Weather "${dominantEntry.WeatherId}" is not loaded yet. Import or open it to preview the scene.`
            : "Add a weather forecast for this hour to see the scene preview."}
        </div>
      )}

      {compact && <AtmosphereSceneSyncFooter className="mb-3" />}

      <div className="mb-3">
        <EnvironmentForecastStrip
          localDoc={doc as JsonRecord}
          mergedDoc={mergedEnvironment}
          previewHour={previewHour}
          weatherDocs={weatherDocs}
          selectedDaypart={selectedDaypart}
          onSelectHour={onPreviewHourChange}
          lookupStatus={lookupStatus}
          weatherFileCount={weatherFileCount}
          lookupError={lookupError}
          weatherPathIndex={weatherPathIndex}
          onOpenWeatherFile={onOpenWeatherFile}
        />
      </div>

      {!compact && (
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          <EnvironmentMetricCard label="Parent" value={doc.Parent ?? "None"} />
          <EnvironmentMetricCard label="Water Tint" value={typeof doc.WaterTint === "string" ? doc.WaterTint : "Unset"} />
          <EnvironmentMetricCard label="Spawn Density" value={typeof doc.SpawnDensity === "number" ? String(doc.SpawnDensity) : "Unset"} />
          <EnvironmentMetricCard
            label="Block Mod"
            value={typeof doc.BlockModificationAllowed === "boolean" ? (doc.BlockModificationAllowed ? "Allowed" : "Blocked") : "Unset"}
          />
          <EnvironmentMetricCard label="Tag Groups" value={String(tagEntries.length)} detail={tagEntries.slice(0, 2).map(([key]) => key).join(", ") || "No tags"} />
          <EnvironmentMetricCard label="Unique Weathers" value={String(uniqueWeatherIds.length)} detail={primaryForecast?.WeatherId ?? "No active forecast"} />
        </div>
      )}

      {!compact && (
      <div className="mt-3 rounded border border-tn-border/50 bg-tn-bg/70 p-3">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-tn-text-muted">Active Forecasts</p>
            <p className="mt-1 text-[11px] text-tn-text-muted">
              {compact
                ? "Set which weather applies at the selected hour."
                : "Full forecast editor for the currently selected preview hour."}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
              <span className="rounded border border-tn-border/40 bg-tn-bg/60 px-2 py-1 text-tn-text-muted">
                Hour {previewHour}:00
              </span>
              <span className="rounded border border-tn-border/40 bg-tn-bg/60 px-2 py-1 text-tn-text-muted">
                {activeForecasts.length} entries
              </span>
              <span className="rounded border border-tn-border/40 bg-tn-bg/60 px-2 py-1 text-tn-text-muted">
                Total weight {activeForecasts.reduce((sum, entry) => sum + entry.Weight, 0)}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeForecasts.length > 0 && (
              <button
                type="button"
                onClick={() => onClearForecastHour(previewHour)}
                className="rounded border border-tn-border/40 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-tn-text-muted transition-colors hover:border-red-500/50 hover:text-red-400"
              >
                Clear Hour
              </button>
            )}
            <button
              type="button"
              onClick={() => onAddForecastEntry(previewHour)}
              className="rounded border border-tn-accent/40 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-tn-accent transition-colors hover:bg-tn-accent/10"
            >
              Add Weather
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {activeForecasts.length === 0 && (
            <div className="rounded border border-dashed border-tn-border/50 bg-tn-surface/30 px-3 py-4 text-[11px] text-tn-text-muted">
              {doc.Parent?.trim()
                ? `No local weather forecasts configured for this hour. This file may inherit forecasts from ${doc.Parent}.`
                : "No weather forecasts configured for this hour."}
            </div>
          )}
          {activeForecasts.map((entry, index) => {
            const weatherPath = entry.WeatherId ? weatherPathIndex[entry.WeatherId.toLowerCase()] : undefined;
            const isHytale = weatherPath ? isHytaleAssetPath(weatherPath) : false;
            return (
              <ForecastEntryEditorCard
                key={`active-forecast-card-${previewHour}-${index}-${entry.WeatherId}`}
                entry={entry}
                index={index}
                hour={previewHour}
                projectPath={projectPath}
                weatherPath={weatherPath}
                weatherDoc={entry.WeatherId ? weatherDocs[entry.WeatherId.toLowerCase()] : null}
                onWeatherIdChange={(weatherId) => onUpdateForecastEntry(previewHour, index, (current) => ({ ...current, WeatherId: weatherId }))}
                onWeightChange={(weight) => onUpdateForecastEntry(previewHour, index, (current) => ({ ...current, Weight: weight }))}
                onOpen={() => { if (weatherPath) onOpenWeatherFile(weatherPath); }}
                onImport={isHytale && weatherPath ? () => onImportForecastWeather(entry.WeatherId, weatherPath) : undefined}
                onLocate={!weatherPath ? () => onLocateForecastWeather(entry.WeatherId) : undefined}
                onRemove={() => onRemoveForecastEntry(previewHour, index)}
              />
            );
          })}
        </div>
      </div>
      )}

      {!compact && (
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {daypartSummaries.map((daypart) => (
          <button
            key={daypart.id}
            type="button"
            onClick={() => onSelectDaypart(daypart.id, daypart.start)}
            className={`rounded border px-3 py-2 text-left transition-colors ${
              selectedDaypartId === daypart.id
                ? "border-tn-accent/70 bg-tn-accent/10"
                : "border-tn-border/50 bg-tn-bg/70 hover:border-tn-accent/40"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: daypart.accent }} />
              <p className="text-[11px] font-medium text-tn-text">{daypart.label}</p>
            </div>
            <p className="mt-1 text-[10px] text-tn-text-muted">{daypart.start}:00 - {daypart.end}:00</p>
            <p className="mt-2 text-[11px] text-tn-text">
              {daypart.dominantWeatherId ?? "No dominant weather"}
            </p>
            <p className="mt-1 text-[10px] text-tn-text-muted">
              {daypart.uniqueWeatherCount} unique weather, {daypart.totalEntries} entries
            </p>
          </button>
        ))}
      </div>
      )}
    </div>
  );
}
