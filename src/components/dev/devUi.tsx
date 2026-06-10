import type { ReactNode } from "react";
import { Copy, RefreshCw, X } from "lucide-react";

export function DevPanelHeader({
  title,
  children,
  onCollapse,
  collapseTitle = "Collapse",
}: {
  title: string;
  children?: ReactNode;
  onCollapse?: () => void;
  collapseTitle?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-tn-border bg-tn-panel/70 shrink-0">
      <span className="text-[11px] font-medium text-tn-text">{title}</span>
      {children}
      {onCollapse && (
        <button
          type="button"
          onClick={onCollapse}
          className="ml-auto p-1 rounded text-tn-text-muted hover:text-tn-text hover:bg-tn-surface transition-colors"
          title={collapseTitle}
          aria-label={collapseTitle}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export function DevTabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-md border border-tn-border bg-tn-bg/50 p-0.5" role="tablist">
      {tabs.map(({ id, label }) => {
        const selected = active === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(id)}
            className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
              selected
                ? "bg-tn-accent/20 text-tn-text font-medium"
                : "text-tn-text-muted hover:text-tn-text hover:bg-tn-surface/80"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function DevToolbar({
  children,
  trailing,
}: {
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 shrink-0 px-3 py-2 border-b border-tn-border/60 bg-tn-bg/30">
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {trailing && <div className="ml-auto flex items-center gap-1.5">{trailing}</div>}
    </div>
  );
}

export function DevIconButton({
  label,
  onClick,
  icon,
  title,
}: {
  label: string;
  onClick: () => void;
  icon?: "copy" | "refresh";
  title?: string;
}) {
  const Icon = icon === "copy" ? Copy : icon === "refresh" ? RefreshCw : null;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-tn-border text-[11px] text-tn-text-muted hover:text-tn-text hover:bg-tn-surface transition-colors"
    >
      {Icon && <Icon className="w-3 h-3 shrink-0" aria-hidden />}
      {label}
    </button>
  );
}

export function DevCheckbox({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="inline-flex items-start gap-2 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 shrink-0 accent-tn-accent"
      />
      <span className="flex flex-col">
        <span className={`text-[11px] ${checked ? "text-tn-text" : "text-tn-text-muted group-hover:text-tn-text"}`}>
          {label}
        </span>
        {description && (
          <span className="text-[10px] text-tn-text-muted/80 leading-tight">{description}</span>
        )}
      </span>
    </label>
  );
}

export function DevSegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-tn-border overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1 text-[11px] transition-colors ${
            value === opt.value
              ? "bg-tn-accent/20 text-tn-text"
              : "text-tn-text-muted hover:bg-tn-surface"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function DevCodeBlock({ children, empty }: { children: string; empty?: string }) {
  if (!children || children === "—") {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center p-4 text-[11px] text-tn-text-muted">
        {empty ?? "Nothing to show"}
      </div>
    );
  }
  return (
    <pre className="flex-1 min-h-0 overflow-auto p-3 text-[10px] font-mono text-tn-text-muted leading-relaxed whitespace-pre-wrap">
      {children}
    </pre>
  );
}

export function DevStatusChip({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "neutral";
  children: ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-500/12 text-emerald-300 border-emerald-500/25"
      : tone === "warn"
        ? "bg-amber-500/12 text-amber-300 border-amber-500/25"
        : "bg-tn-surface text-tn-text-muted border-tn-border";
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] ${cls}`}>
      {children}
    </span>
  );
}

export function DevSettingRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 py-2 cursor-pointer group border-b border-tn-border/40 last:border-0">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 shrink-0 accent-tn-accent"
      />
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className={`text-sm ${checked ? "text-tn-text" : "text-tn-text-muted group-hover:text-tn-text"}`}>
          {label}
        </span>
        {description && (
          <span className="text-xs text-tn-text-muted leading-snug">{description}</span>
        )}
      </span>
    </label>
  );
}
