import { ChevronRight } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  SettingRowShell,
  SettingsNumberInput,
  SettingsRadioGroup,
  SettingsSelect,
  SettingsSwitch,
  focusRing,
  useRowIds,
} from "@/components/ui/settingsPrimitives";
import { useSetting } from "@/settings/useSetting";
import type { AnySettingDefinition, SettingDeepLink } from "@/settings/registry";

export interface SettingRowProps {
  def: AnySettingDefinition;
  /** Invoked for panel-owned settings, to navigate to their owning surface. */
  onNavigate?: (target: SettingDeepLink) => void;
  /** Shown above the label in search results, e.g. "Editor › Saving". */
  breadcrumb?: string;
}

/**
 * Renders any registry definition as a compact row. Control selection is driven
 * entirely by `def.control.kind`, so adding a setting never means touching a
 * panel — it means adding a definition.
 */
export function SettingRow({ def, onNavigate, breadcrumb }: SettingRowProps) {
  const { value, setValue, modified, reset, error } = useSetting(def);
  const { controlId, descriptionId, errorId } = useRowIds(def.id);

  const describedBy =
    [def.description ? descriptionId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  const badges = (
    <>
      {breadcrumb ? (
        <span className="text-[10px] font-medium uppercase tracking-wide text-tn-text-muted">
          {breadcrumb}
        </span>
      ) : null}
      {def.requiresRestart ? (
        <span className="rounded border border-tn-border px-1 py-px text-[10px] text-tn-text-muted">
          Restart required
        </span>
      ) : null}
      {def.experimental ? (
        <span className="rounded border border-amber-400/40 px-1 py-px text-[10px] text-amber-300">
          Experimental
        </span>
      ) : null}
    </>
  );

  const control = def.control;

  switch (control.kind) {
    case "toggle":
      return (
        <SettingRowShell
          label={def.label}
          description={def.description}
          controlId={controlId}
          descriptionId={descriptionId}
          errorId={errorId}
          modified={modified}
          onReset={reset}
          error={error}
          badges={badges}
          control={
            <SettingsSwitch
              id={controlId}
              checked={Boolean(value)}
              onChange={setValue}
              describedBy={describedBy}
            />
          }
        />
      );

    case "number":
      return (
        <SettingRowShell
          label={def.label}
          description={def.description}
          controlId={controlId}
          descriptionId={descriptionId}
          errorId={errorId}
          modified={modified}
          onReset={reset}
          error={error}
          badges={badges}
          control={
            <SettingsNumberInput
              id={controlId}
              value={Number(value)}
              onChange={setValue}
              min={control.min}
              max={control.max}
              step={control.step}
              unit={control.unit}
              invalid={Boolean(error)}
              describedBy={describedBy}
            />
          }
        />
      );

    case "select":
      return (
        <SettingRowShell
          label={def.label}
          description={def.description}
          controlId={controlId}
          descriptionId={descriptionId}
          errorId={errorId}
          modified={modified}
          onReset={reset}
          error={error}
          badges={badges}
          control={
            <SettingsSelect
              id={controlId}
              value={value}
              options={control.options}
              onChange={setValue}
              describedBy={describedBy}
            />
          }
        />
      );

    case "radio":
      return (
        <SettingRowShell
          stacked
          associateLabel={false}
          label={def.label}
          description={def.description}
          controlId={controlId}
          descriptionId={descriptionId}
          errorId={errorId}
          modified={modified}
          onReset={reset}
          error={error}
          badges={badges}
          control={
            <SettingsRadioGroup
              id={controlId}
              value={value}
              options={control.options}
              onChange={setValue}
              groupLabel={def.label}
              describedBy={describedBy}
            />
          }
        />
      );

    case "path":
      return (
        <SettingRowShell
          stacked
          label={def.label}
          description={def.description}
          controlId={controlId}
          descriptionId={descriptionId}
          errorId={errorId}
          modified={modified}
          onReset={reset}
          error={error}
          badges={badges}
          control={
            <div className="flex w-full items-center gap-2">
              <input
                id={controlId}
                type="text"
                readOnly
                value={typeof value === "string" ? value : ""}
                placeholder={control.placeholder}
                aria-describedby={describedBy}
                className={`min-h-8 flex-1 truncate rounded border border-tn-border bg-tn-bg px-2 font-mono text-[11px] text-tn-text-muted ${focusRing}`}
              />
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    const picked = await openDialog({
                      directory: control.mode === "directory",
                      multiple: false,
                    });
                    if (typeof picked === "string") setValue(picked);
                  })();
                }}
                className={`min-h-8 whitespace-nowrap rounded border border-tn-border bg-tn-bg px-3 text-sm hover:bg-tn-surface ${focusRing}`}
              >
                Browse…
              </button>
            </div>
          }
        />
      );

    case "panel":
      return (
        <SettingRowShell
          associateLabel={false}
          label={def.label}
          description={def.description}
          controlId={controlId}
          descriptionId={descriptionId}
          errorId={errorId}
          modified={modified}
          onReset={reset}
          badges={badges}
          control={
            <button
              id={controlId}
              type="button"
              onClick={() => def.deepLink && onNavigate?.(def.deepLink)}
              disabled={!def.deepLink || !onNavigate}
              // "Open" alone is ambiguous when several rows are on screen.
              aria-label={`Open ${def.label}`}
              aria-describedby={describedBy}
              className={`flex min-h-8 items-center gap-1 rounded border border-tn-border bg-tn-bg px-3 text-sm hover:bg-tn-surface disabled:opacity-40 ${focusRing}`}
            >
              Open
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          }
        />
      );

    case "custom":
      return (
        <SettingRowShell
          stacked
          label={def.label}
          description={def.description}
          controlId={controlId}
          descriptionId={descriptionId}
          errorId={errorId}
          modified={modified}
          onReset={reset}
          error={error}
          badges={badges}
          control={control.render({
            value,
            onChange: setValue,
            controlId,
            describedBy,
            invalid: Boolean(error),
          })}
        />
      );
  }
}
