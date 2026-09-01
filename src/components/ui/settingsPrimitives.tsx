import { useId, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { appNestedCardClass, appSectionClass } from "@/components/ui/surfaceStyles";

/**
 * Shared focus treatment. A 2px outline with an offset, meeting WCAG 2.2
 * SC 2.4.11 (focus not obscured) and matching the rest of the app chrome.
 */
export const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent";

/** Desktop control height. 32px comfortably clears SC 2.5.8's 24px minimum. */
const controlHeight = "min-h-8";

export function SettingsSection({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h3 className="text-xs font-medium text-tn-text-muted uppercase tracking-wider">{label}</h3>
        {description ? (
          <p className="mt-0.5 text-[11px] text-tn-text-muted leading-relaxed">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function SettingsOptionCard({
  selected,
  onClick,
  title,
  description,
  badge,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description?: string;
  badge?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`text-left px-3 py-2 rounded border text-sm w-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent disabled:opacity-40 disabled:cursor-not-allowed ${
        selected
          ? "border-tn-accent bg-tn-accent/10"
          : "border-tn-border bg-tn-bg hover:bg-tn-surface"
      }`}
    >
      <span className="font-medium">{title}</span>
      {badge ? (
        <span className="ml-2 text-[10px] font-medium text-tn-text-muted">{badge}</span>
      ) : null}
      {description ? (
        <p className="text-xs text-tn-text-muted mt-0.5">{description}</p>
      ) : null}
    </button>
  );
}

export function SettingsToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-start gap-3 py-2 cursor-pointer group border-b border-tn-border/40 last:border-0"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-tn-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent"
      />
      <span className="min-w-0 flex-1">
        <span className="text-sm font-medium text-tn-text group-hover:text-tn-text">{label}</span>
        {description ? (
          <span className="block text-xs text-tn-text-muted mt-0.5 leading-relaxed">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

export function SettingsPathRow({
  id,
  label,
  hint,
  value,
  placeholder,
  onBrowse,
  onClear,
  clearDisabled,
  browseLabel = "Browse…",
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  placeholder?: string;
  onBrowse: () => void;
  onClear?: () => void;
  clearDisabled?: boolean;
  browseLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[11px] text-tn-text-muted">
        {label}
      </label>
      {hint ? <p className="text-[11px] text-tn-text-muted leading-relaxed">{hint}</p> : null}
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="text"
          readOnly
          value={value}
          placeholder={placeholder}
          className={`flex-1 px-3 py-1.5 ${appNestedCardClass} text-sm text-tn-text-muted truncate font-mono text-[11px]`}
        />
        <button
          type="button"
          onClick={onBrowse}
          className="px-3 py-1.5 text-sm rounded border border-tn-border bg-tn-bg hover:bg-tn-surface whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent"
        >
          {browseLabel}
        </button>
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            disabled={clearDisabled}
            className="px-3 py-1.5 text-sm rounded border border-tn-border bg-tn-bg hover:bg-tn-surface text-tn-text-muted disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ── Registry-driven rows ──────────────────────────────────────────────────────

export interface SettingRowShellProps {
  label: string;
  description?: string;
  /** Rendered on the trailing edge for compact controls, below for wide ones. */
  control: ReactNode;
  /** Full-width controls (radio groups, path pickers) stack under the label. */
  stacked?: boolean;
  modified?: boolean;
  onReset?: () => void;
  error?: string | null;
  badges?: ReactNode;
  /** Id applied to the control, so the row's label and description can bind. */
  controlId: string;
  descriptionId?: string;
  errorId?: string;
  /**
   * Whether the row label should be a `<label for>`. Only true for genuine form
   * controls — a label pointing at a button or a radiogroup would *override*
   * that control's own accessible name ("Open" would be announced as the
   * setting's label), so those rows render the label as plain text and let the
   * control name itself.
   */
  associateLabel?: boolean;
}

/**
 * The standard settings row: label, optional description, a control, and the
 * modified/reset affordance.
 *
 * Modified state is announced three ways — a "Modified" badge (text), the reset
 * button appearing, and an accent bar — so it never depends on color alone
 * (WCAG 2.2 SC 1.4.1).
 */
export function SettingRowShell({
  label,
  description,
  control,
  stacked,
  modified,
  onReset,
  error,
  badges,
  controlId,
  descriptionId,
  errorId,
  associateLabel = true,
}: SettingRowShellProps) {
  const LabelTag = associateLabel ? "label" : "span";
  return (
    <div
      className={`relative flex gap-3 py-2.5 border-b border-tn-border/40 last:border-0 ${
        stacked ? "flex-col" : "flex-row items-start justify-between"
      }`}
    >
      {modified ? (
        <span
          aria-hidden
          className="absolute -left-3 top-3 bottom-3 w-0.5 rounded-full bg-tn-accent"
        />
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <LabelTag
            htmlFor={associateLabel ? controlId : undefined}
            className="text-sm font-medium text-tn-text"
          >
            {label}
          </LabelTag>
          {modified ? (
            <span className="rounded border border-tn-accent/40 px-1 py-px text-[10px] font-medium text-tn-accent">
              Modified
            </span>
          ) : null}
          {badges}
        </div>
        {description ? (
          <p id={descriptionId} className="mt-0.5 text-xs leading-relaxed text-tn-text-muted">
            {description}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} role="alert" className="mt-1 text-xs leading-relaxed text-red-400">
            {error}
          </p>
        ) : null}
      </div>

      <div className={`flex shrink-0 items-center gap-2 ${stacked ? "w-full" : ""}`}>
        <div className={stacked ? "w-full" : ""}>{control}</div>
        {modified && onReset ? (
          <button
            type="button"
            onClick={onReset}
            title={`Reset ${label} to default`}
            aria-label={`Reset ${label} to default`}
            className={`grid h-8 w-8 shrink-0 place-items-center rounded border border-tn-border text-tn-text-muted hover:bg-tn-surface hover:text-tn-text ${focusRing}`}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Toggle switch. Uses `role="switch"` on a button rather than a checkbox so the
 * on/off state is announced as such, and so the hit area is a full 32px.
 */
export function SettingsSwitch({
  id,
  checked,
  onChange,
  disabled,
  describedBy,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  describedBy?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${focusRing} ${
        checked ? "border-tn-accent bg-tn-accent/70" : "border-tn-border bg-tn-bg"
      }`}
    >
      <span
        aria-hidden
        className="absolute top-0.5 left-0 h-[18px] w-[18px] rounded-full bg-tn-text transition-transform"
        style={{ transform: `translateX(${checked ? 22 : 2}px)` }}
      />
      {/* Text alternative so the state is legible without relying on position. */}
      <span className="sr-only">{checked ? "On" : "Off"}</span>
    </button>
  );
}

export function SettingsSelect<T extends string | number>({
  id,
  value,
  options,
  onChange,
  disabled,
  describedBy,
}: {
  id: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  disabled?: boolean;
  describedBy?: string;
}) {
  const isNumeric = typeof value === "number";
  return (
    <select
      id={id}
      value={String(value)}
      disabled={disabled}
      aria-describedby={describedBy}
      onChange={(e) => onChange((isNumeric ? Number(e.target.value) : e.target.value) as T)}
      className={`${controlHeight} rounded border border-tn-border bg-tn-bg px-2 text-sm text-tn-text disabled:opacity-40 ${focusRing}`}
    >
      {options.map((opt) => (
        <option key={String(opt.value)} value={String(opt.value)}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function SettingsNumberInput({
  id,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  invalid,
  disabled,
  describedBy,
}: {
  id: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  invalid?: boolean;
  disabled?: boolean;
  describedBy?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        id={id}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
        className={`${controlHeight} w-24 rounded border bg-tn-bg px-2 text-sm text-tn-text disabled:opacity-40 ${focusRing} ${
          invalid ? "border-red-400" : "border-tn-border"
        }`}
      />
      {unit ? <span className="text-xs text-tn-text-muted">{unit}</span> : null}
    </div>
  );
}

/**
 * Radio group. Real inputs inside a `role="radiogroup"` so arrow-key navigation
 * and screen-reader group semantics come from the platform rather than JS.
 */
export function SettingsRadioGroup<T extends string>({
  id,
  value,
  options,
  onChange,
  groupLabel,
  describedBy,
}: {
  id: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string; description?: string; badge?: string }>;
  onChange: (value: T) => void;
  groupLabel: string;
  describedBy?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={groupLabel}
      aria-describedby={describedBy}
      className="flex w-full flex-col gap-1.5"
    >
      {options.map((opt) => {
        const optionId = `${id}-${String(opt.value)}`;
        const selected = value === opt.value;
        return (
          <label
            key={String(opt.value)}
            htmlFor={optionId}
            className={`flex cursor-pointer items-start gap-2.5 rounded border px-3 py-2 transition-colors ${
              selected ? "border-tn-accent bg-tn-accent/10" : "border-tn-border bg-tn-bg hover:bg-tn-surface"
            } focus-within:outline focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-tn-accent`}
          >
            <input
              id={optionId}
              type="radio"
              name={id}
              value={String(opt.value)}
              checked={selected}
              onChange={() => onChange(opt.value)}
              className="mt-0.5 accent-tn-accent"
            />
            <span className="min-w-0">
              <span className="text-sm font-medium text-tn-text">{opt.label}</span>
              {opt.badge ? (
                <span className="ml-2 text-[10px] font-medium text-tn-text-muted">{opt.badge}</span>
              ) : null}
              {opt.description ? (
                <span className="mt-0.5 block text-xs text-tn-text-muted">{opt.description}</span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** Generates the trio of ids a row needs, keeping label/description/error bound. */
export function useRowIds(settingId: string) {
  const uid = useId();
  const base = `setting-${settingId.replace(/[^a-zA-Z0-9]/g, "-")}-${uid}`;
  return {
    controlId: base,
    descriptionId: `${base}-desc`,
    errorId: `${base}-error`,
  };
}

export function SettingsCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${appSectionClass} p-3 ${className}`}>{children}</div>;
}

export function SettingsNestedCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${appNestedCardClass} p-3 ${className}`}>{children}</div>;
}
