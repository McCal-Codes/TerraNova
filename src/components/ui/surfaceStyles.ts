import type { ToastType } from "@/stores/toastStore";

/** Opaque modal / card shell on app chrome. */
export const appPanelClass = "bg-tn-panel border border-tn-border rounded-lg";

/** Nested field group or read-only path row inside a panel. */
export const appNestedCardClass = "bg-tn-bg border border-tn-border/60 rounded-md";

/** Collapsible section or grouped settings block. */
export const appSectionClass = "bg-tn-surface border border-tn-border rounded-lg";

/** Preview toolbar docked over map/3D — opaque tn-panel (no glass blur). */
export const previewHudBarClass =
  "flex shrink-0 items-center gap-2 border-b border-tn-border bg-tn-panel px-2 shadow-sm";

/** Floating HUD panel (timing overlay, legends). */
export const previewHudPanelClass =
  "rounded-md border border-tn-border bg-tn-panel text-tn-text shadow-lg";

export const previewHudPanelHeaderClass =
  "flex items-center justify-between gap-2 border-b border-tn-border bg-tn-surface px-2 py-1";

export const previewHudBadgeClass =
  "rounded border border-tn-border bg-tn-surface px-1.5 py-0.5 font-mono text-tn-text-muted shadow-sm";

export const previewSettingsDrawerClass =
  "relative flex h-full w-72 max-w-[85vw] flex-col border-l border-tn-border bg-tn-panel shadow-2xl pointer-events-auto overscroll-contain";

/**
 * Vertical rhythm for the preview HUD.
 *
 * One step of separation between labelled groups, and a smaller one inside a
 * group — the grouping is what makes a long control stack readable, so the two
 * gaps have to stay clearly different. Rows carry their own 32px minimum height
 * (matching the settings dialog) rather than getting it from the gap.
 */
export const hudStackGap = "gap-4";
export const hudGroupGap = "gap-1.5";
export const hudRowMinHeight = "min-h-8";
export const hudRowPad = "px-1 -mx-1";

export const previewHudChipBase =
  "px-2 py-1 text-[10px] rounded border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent";

export const previewHudChipClass =
  `${previewHudChipBase} border-tn-border bg-tn-surface text-tn-text-muted hover:text-tn-text hover:bg-tn-panel hover:border-tn-border`;

export const previewHudChipActiveClass =
  `${previewHudChipBase} border-tn-accent/50 bg-tn-panel font-medium text-tn-accent`;

export const previewHudButtonClass =
  "px-2 py-1 text-[11px] rounded border border-tn-border bg-tn-surface text-tn-text-muted hover:text-tn-text hover:bg-tn-panel hover:border-tn-border disabled:opacity-40 disabled:pointer-events-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent";

export const previewHudSelectClass =
  "w-full rounded border border-tn-border bg-tn-bg px-2 py-1.5 text-[11px] text-tn-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent";

export const previewModeToggleTrackClass =
  "inline-flex overflow-hidden rounded-md border border-tn-border bg-tn-surface p-0.5";

export type PreviewCalloutTone = "info" | "warning" | "error";

export const previewCalloutClasses: Record<PreviewCalloutTone, string> = {
  info: "border-tn-border bg-tn-bg text-tn-text-muted",
  warning: "border-amber-500/40 bg-amber-950 text-amber-100",
  error: "border-red-500/40 bg-red-950 text-red-100",
};

export const toastSeverityClasses: Record<
  ToastType,
  { bar: string; icon: string; text: string; border: string; bg: string; progress: string }
> = {
  error: {
    bar: "bg-red-500",
    icon: "text-red-400",
    text: "text-red-100",
    border: "border-red-700/60",
    bg: "bg-tn-surface",
    progress: "bg-red-500/80",
  },
  warning: {
    bar: "bg-amber-400",
    icon: "text-amber-300",
    text: "text-amber-100",
    border: "border-amber-700/60",
    bg: "bg-tn-surface",
    progress: "bg-amber-400/80",
  },
  success: {
    bar: "bg-emerald-500",
    icon: "text-emerald-400",
    text: "text-emerald-100",
    border: "border-emerald-700/60",
    bg: "bg-tn-surface",
    progress: "bg-emerald-500/80",
  },
  info: {
    bar: "bg-sky-500",
    icon: "text-sky-300",
    text: "text-tn-text",
    border: "border-tn-border",
    bg: "bg-tn-surface",
    progress: "bg-sky-500/80",
  },
};
