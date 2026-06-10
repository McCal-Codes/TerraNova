import { create } from "zustand";
import type { BridgeDiscovery, ServerStatus } from "@/utils/ipc";
import {
  safeLocalStorageGetItem,
  safeLocalStorageSetItem,
  sanitizePersistedPath,
} from "@/utils/safeLocalStorage";

interface BridgeState {
  // Connection state
  connected: boolean;
  connecting: boolean;
  singleplayer: boolean;
  serverStatus: ServerStatus | null;
  lastError: string | null;
  /** Non-error feedback (queued sidecar actions, sync OK, etc.). */
  lastNotice: string | null;

  // Connection config (persisted to localStorage)
  host: string;
  port: number;
  authToken: string;
  serverModPath: string;

  // Block palette (fetched once per connection)
  blockPalette: Record<string, string> | null;

  // Dialog visibility
  dialogOpen: boolean;

  // Auto-discovery (sidecar / save player)
  discovery: BridgeDiscovery | null;
  discoveryProbing: boolean;

  // Actions
  setConnected: (connected: boolean, status?: ServerStatus | null) => void;
  setConnecting: (connecting: boolean) => void;
  setLastError: (error: string | null) => void;
  setLastNotice: (notice: string | null) => void;
  setConnectionConfig: (host: string, port: number, authToken: string) => void;
  setServerModPath: (path: string) => void;
  setBlockPalette: (palette: Record<string, string> | null) => void;
  setDialogOpen: (open: boolean) => void;
  setDiscovery: (discovery: BridgeDiscovery | null, probing?: boolean) => void;
}

function getStored(key: string, fallback: string): string {
  return safeLocalStorageGetItem(key) ?? fallback;
}

function getStoredNumber(key: string, fallback: number): number {
  const v = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
  if (v === null) return fallback;
  const n = parseInt(v, 10);
  return isNaN(n) ? fallback : n;
}

export const useBridgeStore = create<BridgeState>((set) => ({
  connected: false,
  connecting: false,
  singleplayer: false,
  serverStatus: null,
  lastError: null,
  lastNotice: null,

  host: getStored("tn-bridge-host", "127.0.0.1"),
  port: getStoredNumber("tn-bridge-port", 7854),
  authToken: getStored("tn-bridge-authToken", ""),
  serverModPath: sanitizePersistedPath(
    getStored("tn-bridge-serverModPath", ""),
  ),

  blockPalette: null,

  dialogOpen: false,

  discovery: null,
  discoveryProbing: false,

  setConnected: (connected, status) =>
    set({
      connected,
      connecting: false,
      singleplayer: connected ? (status?.singleplayer ?? false) : false,
      serverStatus: status ?? (connected ? undefined : null),
    }),

  setConnecting: (connecting) => set({ connecting }),

  setLastError: (lastError) => set({ lastError }),

  setLastNotice: (lastNotice) => set({ lastNotice }),

  setConnectionConfig: (host, port, authToken) => {
    safeLocalStorageSetItem("tn-bridge-host", host);
    safeLocalStorageSetItem("tn-bridge-port", String(port));
    safeLocalStorageSetItem("tn-bridge-authToken", authToken);
    set({ host, port, authToken });
  },

  setServerModPath: (serverModPath) => {
    const path = sanitizePersistedPath(serverModPath);
    safeLocalStorageSetItem("tn-bridge-serverModPath", path);
    set({ serverModPath: path });
  },

  setBlockPalette: (blockPalette) => set({ blockPalette }),

  setDialogOpen: (dialogOpen) => set({ dialogOpen }),

  setDiscovery: (discovery, probing) =>
    set({
      discovery,
      ...(probing !== undefined ? { discoveryProbing: probing } : {}),
    }),
}));
