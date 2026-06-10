import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { chromeIconClass } from "@/components/ui/editorChrome";

interface PreviewControlsSidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  children: ReactNode;
  ariaLabel?: string;
}

/** Collapsible left rail for preview settings — visible chevron when collapsed in split view. */
export function PreviewControlsSidebar({
  collapsed,
  onCollapsedChange,
  children,
  ariaLabel = "Preview settings",
}: PreviewControlsSidebarProps) {
  return (
    <div
      className={`flex shrink-0 flex-col border-r border-tn-border bg-tn-bg transition-[width] duration-150 ${
        collapsed ? "w-8" : "w-64"
      }`}
      aria-label={ariaLabel}
    >
      {collapsed ? (
        <button
          type="button"
          onClick={() => onCollapsedChange(false)}
          className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-1 px-0.5 py-2 text-tn-text-muted transition-colors hover:bg-white/5 hover:text-tn-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent"
          title="Expand preview settings"
          aria-label="Expand preview settings"
        >
          <ChevronRight className={chromeIconClass} strokeWidth={2} aria-hidden />
          <span
            className="text-[9px] font-medium uppercase tracking-wider [writing-mode:vertical-rl] rotate-180"
            aria-hidden
          >
            Settings
          </span>
        </button>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <button
            type="button"
            onClick={() => onCollapsedChange(true)}
            className="flex shrink-0 items-center justify-end px-2 py-1 text-tn-text-muted transition-colors hover:bg-white/5 hover:text-tn-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent"
            title="Collapse preview settings"
            aria-label="Collapse preview settings"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </button>
          {children}
        </div>
      )}
    </div>
  );
}
