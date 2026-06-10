import type { JsonRecord, WeatherForecastEntry } from "@/utils/atmosphere";
import { readForecastHour } from "@/utils/atmosphere";
import { CollapsibleEditorSection } from "../CollapsibleEditorSection";
import { ForecastEntryEditorCard } from "./ForecastEntryEditorCard";
import { DAYPARTS, HOURS, type EnvironmentDoc } from "./environmentEditorConstants";

interface EnvironmentForecastBulkSectionProps {
  doc: EnvironmentDoc;
  open: boolean;
  onToggle: () => void;
  forecastScope: "current" | "daypart" | "all";
  onForecastScopeChange: (scope: "current" | "daypart" | "all") => void;
  displayedForecastHours: number[];
  selectedDaypart: (typeof DAYPARTS)[number] | null;
  previewHour: number;
  projectPath: string | null;
  weatherPathIndex: Record<string, string>;
  weatherDocs: Record<string, JsonRecord | null>;
  isHytaleAssetPath: (path: string) => boolean;
  onCopyHourToDaypart: () => void;
  onApplyDaypartTemplate: () => void;
  onNormalizePreviewHourWeights: () => void;
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
}

export function EnvironmentForecastBulkSection({
  doc,
  open,
  onToggle,
  forecastScope,
  onForecastScopeChange,
  displayedForecastHours,
  selectedDaypart,
  previewHour,
  projectPath,
  weatherPathIndex,
  weatherDocs,
  isHytaleAssetPath,
  onCopyHourToDaypart,
  onApplyDaypartTemplate,
  onNormalizePreviewHourWeights,
  onClearForecastHour,
  onAddForecastEntry,
  onUpdateForecastEntry,
  onRemoveForecastEntry,
  onOpenWeatherFile,
  onImportForecastWeather,
  onLocateForecastWeather,
}: EnvironmentForecastBulkSectionProps) {
  return (
    <CollapsibleEditorSection
      title="Hourly Forecasts"
      description="Edit weather IDs and weights without keeping all 24 hour cards expanded at once."
      badge={`${displayedForecastHours.length}/${HOURS.length} hours`}
      open={open}
      onToggle={onToggle}
    >
      <div className="mb-3 rounded border border-tn-border/40 bg-tn-bg/40 px-3 py-3">
        <p className="text-[11px] text-tn-text-muted">
          Each hour card shows the full local forecast setup for that hour: weather ID, weight, file resolution state, and related file actions.
        </p>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-tn-text-muted" htmlFor="environment-forecast-scope">
          Scope
        </label>
        <select
          id="environment-forecast-scope"
          aria-label="Scope"
          value={forecastScope}
          onChange={(event) => onForecastScopeChange(event.target.value as "current" | "daypart" | "all")}
          className="rounded border border-tn-border bg-tn-bg px-2 py-1 text-[11px] text-tn-text"
        >
          <option value="current">Current Hour</option>
          <option value="daypart">Selected Daypart</option>
          <option value="all">All Hours</option>
        </select>
        {forecastScope === "daypart" && !selectedDaypart && (
          <span className="text-[10px] text-amber-300">Select a daypart card to narrow this view.</span>
        )}
        <button
          type="button"
          onClick={onCopyHourToDaypart}
          disabled={!selectedDaypart}
          className="rounded border border-tn-border/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-tn-text-muted transition-colors hover:border-tn-accent/50 hover:text-tn-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          Copy hour to daypart
        </button>
        <button
          type="button"
          onClick={onApplyDaypartTemplate}
          disabled={!selectedDaypart}
          className="rounded border border-tn-border/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-tn-text-muted transition-colors hover:border-tn-accent/50 hover:text-tn-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          Apply daypart template
        </button>
        <button
          type="button"
          onClick={onNormalizePreviewHourWeights}
          disabled={readForecastHour(doc, previewHour).length === 0}
          className="rounded border border-tn-border/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-tn-text-muted transition-colors hover:border-tn-accent/50 hover:text-tn-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          Normalize weights
        </button>
      </div>
      <div className={forecastScope === "current" ? "mx-auto grid w-full max-w-3xl gap-3" : "grid gap-3 xl:grid-cols-2 2xl:grid-cols-3"}>
        {displayedForecastHours.map((hour) => {
          const entries = readForecastHour(doc, hour);
          const totalWeight = entries.reduce((sum, entry) => sum + entry.Weight, 0);
          const hourDaypart = DAYPARTS.find((daypart) => hour >= daypart.start && hour <= daypart.end) ?? null;
          return (
            <div
              key={`forecast-${hour}`}
              className={`rounded border p-3 ${
                selectedDaypart && hour >= selectedDaypart.start && hour <= selectedDaypart.end
                  ? "border-tn-accent/70 bg-tn-accent/10"
                  : "border-tn-border/40 bg-tn-bg"
              }`}
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-semibold text-tn-text">{hour}:00</p>
                    {hourDaypart && (
                      <span
                        className="rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider"
                        style={{
                          borderColor: `${hourDaypart.accent}66`,
                          backgroundColor: `${hourDaypart.accent}1a`,
                          color: hourDaypart.accent,
                        }}
                      >
                        {hourDaypart.label}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                    <span className="rounded border border-tn-border/40 bg-tn-surface/60 px-2 py-1 text-tn-text-muted">
                      {entries.length} entries
                    </span>
                    <span className="rounded border border-tn-border/40 bg-tn-surface/60 px-2 py-1 text-tn-text-muted">
                      Total weight {totalWeight}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {entries.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onClearForecastHour(hour)}
                      className="rounded border border-tn-border/40 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-tn-text-muted transition-colors hover:border-red-500/50 hover:text-red-400"
                    >
                      Clear Hour
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onAddForecastEntry(hour)}
                    className="rounded border border-tn-accent/40 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-tn-accent transition-colors hover:bg-tn-accent/10"
                  >
                    Add Weather
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {entries.length === 0 && (
                  <div className="rounded border border-dashed border-tn-border/50 bg-tn-surface/30 px-3 py-4 text-[11px] text-tn-text-muted">
                    No local forecasts configured for this hour.
                  </div>
                )}

                {entries.map((entry, index) => {
                  const weatherPath = entry.WeatherId ? weatherPathIndex[entry.WeatherId.toLowerCase()] : undefined;
                  const isHytale = weatherPath ? isHytaleAssetPath(weatherPath) : false;
                  return (
                    <ForecastEntryEditorCard
                      key={`forecast-card-${hour}-${index}-${entry.WeatherId}`}
                      entry={entry}
                      index={index}
                      hour={hour}
                      projectPath={projectPath}
                      weatherPath={weatherPath}
                      weatherDoc={entry.WeatherId ? weatherDocs[entry.WeatherId.toLowerCase()] : null}
                      onWeatherIdChange={(weatherId) => onUpdateForecastEntry(hour, index, (current) => ({ ...current, WeatherId: weatherId }))}
                      onWeightChange={(weight) => onUpdateForecastEntry(hour, index, (current) => ({ ...current, Weight: weight }))}
                      onOpen={() => { if (weatherPath) onOpenWeatherFile(weatherPath); }}
                      onImport={isHytale && weatherPath ? () => onImportForecastWeather(entry.WeatherId, weatherPath) : undefined}
                      onLocate={!weatherPath ? () => onLocateForecastWeather(entry.WeatherId) : undefined}
                      onRemove={() => onRemoveForecastEntry(hour, index)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </CollapsibleEditorSection>
  );
}
