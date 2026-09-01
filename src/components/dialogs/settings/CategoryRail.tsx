import { useRef } from "react";
import { focusRing } from "@/components/ui/settingsPrimitives";
import { CATEGORY_META, type CategoryId } from "@/settings/registry";

export interface CategoryRailProps {
  active: CategoryId;
  onSelect: (id: CategoryId) => void;
  developerMode: boolean;
  /** Per-category count of settings differing from their default. */
  modifiedCounts?: Partial<Record<CategoryId, number>>;
}

/**
 * Settings category rail.
 *
 * Implements the WAI-ARIA tabs pattern properly, which the previous inline
 * version did not:
 *  - roving tabindex, so the rail is a single Tab stop rather than ten;
 *  - manual activation — arrows move focus, Enter/Space selects. The panels
 *    behind these categories mount hardware detection and asset staleness
 *    checks, so arrowing past a category must not fire that work.
 */
export function CategoryRail({ active, onSelect, developerMode, modifiedCounts }: CategoryRailProps) {
  const railRef = useRef<HTMLDivElement>(null);

  const categories = CATEGORY_META.filter((c) => developerMode || !c.devOnly);

  function focusAt(index: number) {
    const wrapped = (index + categories.length) % categories.length;
    const id = categories[wrapped]!.id;
    railRef.current?.querySelector<HTMLElement>(`#settings-tab-${id}`)?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight":
        e.preventDefault();
        focusAt(index + 1);
        break;
      case "ArrowUp":
      case "ArrowLeft":
        e.preventDefault();
        focusAt(index - 1);
        break;
      case "Home":
        e.preventDefault();
        focusAt(0);
        break;
      case "End":
        e.preventDefault();
        focusAt(categories.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        onSelect(categories[index]!.id);
        break;
    }
  }

  return (
    <div
      ref={railRef}
      role="tablist"
      aria-label="Settings categories"
      aria-orientation="vertical"
      className="flex flex-col gap-0.5 px-2"
    >
      {categories.map(({ id, label }, index) => {
        const selected = active === id;
        const modified = modifiedCounts?.[id] ?? 0;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            id={`settings-tab-${id}`}
            aria-selected={selected}
            aria-controls={`settings-panel-${id}`}
            // Roving tabindex: exactly one rail item is reachable by Tab.
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-[13px] font-medium transition-colors ${focusRing} ${
              selected
                ? "bg-tn-accent/12 text-tn-accent"
                : "text-tn-text-muted hover:bg-tn-surface hover:text-tn-text"
            }`}
          >
            <span className="truncate">{label}</span>
            {modified > 0 ? (
              <span
                className="shrink-0 rounded-full border border-tn-accent/40 px-1.5 text-[10px] font-medium text-tn-accent"
                aria-label={`${modified} modified`}
              >
                {modified}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
