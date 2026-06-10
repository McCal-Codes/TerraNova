import { homeDir, join } from "@tauri-apps/api/path";
import { isTauriRuntime } from "./platform";

type OS = "windows" | "macos" | "linux";

function detectOsFromHome(home: string): OS {
  if (/^[A-Za-z]:[/\\]/.test(home)) return "windows";
  if (home.startsWith("/Users/")) return "macos";
  return "linux";
}

function detectOsFromNavigator(): OS {
  if (navigator.userAgent.includes("Mac")) return "macos";
  if (navigator.userAgent.includes("Windows")) return "windows";
  return "linux";
}

function fallbackJoin(os: OS, ...parts: string[]): string {
  const separator = os === "windows" ? "\\" : "/";
  return parts
    .filter((part) => part.length > 0)
    .map((part, index) => {
      if (index === 0) return part.replace(/[\\/]+$/g, "");
      return part.replace(/^[\\/]+|[\\/]+$/g, "");
    })
    .join(separator);
}

async function joinPath(os: OS, ...parts: string[]): Promise<string> {
  return isTauriRuntime() ? join(...parts) : fallbackJoin(os, ...parts);
}

async function hytaleDataRoot(): Promise<{ root: string; os: OS }> {
  if (!isTauriRuntime()) {
    const os = detectOsFromNavigator();
    const root =
      os === "windows"
        ? "%APPDATA%\\Hytale"
        : os === "macos"
          ? "~/Library/Application Support/Hytale"
          : "~/.local/share/Hytale";
    return { root, os };
  }

  const home = await homeDir();
  const os = detectOsFromHome(home);
  let root: string;
  if (os === "windows") {
    root = await join(home, "AppData", "Roaming", "Hytale");
  } else if (os === "macos") {
    root = await join(home, "Library", "Application Support", "Hytale");
  } else {
    root = await join(home, ".local", "share", "Hytale");
  }
  return { root, os };
}

/** Embedded save used for worldgen iteration (per-save mods folder, not global UserData/Mods). */
export const WORLDGEN_V1_SAVE_NAME = "Worldgen V1";

/** Always created under each save's mods/ folder for Bridge sync (enable in Hytale world settings). */
export const TERRANOVA_BRIDGE_MOD_FOLDER = "TerraNova.Bridge";

/** Mod pack folder names under Saves/Worldgen V1/mods that contain Server/HytaleGenerator (verified 2026-06). */
export const WORLDGEN_V1_WORLDGEN_MOD_FOLDERS = {
  volumeLab: "McCal.Volume Lab",
  autmnForest: "McCal.Autmn Forest",
} as const;

export type WorldgenV1ModPackId = keyof typeof WORLDGEN_V1_WORLDGEN_MOD_FOLDERS;

export interface BridgeModPackPreset {
  id: WorldgenV1ModPackId;
  label: string;
  folderName: string;
  /** Example biome path inside the pack for sync sanity checks. */
  exampleBiomeRelative: string;
}

export const WORLDGEN_V1_BRIDGE_PRESETS: BridgeModPackPreset[] = [
  {
    id: "volumeLab",
    label: "McCal — Volume Lab",
    folderName: WORLDGEN_V1_WORLDGEN_MOD_FOLDERS.volumeLab,
    exampleBiomeRelative: "Server/HytaleGenerator/Biomes/Volume Lab Island.json",
  },
  {
    id: "autmnForest",
    label: "McCal — Autmn Forest",
    folderName: WORLDGEN_V1_WORLDGEN_MOD_FOLDERS.autmnForest,
    exampleBiomeRelative: "Server/HytaleGenerator/Biomes/Autmn Forest.json",
  },
];

/**
 * Per-save mods directory (world-specific), e.g.
 * %APPDATA%\\Hytale\\UserData\\Saves\\Worldgen V1\\mods
 */
export async function resolveSaveModsRoot(saveName: string = WORLDGEN_V1_SAVE_NAME): Promise<string> {
  const { root, os } = await hytaleDataRoot();
  return joinPath(os, root, "UserData", "Saves", saveName, "mods");
}

/** Bridge serverModPath must be a single pack root (contains Server/), not the parent mods/ folder. */
export async function resolveSaveModPackRoot(
  packId: WorldgenV1ModPackId,
  saveName: string = WORLDGEN_V1_SAVE_NAME,
): Promise<string> {
  const modsRoot = await resolveSaveModsRoot(saveName);
  const folder = WORLDGEN_V1_WORLDGEN_MOD_FOLDERS[packId];
  const { os } = await hytaleDataRoot();
  return joinPath(os, modsRoot, folder);
}

/**
 * Default Bridge target for this workspace: Worldgen V1 → McCal.Volume Lab.
 * Falls back to empty string when not on Windows/Tauri (user must browse).
 */
export async function resolveDefaultBridgeServerModPath(): Promise<string> {
  try {
    return await resolveSaveModPackRoot("volumeLab");
  } catch {
    return "";
  }
}

/** Hytale mod folder name for a TerraNova export (Group.Name), matching exportAssetPack. */
export function deriveTerraNovaModFolderName(
  manifestName?: string,
  projectFolderName?: string,
): string {
  const modGroup = "TerraNova";
  const projectName = manifestName || projectFolderName || "TerraNovaPack";
  let modName = projectName.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!manifestName && modName.toLowerCase().startsWith(`${modGroup.toLowerCase()}-`)) {
    modName = modName.slice(modGroup.length + 1);
  }
  return `${modGroup}.${modName}`;
}

/** Resolve Hytale mod Group, Name, and folder from TerraNova manifest (wizard or legacy). */
export function deriveHytaleModIdentity(
  manifest: Record<string, unknown> | null | undefined,
  projectFolderName?: string,
): { modGroup: string; modName: string; modFolderName: string } {
  const hytaleGroup = typeof manifest?.hytaleGroup === "string" ? manifest.hytaleGroup.trim() : "";
  const hytaleName = typeof manifest?.hytaleName === "string" ? manifest.hytaleName.trim() : "";
  if (hytaleGroup && hytaleName) {
    return {
      modGroup: hytaleGroup,
      modName: hytaleName,
      modFolderName: `${hytaleGroup}.${hytaleName}`,
    };
  }
  const modFolderName = deriveTerraNovaModFolderName(
    manifest?.name as string | undefined,
    projectFolderName,
  );
  const dot = modFolderName.indexOf(".");
  return {
    modGroup: dot >= 0 ? modFolderName.slice(0, dot) : "TerraNova",
    modName: dot >= 0 ? modFolderName.slice(dot + 1) : modFolderName,
    modFolderName,
  };
}

/** Bridge serverModPath for a pack folder sitting under a save's mods directory. */
export async function resolveSaveModPackRootByFolder(
  folderName: string,
  saveName: string = WORLDGEN_V1_SAVE_NAME,
): Promise<string> {
  const modsRoot = await resolveSaveModsRoot(saveName);
  const { os } = await hytaleDataRoot();
  return joinPath(os, modsRoot, folderName);
}

/** Where to export a new test mod for Worldgen V1 (pick this folder in Export Asset Pack). */
export async function resolveWorldgenV1ExportModsRoot(): Promise<string> {
  return resolveSaveModsRoot(WORLDGEN_V1_SAVE_NAME);
}

export function isUnderDirectory(child: string, parent: string): boolean {
  const norm = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  const c = norm(child);
  const p = norm(parent);
  return c === p || c.startsWith(`${p}/`);
}
