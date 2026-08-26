import { create } from "zustand";
import type { HytaleAccount } from "@/utils/ipc";
import { safeLocalStorageGetItem, safeLocalStorageSetItem } from "@/utils/safeLocalStorage";

/**
 * Signed-in Hytale account.
 *
 * Deliberately separate from `bridgeStore`: Bridge state is save-scoped, this
 * is app-scoped. Nothing secret lives here — the access token never leaves the
 * Rust layer, so this store holds only display identity plus one preference.
 */
interface AccountState {
  /** False in builds without a client ID; the whole account UI hides. */
  available: boolean;
  account: HytaleAccount | null;
  signingIn: boolean;
  lastError: string | null;
  /** Prefer the signed-in profile's player over the newest-file heuristic. */
  preferSignedInPlayer: boolean;

  setAvailable: (available: boolean) => void;
  setAccount: (account: HytaleAccount | null) => void;
  setSigningIn: (signingIn: boolean) => void;
  setLastError: (error: string | null) => void;
  setPreferSignedInPlayer: (prefer: boolean) => void;
}

const PREFER_KEY = "tn-account-preferPlayer";

function getStoredPreference(): boolean {
  // Default on: if you have signed in, targeting your own player is what you
  // almost certainly want.
  return safeLocalStorageGetItem(PREFER_KEY) !== "false";
}

export const useAccountStore = create<AccountState>((set) => ({
  available: false,
  account: null,
  signingIn: false,
  lastError: null,
  preferSignedInPlayer: getStoredPreference(),

  setAvailable: (available) => set({ available }),

  setAccount: (account) => set({ account, signingIn: false }),

  setSigningIn: (signingIn) => set({ signingIn }),

  setLastError: (lastError) => set({ lastError, signingIn: false }),

  setPreferSignedInPlayer: (preferSignedInPlayer) => {
    safeLocalStorageSetItem(PREFER_KEY, String(preferSignedInPlayer));
    set({ preferSignedInPlayer });
  },
}));

/**
 * The UUID the Bridge should prefer when resolving a player, or null when
 * unavailable, signed out, or the preference is off.
 */
export function preferredPlayerUuid(state: AccountState): string | null {
  if (!state.preferSignedInPlayer) return null;
  return state.account?.uuid ?? null;
}

/** True when a previously-signed-in session has aged out. */
export function isSessionExpired(account: HytaleAccount | null): boolean {
  if (!account?.sessionExpiresAt) return false;
  return Date.now() / 1000 >= account.sessionExpiresAt;
}
