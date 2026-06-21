import type { ReactNode } from "react";
import type { PreviewMode } from "@/stores/previewStore";
import type { ShapePreviewHint } from "@/utils/shapePreview/shapePreviewHints";
import {
  previewHudButtonClass,
  previewHudChipActiveClass,
  previewHudChipClass,
  previewHudSelectClass,
  previewModeToggleTrackClass,
} from "@/components/preview/previewChromeStyles";
import { previewCalloutClasses } from "@/components/ui/surfaceStyles";

export const previewChipClass = previewHudChipClass;

export const previewChipActiveClass = previewHudChipActiveClass;

export const previewCheckboxLabelClass =
  "flex items-center gap-2 min-h-[28px] text-[11px] text-tn-text-muted cursor-pointer rounded px-1 -mx-1 hover:bg-tn-surface";

export const previewSelectClass = previewHudSelectClass;

export const previewButtonClass = previewHudButtonClass;

export function previewChip(active: boolean): string {
  return active ? previewChipActiveClass : previewChipClass;
}

interface PreviewSidebarSectionProps {
  title: string;
  headingId: string;
  children: ReactNode;
  className?: string;
}

export function PreviewSidebarSection({
  title,
  headingId,
  children,
  className = "",
}: PreviewSidebarSectionProps) {
  return (
    <section
      className={`flex flex-col gap-2 border-t border-tn-border/80 pt-2.5 ${className}`}
      aria-labelledby={headingId}
    >
      <h3 id={headingId} className="text-[11px] font-medium uppercase tracking-wide text-tn-text-muted/90">
        {title}
      </h3>
      {children}
    </section>
  );
}

interface PreviewFieldProps {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}

export function PreviewField({ label, htmlFor, children }: PreviewFieldProps) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label htmlFor={htmlFor} className="text-[10px] text-tn-text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

interface PreviewCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}

export function PreviewCheckbox({ checked, onChange, label, description }: PreviewCheckboxProps) {
  return (
    <label className={previewCheckboxLabelClass}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-tn-accent h-3.5 w-3.5 shrink-0"
      />
      <span className="flex flex-col min-w-0">
        <span className="text-tn-text">{label}</span>
        {description ? (
          <span className="text-[10px] text-tn-text-muted leading-snug">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

type CalloutTone = "info" | "warning" | "error";

const calloutToneClass = previewCalloutClasses;

interface PreviewCalloutProps {
  tone: CalloutTone;
  children: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export function PreviewCallout({ tone, children, actionLabel, onAction }: PreviewCalloutProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-md border px-2.5 py-2 space-y-1.5 ${calloutToneClass[tone]}`}
    >
      <p className="text-[10px] leading-relaxed">{children}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="w-full rounded border border-tn-accent/50 bg-tn-accent/15 px-2 py-1 text-[10px] font-medium text-tn-accent hover:bg-tn-accent/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function PreviewHintList({ hints }: { hints: ShapePreviewHint[] }) {
  if (hints.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 list-none p-0 m-0" aria-live="polite">
      {hints.map((hint, i) => (
        <li
          key={i}
          className={`text-[10px] leading-relaxed rounded px-2 py-1 ${
            hint.tone === "warning"
              ? "bg-amber-950 text-amber-100 border border-amber-500/30"
              : "text-tn-text-muted bg-tn-bg border border-tn-border"
          }`}
        >
          {hint.message}
        </li>
      ))}
    </ul>
  );
}

interface PreviewModeToggleGroupProps {
  mode: PreviewMode;
  onModeChange: (mode: PreviewMode) => void;
  bridgeConnected: boolean;
  loading?: boolean;
}

const PREVIEW_MODES: { id: PreviewMode; label: string; title?: string }[] = [
  { id: "2d", label: "2D" },
  { id: "3d", label: "3D" },
  { id: "voxel", label: "Voxel" },
  {
    id: "world",
    label: "World",
    title: "Server world preview (requires Bridge)",
  },
  {
    id: "prefab",
    label: "Prefab",
    title: "Load and preview a .prefab.json file 1:1",
  },
];

export function PreviewModeToggleGroup({
  mode,
  onModeChange,
  bridgeConnected,
  loading,
}: PreviewModeToggleGroupProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Preview mode">
      <div className={previewModeToggleTrackClass} role="group" aria-label="Preview mode">
        {PREVIEW_MODES.map((m) => {
          const disabled = m.id === "world" && !bridgeConnected;
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              title={
                disabled
                  ? "Connect to Bridge first"
                  : m.title ?? `${m.label} preview`
              }
              onClick={() => onModeChange(m.id)}
              className={`px-2.5 py-1 text-[11px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent ${
                active
                  ? "rounded bg-tn-accent/25 font-medium text-tn-text"
                  : "text-tn-text-muted hover:bg-tn-panel hover:text-tn-text disabled:opacity-40"
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>
      {loading ? (
        <span
          className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-tn-accent border-t-transparent"
          role="status"
          aria-label="Evaluating preview"
        />
      ) : null}
    </div>
  );
}

export function PreviewLegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-tn-text-muted">
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-sm border border-white/10"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {label}
    </span>
  );
}
