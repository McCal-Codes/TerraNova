import { useCallback, useEffect } from "react";
import { useAccountStore } from "@/stores/accountStore";
import {
  hytaleAccount,
  hytaleAuthAvailable,
  hytaleCancelSignIn,
  hytaleSignIn,
  hytaleSignOut,
} from "@/utils/ipc";
import type { HytaleAccount, HytaleAuthError } from "@/utils/ipc";

/** Turn a structured `AuthError` into copy a user can act on. */
function describe(err: unknown): string {
  const e = err as Partial<HytaleAuthError> | undefined;
  switch (e?.code) {
    case "not_configured":
      return "This build of TerraNova cannot sign in to Hytale.";
    case "already_in_progress":
      return "A sign-in is already in progress. Finish it in your browser, or cancel it here.";
    case "no_port_available":
      return "No local callback port was free. Close other apps using ports 7871-7875 and try again.";
    case "timeout":
      return "Timed out waiting for the browser. Try signing in again.";
    case "cancelled":
      return "Sign-in cancelled.";
    case "state_mismatch":
      return "The sign-in response didn't match this request, so it was rejected. Try again.";
    case "provider_error":
      return e.message ?? "Hytale rejected the sign-in request.";
    case "token_exchange_failed":
    case "id_token_invalid":
      return e.message ?? "Hytale returned a response TerraNova could not verify.";
    case "network":
      return "Could not reach the Hytale account service. Check your connection.";
    default:
      return e?.message ?? String(err);
  }
}

export function useAccount() {
  const { setAvailable, setAccount, setSigningIn, setLastError } = useAccountStore();

  /** Load whether this build supports sign-in, plus any cached account. */
  const refresh = useCallback(async (): Promise<void> => {
    try {
      const available = await hytaleAuthAvailable();
      useAccountStore.getState().setAvailable(available);
      if (!available) return;
      useAccountStore.getState().setAccount(await hytaleAccount());
    } catch {
      // A failed refresh should never surface as an error banner — the account
      // panel simply shows its signed-out state.
      useAccountStore.getState().setAvailable(false);
    }
  }, []);

  const signIn = useCallback(async (): Promise<HytaleAccount | null> => {
    const store = useAccountStore.getState();
    store.setLastError(null);
    store.setSigningIn(true);
    try {
      const account = await hytaleSignIn();
      useAccountStore.getState().setAccount(account);
      return account;
    } catch (err) {
      useAccountStore.getState().setLastError(describe(err));
      return null;
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    const store = useAccountStore.getState();
    store.setLastError(null);
    try {
      await hytaleSignOut();
      useAccountStore.getState().setAccount(null);
    } catch (err) {
      useAccountStore.getState().setLastError(describe(err));
    }
  }, []);

  const cancelSignIn = useCallback(async (): Promise<void> => {
    try {
      await hytaleCancelSignIn();
    } finally {
      useAccountStore.getState().setSigningIn(false);
    }
  }, []);

  return { refresh, signIn, signOut, cancelSignIn, setAvailable, setAccount, setSigningIn, setLastError };
}

/** Load account state once on mount. */
export function useAccountBootstrap(): void {
  const { refresh } = useAccount();
  useEffect(() => {
    void refresh();
  }, [refresh]);
}
