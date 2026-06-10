import { create } from "zustand";

export type PackBackupDialogResult =
  | { action: "cancel" }
  | { action: "open"; backedUp: boolean; backupPath?: string };

interface PendingPackBackup {
  packPath: string;
  resolve: (result: PackBackupDialogResult) => void;
}

interface PackBackupState {
  open: boolean;
  pending: PendingPackBackup | null;
  request: (packPath: string) => Promise<PackBackupDialogResult>;
  complete: (result: PackBackupDialogResult) => void;
}

export const usePackBackupStore = create<PackBackupState>((set, get) => ({
  open: false,
  pending: null,
  request: (packPath) =>
    new Promise<PackBackupDialogResult>((resolve) => {
      set({ open: true, pending: { packPath, resolve } });
    }),
  complete: (result) => {
    const pending = get().pending;
    pending?.resolve(result);
    set({ open: false, pending: null });
  },
}));
