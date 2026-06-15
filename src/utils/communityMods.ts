import { invoke } from "@tauri-apps/api/core";

// ── Types (mirror src-tauri/src/commands/community.rs) ──────────────────────

export interface CommunityMod {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  url: string;
  /** Semver range of TerraNova versions this mod supports. */
  compat: string;
  thumbnail?: string;
  tags: string[];
}

export interface ModIndex {
  schemaVersion: number;
  updatedAt: string;
  mods: CommunityMod[];
}

// ── IPC wrappers ─────────────────────────────────────────────────────────────

/** Fetch the community mod registry index from the remote endpoint. */
export async function fetchCommunityModIndex(): Promise<ModIndex> {
  return invoke<ModIndex>("fetch_community_mod_index");
}

/** List mods the user has installed locally. */
export async function listInstalledCommunityMods(): Promise<CommunityMod[]> {
  return invoke<CommunityMod[]>("list_installed_community_mods");
}
