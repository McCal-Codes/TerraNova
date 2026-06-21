import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X, type LucideIcon } from "lucide-react";
import { useToastStore, TOAST_DURATION, type ToastType } from "@/stores/toastStore";
import { toastSeverityClasses } from "@/components/ui/surfaceStyles";

const ICONS: Record<ToastType, LucideIcon> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
};

const ARIA_ROLE: Record<ToastType, "alert" | "status"> = {
  error: "alert",
  warning: "alert",
  success: "status",
  info: "status",
};

const MAX_VISIBLE = 4;

function ToastItem({
  id,
  message,
  type,
  title,
  action,
  onDismiss,
}: {
  id: number;
  message: string;
  type: ToastType;
  title?: string;
  action?: { label: string; onClick: () => void };
  onDismiss: (id: number) => void;
}) {
  const s = toastSeverityClasses[type];
  const Icon = ICONS[type];
  const duration = TOAST_DURATION[type];
  const [progress, setProgress] = useState(100);
  const [exiting, setExiting] = useState(false);
  const startRef = useRef(Date.now());
  const elapsedRef = useRef(0);
  const pausedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    setExiting(true);
    window.setTimeout(() => onDismiss(id), 150);
  }, [id, onDismiss]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      timerRef.current = setTimeout(dismiss, duration);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }

    function tick() {
      if (pausedRef.current) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const now = Date.now();
      const elapsed = elapsedRef.current + (now - startRef.current);
      const remaining = Math.max(0, duration - elapsed);
      setProgress((remaining / duration) * 100);
      if (remaining <= 0) {
        dismiss();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [duration, dismiss]);

  function onMouseEnter() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    pausedRef.current = true;
    elapsedRef.current += Date.now() - startRef.current;
  }

  function onMouseLeave() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    pausedRef.current = false;
    startRef.current = Date.now();
  }

  return (
    <div
      role={ARIA_ROLE[type]}
      aria-live={ARIA_ROLE[type] === "alert" ? "assertive" : "polite"}
      aria-atomic="true"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`pointer-events-auto relative overflow-hidden rounded border ${s.border} ${s.bg} shadow-2xl text-left w-full ${
        exiting ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0 animate-in fade-in slide-in-from-bottom-2 duration-200"
      } transition-[opacity,transform] duration-150`}
    >
      <div className={`absolute inset-y-0 left-0 w-0.5 ${s.bar}`} aria-hidden="true" />
      <div className="flex items-start gap-2.5 px-3.5 py-2.5 pl-4 pr-2">
        <Icon className={`mt-0.5 shrink-0 size-3.5 ${s.icon}`} strokeWidth={2} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          {title ? <p className={`text-[11px] font-medium ${s.text}`}>{title}</p> : null}
          <p className={`text-[12px] leading-relaxed ${s.text} ${title ? "mt-0.5" : ""}`}>{message}</p>
          {action ? (
            <button
              type="button"
              onClick={() => {
                action.onClick();
                dismiss();
              }}
              className={`mt-1.5 text-[11px] font-medium underline underline-offset-2 hover:opacity-80 ${s.icon} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent`}
            >
              {action.label}
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss notification"
          className={`shrink-0 rounded p-1 ${s.icon} hover:bg-tn-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent`}
        >
          <X className="size-3.5" strokeWidth={2} aria-hidden />
        </button>
      </div>
      <div
        className="h-0.5 w-full bg-tn-border/40"
        role="presentation"
        aria-hidden="true"
      >
        <div
          className={`h-full ${s.progress} motion-reduce:transition-none transition-[width] duration-75 ease-linear`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function Toast() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);
  const clearToasts = useToastStore((s) => s.clearToasts);

  if (toasts.length === 0) return null;

  const visible = toasts.slice(-MAX_VISIBLE);

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none max-w-sm w-full"
      aria-label="Notifications"
    >
      {toasts.length > 2 ? (
        <button
          type="button"
          onClick={clearToasts}
          className="pointer-events-auto self-end rounded border border-tn-border bg-tn-panel px-2 py-0.5 text-[10px] text-tn-text-muted hover:text-tn-text hover:bg-tn-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent"
        >
          Clear all
        </button>
      ) : null}
      {visible.map((t) => (
        <ToastItem
          key={t.id}
          id={t.id}
          message={t.message}
          type={t.type}
          title={t.title}
          action={t.action}
          onDismiss={removeToast}
        />
      ))}
    </div>
  );
}
