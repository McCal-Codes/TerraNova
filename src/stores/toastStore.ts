import { create } from "zustand";

export type ToastType = "error" | "warning" | "info" | "success";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType, action?: ToastAction) => void;
  removeToast: (id: number) => void;
}

/** How long each toast type stays visible (ms). Errors/warnings linger longer. */
const TOAST_DURATION: Record<ToastType, number> = {
  error: 8000,
  warning: 6000,
  success: 4000,
  info: 4000,
};

/** Maximum number of toasts visible at once. Oldest is evicted when exceeded. */
const MAX_TOASTS = 6;

let nextId = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type = "error", action) => {
    const id = ++nextId;
    set((s) => {
      const incoming = { id, message, type, action };
      // Evict oldest entries when the queue is full
      const trimmed = s.toasts.length >= MAX_TOASTS ? s.toasts.slice(s.toasts.length - MAX_TOASTS + 1) : s.toasts;
      return { toasts: [...trimmed, incoming] };
    });
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, TOAST_DURATION[type]);
  },
  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));
