interface AtmosphereSimpleImportBannerProps {
  builtInWeatherCount: number;
  missingWeatherCount: number;
  onImportBuiltIn: () => void;
  onSwitchToAdvanced?: () => void;
}

export function AtmosphereSimpleImportBanner({
  builtInWeatherCount,
  missingWeatherCount,
  onImportBuiltIn,
  onSwitchToAdvanced,
}: AtmosphereSimpleImportBannerProps) {
  if (builtInWeatherCount === 0 && missingWeatherCount === 0) return null;

  const parts: string[] = [];
  if (builtInWeatherCount > 0) {
    parts.push(`${builtInWeatherCount} built-in weather${builtInWeatherCount === 1 ? "" : "s"} not in your pack`);
  }
  if (missingWeatherCount > 0) {
    parts.push(`${missingWeatherCount} referenced weather file${missingWeatherCount === 1 ? "" : "s"} missing`);
  }

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/35 bg-amber-400/8 px-3 py-2"
      title="Built-in weathers come from synced Hytale assets. Import copies them into Server/Weathers in your pack."
    >
      <p className="text-[11px] text-amber-100/90">
        {parts.join(" · ")}.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        {builtInWeatherCount > 0 && (
          <button
            type="button"
            onClick={onImportBuiltIn}
            className="rounded border border-amber-400/50 bg-amber-400/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-200 transition-colors hover:bg-amber-400/25"
          >
            Import built-in
          </button>
        )}
        {onSwitchToAdvanced && (
          <button
            type="button"
            onClick={onSwitchToAdvanced}
            className="text-[10px] text-tn-text-muted transition-colors hover:text-tn-text"
          >
            Issue log in Advanced
          </button>
        )}
      </div>
    </div>
  );
}
