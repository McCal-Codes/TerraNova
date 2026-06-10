import { bridgeDiscover } from "@/utils/ipc";
import { joinPath, hytaleDataRoot } from "@/utils/hytaleModPaths";
import { isTauriRuntime } from "@/utils/platform";
import {
  safeLocalStorageGetItem,
  safeLocalStorageSetItem,
} from "@/utils/safeLocalStorage";

const LAST_BRIDGE_SAVE_KEY = "tn-bridge-lastSaveName";

/** Last save name resolved by Bridge discovery (persisted locally). */
export function getLastBridgeSaveName(): string | null {
  const raw = safeLocalStorageGetItem(LAST_BRIDGE_SAVE_KEY)?.trim();
  return raw || null;
}

export function setLastBridgeSaveName(saveName: string): void {
  const trimmed = saveName.trim();
  if (!trimmed) return;
  safeLocalStorageSetItem(LAST_BRIDGE_SAVE_KEY, trimmed);
}

export async function resolveHytaleSavesRoot(): Promise<string> {
  const { root, os } = await hytaleDataRoot();
  return joinPath(os, root, "UserData", "Saves");
}

/**
 * Per-save mods directory, e.g.
 * %APPDATA%\\Hytale\\UserData\\Saves\\MyWorld\\mods
 */
export async function resolveSaveModsRoot(saveName: string): Promise<string> {
  const { root, os } = await hytaleDataRoot();
  return joinPath(os, root, "UserData", "Saves", saveName, "mods");
}

async function discoverDefaultSaveName(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const result = await bridgeDiscover({});
  if (result.saveName) {
    setLastBridgeSaveName(result.saveName);
    return result.saveName;
  }
  return null;
}

/** Resolve a save name from persisted Bridge discovery or a one-shot discover call. */
export async function resolveKnownSaveName(): Promise<string | null> {
  return getLastBridgeSaveName() ?? (await discoverDefaultSaveName());
}

/** Default export folder: the active save's mods/ directory when known. */
export async function resolveDefaultExportModsRoot(): Promise<string> {
  const saveName = await resolveKnownSaveName();
  if (saveName) {
    return resolveSaveModsRoot(saveName);
  }
  throw new Error(
    "No Hytale save found. Create a world in Hytale, open Bridge (Ctrl+B), or browse to your save mods folder.",
  );
}

/** Mods folder for browse dialogs when save name is not yet known. */
export async function resolveDefaultSaveModsBrowseRoot(): Promise<string | undefined> {
  try {
    return await resolveDefaultExportModsRoot();
  } catch {
    try {
      return await resolveHytaleSavesRoot();
    } catch {
      return undefined;
    }
  }
}

export async function resolveSaveModPackRootByFolder(
  folderName: string,
  saveName?: string,
): Promise<string> {
  const resolvedSave = saveName ?? (await resolveKnownSaveName());
  if (!resolvedSave) {
    throw new Error(
      "No Hytale save known. Open Bridge after creating a world, or pick a mod pack under Saves/.../mods.",
    );
  }
  const modsRoot = await resolveSaveModsRoot(resolvedSave);
  const { os } = await hytaleDataRoot();
  return joinPath(os, modsRoot, folderName);
}
