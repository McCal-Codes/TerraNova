import { useEffect } from "react";
import { Loader2, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useAccountStore, isSessionExpired } from "@/stores/accountStore";
import { useAccount } from "@/hooks/useAccount";

/**
 * Settings → Account.
 *
 * Sign-in is an identity overlay: it never gates the editor, pack tools, or
 * the Bridge connection. See docs/planning/adr-001-sign-in-with-hytale.md.
 */
export function AccountSettingsPanel() {
  const available = useAccountStore((s) => s.available);
  const account = useAccountStore((s) => s.account);
  const signingIn = useAccountStore((s) => s.signingIn);
  const lastError = useAccountStore((s) => s.lastError);
  const preferSignedInPlayer = useAccountStore((s) => s.preferSignedInPlayer);
  const setPreferSignedInPlayer = useAccountStore((s) => s.setPreferSignedInPlayer);

  const { refresh, signIn, signOut, cancelSignIn } = useAccount();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const expired = isSessionExpired(account);

  if (!available) {
    return (
      <div className="rounded border border-tn-border/60 bg-tn-bg/60 p-4 flex flex-col gap-1">
        <p className="text-sm font-semibold text-tn-text">Sign in with Hytale</p>
        <p className="text-[11px] text-tn-text-muted leading-relaxed">
          This build of TerraNova was compiled without a Hytale client ID, so signing in is
          unavailable. Everything else — the editor, pack tools, and the Bridge — works exactly as
          normal.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded border border-tn-border/60 bg-tn-bg/60 p-4 flex flex-col gap-1">
        <p className="text-sm font-semibold text-tn-text">Sign in with Hytale</p>
        <p className="text-[11px] text-tn-text-muted leading-relaxed">
          Optional. Signing in lets the Bridge target your own player instead of guessing from the
          most recently saved player file. Nothing in the editor requires an account, and your
          Bridge connection keeps using its own local token either way.
        </p>
      </div>

      {lastError && (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-300 leading-relaxed">
          {lastError}
        </div>
      )}

      {account ? (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-tn-text-muted uppercase tracking-wider">
            Signed in
          </label>

          <div className="rounded border border-tn-border/60 bg-tn-bg/60 px-3 py-2.5 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-tn-text flex items-center gap-2">
                <UserRound className="w-3.5 h-3.5 text-tn-text-muted" />
                {account.username ?? "Hytale account"}
              </span>
              {account.sharedSource && (
                <span className="text-[10px] rounded border border-tn-accent/50 text-tn-accent px-1.5 py-0.5 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Shared Source
                </span>
              )}
            </div>

            {account.uuid && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-tn-text-muted uppercase tracking-wider">
                  Profile UUID
                </span>
                <code className="text-[11px] font-mono text-tn-text break-all select-all">
                  {account.uuid}
                </code>
              </div>
            )}

            {expired && (
              <p className="text-[11px] text-amber-400/90 leading-relaxed">
                This session has expired. Hytale issues no refresh tokens, so signing in again
                requires going through consent once more.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void signIn()}
              disabled={signingIn}
              className="flex-1 px-3 py-2 rounded border border-tn-border bg-tn-bg hover:bg-tn-surface text-sm text-tn-text disabled:opacity-50"
            >
              {expired ? "Sign in again" : "Switch profile"}
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="px-3 py-2 rounded border border-tn-border bg-tn-bg hover:bg-tn-surface text-sm text-tn-text-muted flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>

          <p className="text-[11px] text-tn-text-muted leading-relaxed">
            Hytale asks you to pick a game profile every time you sign in, so you can use{" "}
            <span className="text-tn-text">Switch profile</span> to point the Bridge at a different
            character.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {signingIn ? (
            <>
              <div className="rounded border border-tn-border/60 bg-tn-bg/60 px-3 py-2.5 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-tn-text-muted" />
                <span className="text-[11px] text-tn-text-muted">
                  Waiting for you to finish signing in with your browser…
                </span>
              </div>
              <button
                type="button"
                onClick={() => void cancelSignIn()}
                className="px-3 py-2 rounded border border-tn-border bg-tn-bg hover:bg-tn-surface text-sm text-tn-text-muted"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void signIn()}
              className="px-3 py-2 rounded border border-tn-border bg-tn-bg hover:bg-tn-surface text-sm text-left"
            >
              <span className="font-medium text-tn-text">Sign in with Hytale</span>
              <p className="text-xs mt-0.5 text-tn-text-muted">
                Opens your browser. TerraNova never sees your password.
              </p>
            </button>
          )}
        </div>
      )}

      <div className="border-t border-tn-border/50 pt-4 flex flex-col gap-2">
        <label className="text-xs font-medium text-tn-text-muted uppercase tracking-wider">
          Bridge
        </label>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={preferSignedInPlayer}
            onChange={(e) => setPreferSignedInPlayer(e.target.checked)}
            className="mt-0.5"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm text-tn-text">Prefer my signed-in player</span>
            <span className="text-[11px] text-tn-text-muted leading-relaxed">
              Resolve the Bridge player by your profile UUID instead of whichever player file was
              saved most recently. Falls back to the newest file when signed out or when no player
              in the save matches.
            </span>
          </span>
        </label>
      </div>

      <div className="border-t border-tn-border/50 pt-4 flex flex-col gap-2">
        <label className="text-xs font-medium text-tn-text-muted uppercase tracking-wider">
          Privacy
        </label>
        <div className="rounded border border-tn-border/60 bg-tn-bg/60 px-3 py-2.5 flex flex-col gap-1 text-[11px] text-tn-text-muted leading-relaxed">
          <p>No account data leaves your machine, and there is no telemetry attached to sign-in.</p>
          <p>
            The access token is kept in memory only and never written to disk. Only your profile
            name, profile UUID and Shared Source flag are cached locally, so TerraNova can show who
            is signed in after a restart.
          </p>
          <p>Signing out deletes that cache.</p>
        </div>
      </div>
    </>
  );
}
