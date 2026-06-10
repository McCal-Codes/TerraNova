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

let nextId = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type = "error", action) => {
    const id = ++nextId;
    set((s) => ({ toasts: [...s.toasts, { id, message, type, action }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));
