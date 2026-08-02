/**
 * Startup behaviour, stored outside the settings store so session restore can
 * read it during boot without pulling the store in.
 */

const RESTORE_LAST_PROJECT_KEY = "tn-restore-last-project";

/**
 * Off by default: opening straight into the previously loaded pack evaluates a
 * potentially large project before the user has asked for anything, and leaves
 * no way back to Home if that project is what fails to load.
 */
export function getRestoreLastProject(): boolean {
  try {
    return localStorage.getItem(RESTORE_LAST_PROJECT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setRestoreLastProject(value: boolean): void {
  try {
    if (value) localStorage.setItem(RESTORE_LAST_PROJECT_KEY, "1");
    else localStorage.removeItem(RESTORE_LAST_PROJECT_KEY);
  } catch {
    // Storage unavailable — the default (open to Home) still applies.
  }
}
