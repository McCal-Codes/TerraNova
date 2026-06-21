/** Closed-alpha tester checklist — shown once per alpha build after onboarding. */

export const ALPHA_WHAT_TO_TEST_VERSION = "0.1.8-alpha.4";

/** Primary contact for serious alpha issues (Discord). */
export const ALPHA_DISCORD_CONTACT = "@mcc_cal";

export function alphaWhatToTestStorageKey(version = ALPHA_WHAT_TO_TEST_VERSION): string {
  return `terranova:alpha-what-to-test:${version}`;
}

export function isAlphaWhatToTestDismissed(version = ALPHA_WHAT_TO_TEST_VERSION): boolean {
  try {
    return localStorage.getItem(alphaWhatToTestStorageKey(version)) === "1";
  } catch {
    return false;
  }
}

export function markAlphaWhatToTestDismissed(version = ALPHA_WHAT_TO_TEST_VERSION): void {
  try {
    localStorage.setItem(alphaWhatToTestStorageKey(version), "1");
  } catch {
    // ignore
  }
}

export interface AlphaTestFocusItem {
  id: string;
  area: string;
  title: string;
  steps: string[];
}

export const ALPHA_TEST_FOCUS_ITEMS: AlphaTestFocusItem[] = [
  {
    id: "onboarding-sync",
    area: "Onboarding",
    title: "First-run onboarding, Getting Started, and Hytale asset sync",
    steps: [
      "Complete all four onboarding steps on a fresh install (clear terranova:onboarding-v1 in devtools to retest).",
      "On Step 3, confirm release path auto-detect, run Sync now, and wait for the progress modal to finish.",
      "On Step 4, open Getting Started and confirm the same doc opens from Home → Learn.",
      "Note the F1 hint for in-editor documentation while editing.",
    ],
  },
  {
    id: "session-restore",
    area: "Launch",
    title: "Cold launch and session restore",
    steps: [
      "Open a project and file, close TerraNova, relaunch — confirm the same project and file reopen.",
      "Try an empty or minimal pack (few/no files in tree) — last file should still reopen or skip gracefully without hanging on home.",
      "Point session at a moved/deleted folder (devtools: edit terranova session JSON) — expect a warning toast and land on home with session cleared.",
      "If file open fails, confirm a toast and that you can pick another file from the tree.",
    ],
  },
  {
    id: "settings-legal",
    area: "Settings",
    title: "License, Notice, and What's New",
    steps: [
      "Settings → About: open License and Notice — readable scrollable text, no “coming soon”.",
      "Settings → View What's New, read highlights, close — reopening should not nag until the next version.",
      "Compare with home-screen What's New dismiss (should both mark the version seen).",
    ],
  },
  {
    id: "file-icons",
    area: "Project",
    title: "File tree and Referenced Assets icons",
    steps: [
      "In the project tree, confirm distinct icons for biomes, weather, environment, materials, world structures, and settings JSON.",
      "Open Asset Tools on a biome with weather/environment refs — kind icons appear beside status dots on Referenced Assets rows.",
    ],
  },
  {
    id: "atmosphere-tint",
    area: "Atmosphere",
    title: "Tint editing from Atmosphere tab",
    steps: [
      "Open a reference biome with Simplex tint (e.g. tropical/pirate-style DensityDelimited tint).",
      "Biome → Atmosphere tab: adjust Seed, Scale, Octaves, Persistence, Lacunarity — confirm voxel/tint preview colors update.",
      "Expand Advanced delimiters — edit band colors and ranges without selecting a graph node.",
      "Save, reopen, export — TintProvider JSON and graph round-trip unchanged.",
      "For exotic tint density (non-Simplex), confirm “Open Tint graph” still works.",
    ],
  },
  {
    id: "preview-fidelity",
    area: "Preview",
    title: "Fidelity badge and approximated callouts",
    steps: [
      "Open a cave or Pipeline-heavy biome — fidelity badge should reflect preview-path density only (not every canvas node).",
      "When approximated types are on the preview path, confirm the bottom callout names nodes and links to Issues.",
      "Open MaterialProvider editing — if the stack uses Surface/Exported passthrough nodes, confirm the column preview callout suggests Voxel preview on Terrain.",
    ],
  },
  {
    id: "preview-voxel",
    area: "Preview",
    title: "2D, 3D, Voxel preview and material legend",
    steps: [
      "Open a terrain biome in split view and expand preview settings (edge chevron or toolbar Settings).",
      "Cycle 2D → 3D → Voxel without WebGL crashes; try USGS Topo + Contours in 2D.",
      "In Voxel mode with material colors on, open Legend visibility — uncheck one material and confirm it disappears from the mesh.",
      "Re-enable materials; try cutaway + Fit to content on a cave biome.",
    ],
  },
  {
    id: "create-pack",
    area: "Create Pack",
    title: "Create Pack wizard (Simple + Advanced)",
    steps: [
      "Simple: launch a bundled template and confirm biome + world structure pairing.",
      "Advanced → Biome: use Quick pick or Browse for starter prefab; confirm 3D preview.",
      "Review step shows your prefab path and thumbnail before launch.",
    ],
  },
  {
    id: "export",
    area: "Export",
    title: "Export asset pack",
    steps: [
      "Export Asset Pack (Ctrl+Shift+E) and verify {Group}.{Name}/Server/HytaleGenerator layout.",
      "Import the mod into a Hytale save and confirm the biome loads in-game.",
    ],
  },
  {
    id: "pack-backup",
    area: "Safety",
    title: "Pack backup before open",
    steps: [
      "Settings → General: confirm pack backup prompt, optional default folder, and Back up open project now.",
      "Open an existing save mod or asset pack (Ctrl+O or Recent).",
      "Confirm the alpha backup prompt appears; use Back up & open and check .terranova-backups beside the pack.",
    ],
  },
  {
    id: "bug-report",
    area: "Support",
    title: "Bug reporter and debug bundle",
    steps: [
      "Settings → File a Bug Report (or About → Report a bug on home).",
      "Pick an area, add steps to reproduce, use Capture preview screenshot or Attach files when helpful.",
      "Copy the bundle, open the GitHub issue form, paste JSON into Session snapshot.",
      "Confirm version 0.1.8-alpha.4 and OS are prefilled.",
    ],
  },
];
