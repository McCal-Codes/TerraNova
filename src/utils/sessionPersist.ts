/**
 * Persist and restore navigation session state across page reloads.
 *
 * Saves projectPath, currentFile, and activeBiomeSection to localStorage
 * so the app can resume where the user left off after a reload.
 */

const SESSION_KEY = "tn-session";
import { safeStoredJson } from "@/utils/safeLocalStorage";

export interface SessionState {
  projectPath: string | null;
  currentFile: string | null;
  activeBiomeSection: string | null;
}

export function saveSession(state: Partial<SessionState>): void {
  try {
    const current = loadSession();
    const merged = { ...current, ...state };
    localStorage.setItem(SESSION_KEY, JSON.stringify(merged));
  } catch {
    // localStorage may be unavailable in some contexts
  }
}

export function loadSession(): SessionState {
  return safeStoredJson<SessionState>(SESSION_KEY, {
    projectPath: null,
    currentFile: null,
    activeBiomeSection: null,
  });
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // noop
  }
}
