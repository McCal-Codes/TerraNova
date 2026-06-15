/** Closed-alpha tester checklist — shown once per alpha build after onboarding. */

export const ALPHA_WHAT_TO_TEST_VERSION = "0.1.8-alpha.3";

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
    title: "First-run onboarding and Hytale asset sync",
    steps: [
      "Complete all four onboarding steps on a fresh install (clear terranova:onboarding-v1 in devtools to retest).",
      "On Step 3, confirm release path auto-detect, run Sync now, and wait for the progress modal to finish.",
      "Open a walkthrough from Step 4 and confirm Home → Learn opens the same docs later.",
    ],
  },
  {
    id: "create-pack",
    area: "Create Pack",
    title: "Create Pack wizard (Simple + Advanced)",
    steps: [
      "Simple: launch a bundled template and confirm biome + world structure pairing.",
      "Advanced → Biome: use Quick pick or Browse (category → search → dropdown) for starter prefab; confirm 3D preview.",
      "Review step shows your prefab path and thumbnail before launch.",
    ],
  },
  {
    id: "preview",
    area: "Preview",
    title: "2D, 3D, and Voxel preview",
    steps: [
      "Open a terrain biome in split view and expand preview settings (edge chevron or toolbar **Settings**).",
      "Cycle 2D → 3D → Voxel without WebGL crashes; try USGS **Topo** + **Contours** in 2D.",
      "Toggle auto-refresh and confirm preview stays responsive after graph edits.",
      "If you use cave carving, try Voxel + section profile and optional cutaway.",
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
      "Confirm the alpha backup prompt appears; use Back up & open and check .terranova-backups beside the pack (or your chosen folder).",
      "Try Open without backup and Don't ask again for this pack on a throwaway folder; reset skip list from Settings if needed.",
    ],
  },
  {
    id: "bug-report",
    area: "Support",
    title: "Bug reporter and debug bundle",
    steps: [
      "Settings → File a Bug Report (or About → Report a bug on home).",
      "Pick an area, add steps to reproduce, use Capture preview screenshot or Attach files when helpful.",
      "Copy the bundle, open the GitHub issue form, paste JSON into Session snapshot, and drag attachments onto the issue.",
      "Confirm version 0.1.8-alpha.2 and OS are prefilled.",
    ],
  },
];
