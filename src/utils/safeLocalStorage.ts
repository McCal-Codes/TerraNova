/** Max length for persisted filesystem paths (Windows extended path is ~32767; keep small). */
const MAX_PATH_LEN = 512;

export function sanitizePersistedPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "";
  if (trimmed.length > MAX_PATH_LEN) return trimmed.slice(0, MAX_PATH_LEN);
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "";
  return trimmed;
}

function isQuotaError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === "QuotaExceededError" || err.code === 22)
  );
}

/** Drop largest graph undo blobs so small Bridge settings can be saved. */
export function pruneHistoryLocalStorage(maxRemove = 8): number {
  if (typeof localStorage === "undefined") return 0;
  const candidates: { key: string; size: number }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith("tn-history:")) continue;
    const raw = localStorage.getItem(key);
    candidates.push({ key, size: raw?.length ?? 0 });
  }
  candidates.sort((a, b) => b.size - a.size);
  let removed = 0;
  for (const { key } of candidates.slice(0, maxRemove)) {
    try {
      localStorage.removeItem(key);
      removed++;
    } catch {
      /* ignore */
    }
  }
  return removed;
}

export function safeLocalStorageSetItem(key: string, value: string): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    if (!isQuotaError(err)) throw err;
  }
  pruneHistoryLocalStorage();
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    if (!isQuotaError(err)) throw err;
    console.warn(`[TerraNova] localStorage full; could not persist ${key}`);
    return false;
  }
}

export function safeLocalStorageGetItem(key: string): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export type StrictJsonParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function strictJsonParse<T = unknown>(raw: string): StrictJsonParseResult<T> {
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export function safeStoredJson<T>(key: string, fallback: null): T | null;
export function safeStoredJson<T>(key: string, fallback: T): T;
export function safeStoredJson<T>(key: string, fallback: T | null): T | null {
  if (typeof localStorage === "undefined") return fallback;
  const raw = safeLocalStorageGetItem(key);
  if (raw === null) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore cleanup failures.
    }
    return fallback;
  }
}
