/**
 * Dark glass backing for preview toolbar + HUD overlays on top of map/3D content.
 * Keeps labels readable without heavy opaque panels.
 */

const glassBorder = "border-black/40";
const glassBg = "bg-black/55";
const glassBlur = "backdrop-blur-md";

/** Top preview toolbar (mode toggles, settings). */
export const previewChromeBarClass =
  `flex shrink-0 items-center gap-2 border-b ${glassBorder} ${glassBg} ${glassBlur} px-2 shadow-[inset_0_-1px_0_rgba(255,255,255,0.05)]`;

/** Floating panel (timing overlay, evaluating badge, legends). */
export const previewHudPanelClass =
  `rounded-md border ${glassBorder} ${glassBg} ${glassBlur} text-tn-text shadow-lg`;

export const previewHudPanelHeaderClass =
  `flex items-center justify-between gap-2 border-b border-black/35 bg-black/35 px-2 py-1`;

/** Compact readout badge (zoom, hover coords). */
export const previewHudBadgeClass =
  `rounded border border-black/35 bg-black/55 px-1.5 py-0.5 font-mono text-tn-text-muted shadow-sm backdrop-blur-sm`;

/** Settings drawer over the preview pane. */
export const previewSettingsDrawerClass =
  `relative flex h-full w-72 max-w-[85vw] flex-col border-l border-black/45 bg-black/72 shadow-2xl backdrop-blur-md pointer-events-auto`;

/** Inline chips / small toolbar buttons on the preview bar. */
export const previewHudChipBase =
  `px-2 py-1 text-[10px] rounded border backdrop-blur-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent`;

export const previewHudChipClass =
  `${previewHudChipBase} border-black/35 bg-black/45 text-tn-text-muted hover:text-tn-text hover:bg-black/60 hover:border-white/15`;

export const previewHudChipActiveClass =
  `${previewHudChipBase} border-tn-accent/50 bg-black/65 font-medium text-tn-accent`;

export const previewHudButtonClass =
  "px-2 py-1 text-[11px] rounded border border-black/35 bg-black/45 text-tn-text-muted backdrop-blur-sm hover:text-tn-text hover:bg-black/60 hover:border-white/15 disabled:opacity-40 disabled:pointer-events-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent";

export const previewHudSelectClass =
  "w-full rounded border border-black/35 bg-black/50 px-2 py-1.5 text-[11px] text-tn-text backdrop-blur-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent";

export const previewModeToggleTrackClass =
  `inline-flex overflow-hidden rounded-md border border-black/40 bg-black/45 p-0.5 backdrop-blur-sm`;
