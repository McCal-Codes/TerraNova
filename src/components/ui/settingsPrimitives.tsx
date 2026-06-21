import type { ReactNode } from "react";
import { appNestedCardClass, appSectionClass } from "@/components/ui/surfaceStyles";

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

export function SettingsCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${appSectionClass} p-3 ${className}`}>{children}</div>;
}

export function SettingsNestedCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${appNestedCardClass} p-3 ${className}`}>{children}</div>;
}
