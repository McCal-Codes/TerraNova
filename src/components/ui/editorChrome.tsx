import { forwardRef, type ButtonHTMLAttributes, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Consistent Lucide sizing/stroke for editor chrome toolbars. */
export const chromeIconClass = "h-4 w-4 shrink-0";

/** Shared typography tokens for editor panels and chrome. */
export const chromeTypography = {
  panelTitle: "text-[11px] font-medium text-tn-text-muted uppercase tracking-wider",
  panelBody: "text-[11px] text-tn-text-muted",
  panelCaption: "text-[10px] text-tn-text-muted/70",
  toolbarLabel: "text-[11px] font-medium",
} as const;

export function ToolbarDivider() {
  return <div className="mx-1 h-5 w-px shrink-0 bg-tn-border/80" aria-hidden />;
}

type ChromeButtonStateProps = {
  active?: boolean;
  disabled?: boolean;
};

function chromeButtonState({ active = false, disabled = false }: ChromeButtonStateProps): string {
  if (disabled) return "cursor-default text-tn-text-muted/35";
  if (active) return "bg-tn-accent/15 text-tn-accent hover:bg-tn-accent/22";
  return "text-tn-text-muted hover:bg-tn-panel/80 hover:text-tn-text";
}

type ToolbarButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  icon?: ReactNode;
};

export function ToolbarButton({
  active = false,
  icon,
  className = "",
  children,
  title,
  "aria-label": ariaLabel,
  ...props
}: ToolbarButtonProps) {
  const base =
    "inline-flex h-7 min-w-0 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent";
  const resolvedAriaLabel =
    ariaLabel ?? (typeof title === "string" ? title : undefined);

  return (
    <button
      type="button"
      title={title}
      aria-label={resolvedAriaLabel}
      className={`${base} ${chromeButtonState({ active, disabled: props.disabled })} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

type ChromeIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  label: string;
  icon: ReactNode;
  size?: "sm" | "md";
};

/** Square icon-only control for docs headers, layout pickers, etc. */
export const ChromeIconButton = forwardRef<HTMLButtonElement, ChromeIconButtonProps>(
  function ChromeIconButton(
    {
      active = false,
      label,
      icon,
      size = "md",
      className = "",
      ...props
    },
    ref,
  ) {
    const dim = size === "sm" ? "h-6 w-6" : "h-7 w-7";
    return (
      <button
        ref={ref}
        type="button"
        title={label}
        aria-label={label}
        className={`inline-flex ${dim} shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent ${
          active
            ? "border-tn-accent/50 bg-tn-accent/15 text-tn-accent"
            : "border-transparent text-tn-text-muted hover:border-tn-border/60 hover:bg-tn-panel/70 hover:text-tn-text"
        } ${chromeButtonState({ active, disabled: props.disabled })} ${className}`}
        {...props}
      >
        {icon}
      </button>
    );
  },
);

type ViewModeSegment<T extends string> = {
  id: T;
  label: string;
  icon: ReactNode;
};

export function ViewModeSegmentBar<T extends string>({
  modes,
  active,
  onChange,
  ariaLabel,
  solid = false,
}: {
  modes: readonly ViewModeSegment<T>[];
  active: T;
  onChange: (id: T) => void;
  ariaLabel?: string;
  /** Opaque backing for toolbar dock; default glass HUD for floating overlays. */
  solid?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-lg border p-0.5 ${
        solid
          ? "border-tn-border bg-tn-panel shadow-sm"
          : "border-tn-border/80 bg-tn-surface/98 shadow-lg ring-1 ring-black/20 backdrop-blur-md"
      }`}
      role="toolbar"
      aria-label={ariaLabel}
    >
      {modes.map((mode) => {
        const selected = active === mode.id;
        return (
          <ChromeIconButton
            key={mode.id}
            label={mode.label}
            active={selected}
            onClick={() => onChange(mode.id)}
            icon={mode.icon}
            className={selected ? "border-tn-accent/40" : ""}
          />
        );
      })}
    </div>
  );
}

export type SegmentTab<T extends string> = {
  id: T;
  label: string;
  badge?: ReactNode;
};

export function SegmentTabBar<T extends string>({
  tabs,
  active,
  onChange,
  ariaLabel,
}: {
  tabs: readonly SegmentTab<T>[];
  active: T;
  onChange: (id: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="flex shrink-0 border-b border-tn-border" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const selected = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${tab.id}-panel`}
            id={`tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={`relative flex flex-1 items-center justify-center gap-1 px-2 py-2 text-xs font-medium transition-colors ${
              selected
                ? "text-tn-accent after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-tn-accent"
                : "text-tn-text-muted hover:text-tn-text"
            }`}
          >
            <span>{tab.label}</span>
            {tab.badge}
          </button>
        );
      })}
    </div>
  );
}

export function PanelRail({
  collapsed,
  onToggle,
  side = "left",
}: {
  collapsed: boolean;
  onToggle: () => void;
  side?: "left" | "right";
}) {
  const Icon = side === "left" ? ChevronRight : ChevronLeft;
  const title = collapsed ? "Show controls" : "Hide controls";

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title={title}
        aria-label={title}
        className="flex h-full w-full items-center justify-center text-tn-text-muted transition-colors hover:bg-tn-surface/80 hover:text-tn-text"
      >
        <Icon className="h-4 w-4" aria-hidden />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      title={title}
      aria-label={title}
      className="flex w-full shrink-0 items-center justify-end px-2 py-1 text-tn-text-muted transition-colors hover:bg-tn-surface/80 hover:text-tn-text"
    >
      {side === "left" ? (
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      )}
    </button>
  );
}

export function HudPill({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-md border border-tn-border/70 bg-tn-surface/90 px-2.5 py-1 text-[10px] text-tn-text-muted shadow-md backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function StatusBarSep() {
  return <span className="hidden sm:inline text-tn-border/80" aria-hidden>·</span>;
}
