import { getAppVersion } from "@/utils/fetchReleases";

export const WHATS_NEW_SEEN_KEY = "terranova:whats-new-seen";
export const WHATS_NEW_SUPPRESS_KEY = "terranova:whats-new-suppress";

export function getWhatsNewSuppressed(): boolean {
  try {
    return localStorage.getItem(WHATS_NEW_SUPPRESS_KEY) === "true";
  } catch {
    return false;
  }
}

export function setWhatsNewSuppressed(value: boolean): void {
  try {
    if (value) localStorage.setItem(WHATS_NEW_SUPPRESS_KEY, "true");
    else localStorage.removeItem(WHATS_NEW_SUPPRESS_KEY);
  } catch {
    // ignore
  }
}

/** Mark the current app version as seen; optionally set startup suppress. */
export async function markWhatsNewSeen(suppress = false): Promise<void> {
  try {
    const appVersion = await getAppVersion();
    if (appVersion) localStorage.setItem(WHATS_NEW_SEEN_KEY, appVersion);
    if (suppress) localStorage.setItem(WHATS_NEW_SUPPRESS_KEY, "true");
    else localStorage.removeItem(WHATS_NEW_SUPPRESS_KEY);
  } catch {
    // ignore
  }
}

export function isWhatsNewSeenForVersion(appVersion: string | null): boolean {
  if (!appVersion) return true;
  try {
    return localStorage.getItem(WHATS_NEW_SEEN_KEY) === appVersion;
  } catch {
    return true;
  }
}

export function isWhatsNewSuppressed(): boolean {
  return getWhatsNewSuppressed();
}
