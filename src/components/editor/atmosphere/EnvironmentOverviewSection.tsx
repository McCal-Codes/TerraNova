import { readForecastHour } from "@/utils/atmosphere";
import { CollapsibleEditorSection } from "../CollapsibleEditorSection";
import type { EnvironmentDoc } from "./environmentEditorConstants";

interface WeatherOption {
  id: string;
  path: string;
}

interface EnvironmentOverviewSectionProps {
  doc: EnvironmentDoc;
  open: boolean;
  onToggle: () => void;
  parentChain: string[];
  environmentParentOptions: string[];
  suggestedParentEnvironment: string | null;
  weatherOptions: WeatherOption[];
  previewHour: number;
  primaryForecast: { WeatherId: string; Weight: number } | null;
  onUpdateDoc: (updater: (previous: EnvironmentDoc) => EnvironmentDoc) => void;
  onOpenEnvironment?: (environmentName: string) => void;
  parentEnvironmentPaths?: Record<string, string>;
  compact?: boolean;
}

export function EnvironmentOverviewSection({
  doc,
  open,
  onToggle,
  parentChain,
  environmentParentOptions,
  suggestedParentEnvironment,
  weatherOptions,
  previewHour,
  primaryForecast,
  onUpdateDoc,
  onOpenEnvironment,
  parentEnvironmentPaths = {},
  compact = false,
}: EnvironmentOverviewSectionProps) {
  return (
    <CollapsibleEditorSection
      title={compact ? "Settings" : "Overview"}
      description={compact
        ? "Parent, weather at the preview hour, and water tint."
        : "Parent, weather, water tint, spawn density and block modification settings."}
      badge={doc.Parent ?? "No parent"}
      open={open}
      onToggle={onToggle}
    >
      <datalist id="environment-weather-options">
        {weatherOptions.map((weather) => (
          <option key={weather.path} value={weather.id} />
        ))}
      </datalist>
      <datalist id="environment-parent-options">
        {environmentParentOptions.map((environmentName) => (
          <option key={environmentName} value={environmentName} />
        ))}
      </datalist>
      {parentChain.length > 0 && (
        <p className="mb-3 text-[11px] text-tn-text-muted">
          <span className="font-semibold uppercase tracking-wider text-tn-text-muted/80">Parent chain: </span>
          {parentChain.map((name, index) => {
            const path = parentEnvironmentPaths[name.toLowerCase()];
            const canOpen = Boolean(path && onOpenEnvironment);
            return (
              <span key={`${name}-${index}`}>
                {index > 0 && <span className="mx-1 text-tn-text-muted/60">→</span>}
                {canOpen ? (
                  <button
                    type="button"
                    onClick={() => onOpenEnvironment!(name)}
                    className="font-medium text-tn-accent transition-colors hover:text-tn-accent/80"
                    title={`Open ${name}`}
                  >
                    {name}
                  </button>
                ) : (
                  <span>{name}</span>
                )}
              </span>
            );
          })}
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <label className="block text-[10px] uppercase tracking-wider text-tn-text-muted">Parent</label>
            {!doc.Parent?.trim() && suggestedParentEnvironment && (
              <button
                type="button"
                onClick={() => onUpdateDoc((previous) => ({ ...previous, Parent: suggestedParentEnvironment }))}
                className="text-[10px] text-tn-accent transition-colors hover:text-tn-accent/80"
              >
                Use {suggestedParentEnvironment}
              </button>
            )}
          </div>
          <input
            type="text"
            list="environment-parent-options"
            value={doc.Parent ?? ""}
            onChange={(event) => onUpdateDoc((previous) => ({ ...previous, Parent: event.target.value || undefined }))}
            className="w-full rounded border border-tn-border bg-tn-bg px-2 py-1 text-[11px] text-tn-text"
            placeholder="Env_Zone1"
          />
          <p className="text-[10px] text-tn-text-muted">
            Inherits WeatherForecasts and settings from the parent environment. Hytale usually chains variants to a shared base such as Env_Zone1, Env_Zone1_Caves, or Env_Forgotten_Temple_Base.
            {!doc.Parent?.trim() && suggestedParentEnvironment ? ` Suggested default: ${suggestedParentEnvironment}.` : ""}
          </p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-wider text-tn-text-muted">Water Tint</label>
            {"WaterTint" in doc && (
              <button type="button" onClick={() => onUpdateDoc((previous) => { const next = { ...previous }; delete next.WaterTint; return next; })} className="text-[10px] text-tn-text-muted hover:text-red-400">Remove</button>
            )}
          </div>
          {"WaterTint" in doc ? (
            <div className="flex items-center gap-2">
              <label className="relative shrink-0 cursor-pointer">
                <div className="h-7 w-7 rounded border border-tn-border/70" style={{ backgroundColor: typeof doc.WaterTint === "string" ? doc.WaterTint : "#1983d9" }} />
                <input type="color" value={typeof doc.WaterTint === "string" ? doc.WaterTint : "#1983d9"} onChange={(event) => onUpdateDoc((previous) => ({ ...previous, WaterTint: event.target.value }))} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
              </label>
              <input type="text" value={typeof doc.WaterTint === "string" ? doc.WaterTint : ""} onChange={(event) => onUpdateDoc((previous) => ({ ...previous, WaterTint: event.target.value }))} className="min-w-0 flex-1 rounded border border-tn-border bg-tn-bg px-2 py-1 text-[11px] font-mono text-tn-text" />
            </div>
          ) : (
            <button type="button" onClick={() => onUpdateDoc((previous) => ({ ...previous, WaterTint: "#1983d9" }))} className="w-full rounded border border-dashed border-tn-border/60 px-2 py-2 text-[11px] text-tn-text-muted hover:border-tn-accent hover:text-tn-accent">Add Water Tint</button>
          )}
          <p className="text-[10px] text-tn-text-muted">Overrides the water color for this environment.</p>
        </div>

        {compact && (
        <div className="space-y-1 md:col-span-2">
          <label className="text-[10px] uppercase tracking-wider text-tn-text-muted">
            Weather @ {previewHour}:00
          </label>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_88px]">
            <input
              type="text"
              list="environment-weather-options"
              value={primaryForecast?.WeatherId ?? ""}
              onChange={(event) => onUpdateDoc((previous) => {
                const entries = [...readForecastHour(previous, previewHour)];
                if (entries.length === 0) {
                  entries.push({ WeatherId: event.target.value, Weight: 100 });
                } else {
                  entries[0] = { ...entries[0], WeatherId: event.target.value };
                }
                return {
                  ...previous,
                  WeatherForecasts: { ...(previous.WeatherForecasts ?? {}), [String(previewHour)]: entries },
                };
              })}
              className="w-full rounded border border-tn-border bg-tn-bg px-2 py-1 text-[11px] text-tn-text"
              placeholder="Zone1_Sunny"
            />
            <input
              type="number"
              step={1}
              value={primaryForecast?.Weight ?? 100}
              onChange={(event) => {
                const weight = Number.parseFloat(event.target.value);
                if (!Number.isFinite(weight)) return;
                onUpdateDoc((previous) => {
                  const entries = [...readForecastHour(previous, previewHour)];
                  if (entries.length === 0) {
                    entries.push({ WeatherId: weatherOptions[0]?.id ?? "", Weight: weight });
                  } else {
                    entries[0] = { ...entries[0], Weight: weight };
                  }
                  return {
                    ...previous,
                    WeatherForecasts: { ...(previous.WeatherForecasts ?? {}), [String(previewHour)]: entries },
                  };
                });
              }}
              className="w-full rounded border border-tn-border bg-tn-bg px-2 py-1 text-[11px] font-mono text-right text-tn-text"
            />
          </div>
        </div>
        )}

        {!compact && (
        <>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-wider text-tn-text-muted">Spawn Density</label>
            {"SpawnDensity" in doc && (
              <button type="button" onClick={() => onUpdateDoc((previous) => { const next = { ...previous }; delete next.SpawnDensity; return next; })} className="text-[10px] text-tn-text-muted hover:text-red-400">Remove</button>
            )}
          </div>
          {"SpawnDensity" in doc ? (
            <input type="number" step={0.05} value={typeof doc.SpawnDensity === "number" ? doc.SpawnDensity : 0} onChange={(event) => { const value = Number.parseFloat(event.target.value); if (!Number.isFinite(value)) return; onUpdateDoc((previous) => ({ ...previous, SpawnDensity: value })); }} className="w-full rounded border border-tn-border bg-tn-bg px-2 py-1 text-[11px] font-mono text-right text-tn-text" />
          ) : (
            <button type="button" onClick={() => onUpdateDoc((previous) => ({ ...previous, SpawnDensity: 0.3 }))} className="w-full rounded border border-dashed border-tn-border/60 px-2 py-2 text-[11px] text-tn-text-muted hover:border-tn-accent hover:text-tn-accent">Add Spawn Density</button>
          )}
          <p className="text-[10px] text-tn-text-muted">Controls how frequently entities spawn in this environment.</p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-wider text-tn-text-muted">Block Modification</label>
            {"BlockModificationAllowed" in doc && (
              <button type="button" onClick={() => onUpdateDoc((previous) => { const next = { ...previous }; delete next.BlockModificationAllowed; return next; })} className="text-[10px] text-tn-text-muted hover:text-red-400">Remove</button>
            )}
          </div>
          {"BlockModificationAllowed" in doc ? (
            <label className="flex items-center justify-between rounded border border-tn-border/40 bg-tn-bg px-2 py-2">
              <span className="text-[11px] text-tn-text">Block Modification Allowed</span>
              <input type="checkbox" checked={Boolean(doc.BlockModificationAllowed)} onChange={(event) => onUpdateDoc((previous) => ({ ...previous, BlockModificationAllowed: event.target.checked }))} />
            </label>
          ) : (
            <button type="button" onClick={() => onUpdateDoc((previous) => ({ ...previous, BlockModificationAllowed: false }))} className="w-full rounded border border-dashed border-tn-border/60 px-2 py-2 text-[11px] text-tn-text-muted hover:border-tn-accent hover:text-tn-accent">Add Block Modification Toggle</button>
          )}
          <p className="text-[10px] text-tn-text-muted">Whether players can place or break blocks in this environment.</p>
        </div>
        </>
        )}

        {!compact && (
        <div className="space-y-1 md:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[10px] uppercase tracking-wider text-tn-text-muted">Primary Weather @ {previewHour}:00</label>
            <span className="text-[10px] text-tn-text-muted">{primaryForecast ? "Editing current hour default" : "Will create first entry"}</span>
          </div>
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px]">
            <input type="text" list="environment-weather-options" value={primaryForecast?.WeatherId ?? ""} onChange={(event) => onUpdateDoc((previous) => { const entries = [...readForecastHour(previous, previewHour)]; if (entries.length === 0) { entries.push({ WeatherId: event.target.value, Weight: 100 }); } else { entries[0] = { ...entries[0], WeatherId: event.target.value }; } return { ...previous, WeatherForecasts: { ...(previous.WeatherForecasts ?? {}), [String(previewHour)]: entries } }; })} className="w-full rounded border border-tn-border bg-tn-bg px-2 py-1 text-[11px] text-tn-text" placeholder="Zone1_Sunny" />
            <input type="number" step={1} value={primaryForecast?.Weight ?? 100} onChange={(event) => { const weight = Number.parseFloat(event.target.value); if (!Number.isFinite(weight)) return; onUpdateDoc((previous) => { const entries = [...readForecastHour(previous, previewHour)]; if (entries.length === 0) { entries.push({ WeatherId: weatherOptions[0]?.id ?? "", Weight: weight }); } else { entries[0] = { ...entries[0], Weight: weight }; } return { ...previous, WeatherForecasts: { ...(previous.WeatherForecasts ?? {}), [String(previewHour)]: entries } }; }); }} className="w-full rounded border border-tn-border bg-tn-bg px-2 py-1 text-[11px] font-mono text-right text-tn-text" />
          </div>
          <p className="text-[10px] text-tn-text-muted">Quick-set the top weather entry for the selected preview hour. Use Hourly Forecasts below for full control.</p>
        </div>
        )}
      </div>
    </CollapsibleEditorSection>
  );
}
