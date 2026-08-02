import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { ChromeIconButton } from "@/components/ui/editorChrome";
import { appPanelClass } from "@/components/ui/surfaceStyles";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  widthClass?: string;
  /** When set, body uses flex row (sidebar + content). */
  layout?: "stack" | "sidebar";
  sidebar?: ReactNode;
  /** The scrolling content element, so callers can reset scroll on navigation. */
  bodyRef?: React.Ref<HTMLDivElement>;
}

export function ModalShell({
  open,
  onClose,
  title,
  children,
  footer,
  widthClass = "w-[920px]",
  layout = "stack",
  sidebar,
  bodyRef,
}: ModalShellProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [open, onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => {
      previouslyFocusedRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`${appPanelClass} shadow-xl ${widthClass} max-h-[85vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-tn-border shrink-0">
          <h2 id={titleId} className="text-sm font-semibold text-tn-text">
            {title}
          </h2>
          <ChromeIconButton
            size="sm"
            label="Close"
            onClick={onClose}
            icon={<X className="h-4 w-4" strokeWidth={2} />}
          />
        </div>

        {layout === "sidebar" && sidebar ? (
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <nav className="w-[208px] shrink-0 border-r border-tn-border overflow-y-auto overscroll-contain py-2">
              {sidebar}
            </nav>
            <div
              ref={bodyRef}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 flex flex-col gap-4"
            >
              {children}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 flex flex-col gap-4">
            {children}
          </div>
        )}

        {footer ? (
          <div className="flex justify-end px-5 py-3 border-t border-tn-border shrink-0">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
