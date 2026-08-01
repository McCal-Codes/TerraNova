import { useMemo } from "react";
import { SettingRow } from "./SettingRow";
import { focusRing } from "@/components/ui/settingsPrimitives";
import {
  getByCategory,
  getSections,
  isAvailable,
  isModified,
  resetCategory,
  type CategoryId,
  type SettingDeepLink,
} from "@/settings/registry";
import { useModifiedCount } from "@/settings/useSetting";

/** Human labels for section slugs. Unlisted slugs fall back to sentence case. */
const SECTION_LABELS: Record<string, string> = {
  graph: "Graph",
  editing: "Editing",
  saving: "Saving",
  export: "Export",
  backups: "Backups",
  source: "Asset source",
  overlay: "Common assets",
  sync: "Synchronisation",
  mode: "Developer mode",
  tools: "Tools",
  diagnostics: "Diagnostics",
  checking: "Update checks",
  keybindings: "Key bindings",
};

function sectionLabel(slug: string): string {
  return SECTION_LABELS[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1);
}

export interface CategoryPanelProps {
  category: CategoryId;
  developerMode: boolean;
  onNavigate?: (target: SettingDeepLink) => void;
  /** Rendered below the settings — operations, status, and other non-settings UI. */
  children?: React.ReactNode;
}

/**
 * Renders a whole category from the registry: sections in registration order,
 * each section a card of rows. Categories gain settings by gaining definitions,
 * never by editing this file.
 */
export function CategoryPanel({ category, developerMode, onNavigate, children }: CategoryPanelProps) {
  const defs = useMemo(
    () => getByCategory(category).filter((d) => isAvailable(d, developerMode)),
    [category, developerMode],
  );
  const sections = useMemo(
    () => getSections(category).filter((slug) => defs.some((d) => d.section === slug)),
    [category, defs],
  );
  const modifiedCount = useModifiedCount(defs);

  return (
    <div className="flex flex-col gap-5">
      {modifiedCount > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded border border-tn-border/60 bg-tn-surface/40 px-3 py-2">
          <span className="text-xs text-tn-text-muted">
            {modifiedCount} {modifiedCount === 1 ? "setting differs" : "settings differ"} from the default.
          </span>
          <button
            type="button"
            onClick={() => resetCategory(category, developerMode)}
            className={`min-h-8 rounded border border-tn-border bg-tn-bg px-3 text-xs hover:bg-tn-surface ${focusRing}`}
          >
            Reset section
          </button>
        </div>
      ) : null}

      {sections.map((slug) => {
        const rows = defs.filter((d) => d.section === slug);
        const headingId = `settings-${category}-${slug}`;
        return (
          <section key={slug} aria-labelledby={headingId} className="flex flex-col gap-1">
            <h3 id={headingId} className="text-sm font-medium text-tn-text">
              {sectionLabel(slug)}
            </h3>
            <div className="rounded border border-tn-border/60 bg-tn-surface/20 px-3">
              {rows.map((def) => (
                <SettingRow key={def.id} def={def} onNavigate={onNavigate} />
              ))}
            </div>
          </section>
        );
      })}

      {children}
    </div>
  );
}

/** Count of modified settings in a category, for the rail badge. */
export function useCategoryModifiedCount(category: CategoryId, developerMode: boolean): number {
  const defs = useMemo(
    () => getByCategory(category).filter((d) => isAvailable(d, developerMode)),
    [category, developerMode],
  );
  return useModifiedCount(defs);
}

export { isModified };
