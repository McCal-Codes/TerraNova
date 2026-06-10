import { getLastBridgeSaveName } from "@/utils/hytaleSavePaths";

export interface BridgeSaveContext {
  /** Full path to save folder, e.g. .../Saves/MyWorld */
  saveRoot: string;
  saveName: string;
  /** Mod pack root (Server/ lives here) when resolved from a path */
  modPackPath?: string;
  modPackFolder?: string;
}

const EMBEDDED_MOD_PACK_RE =
  /[/\\]UserData[/\\]Saves[/\\]([^/\\]+)[/\\]mods[/\\]([^/\\]+?)[/\\]?$/i;

const EMBEDDED_MOD_PACK_IN_TREE_RE =
  /[/\\]UserData[/\\]Saves[/\\]([^/\\]+)[/\\]mods[/\\]([^/\\]+)(?:[/\\]|$)/i;

function normalize(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+$/, "");
}

/**
 * Infer Hytale embedded-save + mod pack from a pack root or project path.
 * Example: .../Saves/MyWorld/mods/Author.Pack
 */
export function resolveBridgeSaveContextFromPath(
  path: string | null | undefined,
): BridgeSaveContext | null {
  if (!path?.trim()) return null;
  const norm = normalize(path.trim());

  let m = norm.match(EMBEDDED_MOD_PACK_RE);
  if (!m) m = norm.match(EMBEDDED_MOD_PACK_IN_TREE_RE);
  if (!m) return null;

  const saveName = m[1];
  const modPackFolder = m[2];
  const modsIdx = norm.toLowerCase().lastIndexOf("/mods/");
  if (modsIdx < 0) return null;
  const saveRoot = norm.slice(0, modsIdx);
  const modPackPath = `${saveRoot}/mods/${modPackFolder}`;

  return { saveRoot, saveName, modPackPath, modPackFolder };
}

/** Pick save/mod context from Bridge mod path, open project, or last discovered save. */
export function resolveBridgeDiscoveryHints(
  serverModPath: string,
  projectPath: string | null,
): { saveRoot?: string; saveName?: string; modPackPath?: string } {
  const fromMod =
    resolveBridgeSaveContextFromPath(serverModPath) ??
    resolveBridgeSaveContextFromPath(projectPath);

  if (fromMod) {
    return {
      saveRoot: fromMod.saveRoot,
      saveName: fromMod.saveName,
      modPackPath: fromMod.modPackPath,
    };
  }

  const lastSave = getLastBridgeSaveName();
  if (lastSave) {
    return { saveName: lastSave };
  }

  return {};
}

/** If the opened project is a mod pack folder, use it as Bridge server mod path. */
export function modPackPathFromProject(projectPath: string | null): string | null {
  if (!projectPath?.trim()) return null;
  const ctx = resolveBridgeSaveContextFromPath(projectPath);
  if (ctx?.modPackPath) return ctx.modPackPath;
  // Project root may already be the pack folder (…/mods/PackName)
  const norm = normalize(projectPath.trim());
  if (EMBEDDED_MOD_PACK_RE.test(norm)) return norm;
  return null;
}
