import { create } from "zustand";
import type { BugReportErrorContext } from "@/utils/bugReport";

interface BugReportState {
  open: boolean;
  errorContext: BugReportErrorContext | null;
  requestOpen: (error?: BugReportErrorContext | null) => void;
  close: () => void;
}

export const useBugReportStore = create<BugReportState>((set) => ({
  open: false,
  errorContext: null,
  requestOpen: (error = null) => set({ open: true, errorContext: error }),
  close: () => set({ open: false, errorContext: null }),
}));
