import { useDeferredValue, useMemo } from "react";
import { Search, X } from "lucide-react";
import { SettingRow } from "./SettingRow";
import { focusRing } from "@/components/ui/settingsPrimitives";
import {
  SEARCH_TOKENS,
  getCategoryLabel,
  searchSettings,
  type SettingDeepLink,
} from "@/settings/registry";

export function SettingsSearchInput({
  value,
  onChange,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <div className="relative flex-1">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-tn-text-muted"
        aria-hidden
      />
      <input
        ref={inputRef}
        type="search"
        role="searchbox"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search settings…"
        aria-label="Search settings"
        aria-describedby="settings-search-hint"
        className={`min-h-8 w-full rounded border border-tn-border bg-tn-bg pl-8 pr-8 text-sm text-tn-text placeholder:text-tn-text-muted ${focusRing}`}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className={`absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-tn-text-muted hover:bg-tn-surface hover:text-tn-text ${focusRing}`}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
      <span id="settings-search-hint" className="sr-only">
        Filter tokens available: {SEARCH_TOKENS.join(", ")}. Combine them with words, for example
        “@modified asset”.
      </span>
    </div>
  );
}

export function SettingsSearchResults({
  query,
  developerMode,
  onNavigate,
}: {
  query: string;
  developerMode: boolean;
  onNavigate?: (target: SettingDeepLink) => void;
}) {
  // Keeps typing responsive without hand-rolling a debounce timer.
  const deferred = useDeferredValue(query);
  const results = useMemo(
    () => searchSettings(deferred, { developerMode }),
    [deferred, developerMode],
  );

  return (
    <div className="flex flex-col gap-2">
      {/* Announced politely so screen-reader users hear the count change. */}
      <p aria-live="polite" className="text-xs text-tn-text-muted">
        {results.length === 0
          ? `No settings match “${deferred}”.`
          : `${results.length} ${results.length === 1 ? "setting" : "settings"} match “${deferred}”.`}
      </p>

      {results.length === 0 ? (
        <p className="text-xs leading-relaxed text-tn-text-muted">
          Try a different term, or use a filter such as{" "}
          <code className="rounded bg-tn-surface px-1">@modified</code> to list only settings you
          have changed.
        </p>
      ) : (
        <div className="rounded border border-tn-border/60 bg-tn-surface/20 px-3">
          {results.map((def) => (
            <SettingRow
              key={def.id}
              def={def}
              onNavigate={onNavigate}
              breadcrumb={`${getCategoryLabel(def.category)} › ${def.section}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
