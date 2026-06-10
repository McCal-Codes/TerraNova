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

export function fallbackJoin(os: OS, ...parts: string[]): string {
  const separator = os === "windows" ? "\\" : "/";
  return parts
    .filter((part) => part.length > 0)
    .map((part, index) => {
      if (index === 0) return part.replace(/[\\/]+$/g, "");
      return part.replace(/^[\\/]+|[\\/]+$/g, "");
    })
    .join(separator);
}

export async function joinPath(os: OS, ...parts: string[]): Promise<string> {
  return isTauriRuntime() ? join(...parts) : fallbackJoin(os, ...parts);
}

export async function hytaleDataRoot(): Promise<{ root: string; os: OS }> {
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

/** Always created under each save's mods/ folder for Bridge sync (enable in Hytale world settings). */
export const TERRANOVA_BRIDGE_MOD_FOLDER = "TerraNova.Bridge";

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

export function isUnderDirectory(child: string, parent: string): boolean {
  const norm = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  const c = norm(child);
  const p = norm(parent);
  return c === p || c.startsWith(`${p}/`);
}
