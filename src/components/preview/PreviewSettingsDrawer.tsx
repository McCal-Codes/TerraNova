import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from "react";
import { X } from "lucide-react";
import { ChromeIconButton } from "@/components/ui/editorChrome";
import { previewSettingsDrawerClass, previewHudPanelHeaderClass } from "@/components/preview/previewChromeStyles";

interface PreviewSettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function PreviewSettingsDrawer({
  open,
  onClose,
  title = "Preview settings",
  children,
  returnFocusRef,
}: PreviewSettingsDrawerProps) {
  const panelRef = useRef<HTMLElement>(null);

  const close = useCallback(() => {
    onClose();
    returnFocusRef?.current?.focus();
  }, [onClose, returnFocusRef]);

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }

      if (e.key !== "Tab" || !panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-30 flex justify-end pointer-events-none">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 pointer-events-auto"
        onClick={close}
        aria-label="Close preview settings"
      />
      <aside
        ref={panelRef}
        className={previewSettingsDrawerClass}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className={`${previewHudPanelHeaderClass} px-3 py-2`}>
          <h2 className="text-[11px] font-medium text-tn-text">{title}</h2>
          <ChromeIconButton
            size="sm"
            label="Close preview settings"
            onClick={close}
            icon={<X className="h-3.5 w-3.5" strokeWidth={2} />}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </aside>
    </div>
  );
}
