import {
  isPathInProject,
  sampleWeatherSkyGradient,
  type JsonRecord,
  type WeatherForecastEntry,
} from "@/utils/atmosphere";

function hashColor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(index);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 55% 48%)`;
}

export function getForecastResolution(
  weatherId: string,
  weatherPath: string | undefined,
  projectPath: string | null,
): {
  status: "in-pack" | "built-in" | "missing";
  label: string;
  detail: string;
} {
  if (!weatherPath) {
    return {
      status: "missing",
      label: "Missing",
      detail: weatherId
        ? "No matching weather file is resolved yet. Locate an existing file or create a placeholder."
        : "Enter a weather ID, then locate or create the file.",
    };
  }

  const fileName = weatherPath.split(/[/\\]/).pop() ?? weatherId;
  if (isPathInProject(weatherPath, projectPath)) {
    return {
      status: "in-pack",
      label: "In Pack",
      detail: `Resolved to ${fileName} in this pack.`,
    };
  }

  return {
    status: "built-in",
    label: "Built-In",
    detail: `Resolved to cached Hytale asset ${fileName}. Import it into Server/Weathers to include it in the pack.`,
  };
}

export function forecastResolutionBadgeClass(status: "in-pack" | "built-in" | "missing"): string {
  switch (status) {
    case "in-pack":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "built-in":
      return "border-sky-500/30 bg-sky-500/10 text-sky-300";
    default:
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }
}

export interface ForecastEntryEditorCardProps {
  entry: WeatherForecastEntry;
  index: number;
  hour: number;
  projectPath: string | null;
  weatherPath: string | undefined;
  weatherDoc?: JsonRecord | null;
  onWeatherIdChange: (weatherId: string) => void;
  onWeightChange: (weight: number) => void;
  onOpen: () => void;
  onImport?: () => void;
  onLocate?: () => void;
  onRemove?: () => void;
}

export function ForecastEntryEditorCard({
  entry,
  index,
  hour,
  projectPath,
  weatherPath,
  weatherDoc,
  onWeatherIdChange,
  onWeightChange,
  onOpen,
  onImport,
  onLocate,
  onRemove,
}: ForecastEntryEditorCardProps) {
  const resolution = getForecastResolution(entry.WeatherId, weatherPath, projectPath);
  const skyGradient = weatherDoc ? sampleWeatherSkyGradient(weatherDoc, hour) : null;
  const swatchStyle = skyGradient
    ? { background: `linear-gradient(to bottom, ${skyGradient.top}, ${skyGradient.bottom})` }
    : { backgroundColor: hashColor(entry.WeatherId || `hour-${hour}-${index}`) };

  return (
    <div className="rounded border border-tn-border/40 bg-tn-surface/70 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={swatchStyle}
          />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tn-text-muted">
            Entry {index + 1}
          </p>
          <span className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider ${forecastResolutionBadgeClass(resolution.status)}`}>
            {resolution.label}
          </span>
        </div>
        {onRemove && (
          <button
            type="button"
            title="Remove this forecast entry"
            onClick={onRemove}
            className="shrink-0 rounded border border-tn-border/40 px-2 py-1 text-[10px] text-tn-text-muted/60 transition-colors hover:border-red-500/50 hover:text-red-400"
          >
            Remove
          </button>
        )}
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_110px]">
        <label className="flex min-w-0 flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-tn-text-muted">
          Weather ID
          <input
            type="text"
            list="environment-weather-options"
            value={entry.WeatherId}
            onChange={(event) => onWeatherIdChange(event.target.value)}
            className="min-w-0 rounded border border-tn-border/60 bg-tn-bg px-2 py-1.5 text-[11px] normal-case tracking-normal text-tn-text"
            placeholder="Zone1_Sunny"
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-tn-text-muted">
          Weight
          <input
            type="number"
            step={1}
            min={0}
            value={entry.Weight}
            onChange={(event) => {
              const weight = Number.parseFloat(event.target.value);
              if (!Number.isFinite(weight)) return;
              onWeightChange(weight);
            }}
            className="rounded border border-tn-border/60 bg-tn-bg px-2 py-1.5 text-[11px] font-mono text-right text-tn-text"
          />
        </label>
      </div>

      <p className="mt-2 break-all text-[10px] text-tn-text-muted">{resolution.detail}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onOpen}
          disabled={!weatherPath}
          title={weatherPath ? `Open ${entry.WeatherId}` : "File not found"}
          className={`rounded border px-2.5 py-1 text-[10px] font-medium transition-colors ${
            weatherPath
              ? "border-tn-border/60 text-tn-text-muted hover:border-tn-accent hover:text-tn-accent"
              : "cursor-not-allowed border-tn-border/30 text-tn-text-muted/40"
          }`}
        >
          Open
        </button>
        {onImport && (
          <button
            type="button"
            onClick={onImport}
            className="rounded border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-[10px] font-medium text-sky-300 transition-colors hover:border-sky-400/60 hover:bg-sky-500/20"
          >
            Import
          </button>
        )}
        {onLocate && (
          <button
            type="button"
            onClick={onLocate}
            className="rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium text-amber-300 transition-colors hover:border-amber-400/60 hover:bg-amber-500/20"
          >
            Locate...
          </button>
        )}
      </div>
    </div>
  );
}
