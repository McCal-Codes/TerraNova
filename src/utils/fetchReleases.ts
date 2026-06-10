import { getVersion } from "@tauri-apps/api/app";
import { GITHUB_RELEASES_API } from "@/constants/github";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ReleaseSection {
  title: string;
  items: { label: string; description: string }[];
}

export interface ReleaseData {
  version: string;
  date: string;
  name: string;
  sections: ReleaseSection[];
}

// ── Cache ──────────────────────────────────────────────────────────────────────

const CACHE_STORAGE_KEY = "terranova:releases-cache";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let memoryCache: ReleaseData[] | null = null;

interface StoredCache {
  timestamp: number;
  releases: ReleaseData[];
}

function readLocalStorageCache(): ReleaseData[] | null {
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return null;
    const stored: StoredCache = JSON.parse(raw);
    if (Date.now() - stored.timestamp > CACHE_TTL_MS) return null;
    return stored.releases;
  } catch {
    return null;
  }
}

function writeLocalStorageCache(releases: ReleaseData[]) {
  try {
    const stored: StoredCache = { timestamp: Date.now(), releases };
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(stored));
  } catch { /* quota or private-mode — ignore */ }
}

// ── Sections to strip from release markdown ────────────────────────────────────

const STRIPPED_SECTIONS = new Set(["installation", "full changelog"]);

// ── Markdown parser ────────────────────────────────────────────────────────────

function parseReleaseBody(body: string): ReleaseSection[] {
  const sections: ReleaseSection[] = [];
  // Split on level-2 headings (## Heading)
  const blocks = body.split(/^##\s+/m).filter(Boolean);

  for (const block of blocks) {
    const newlineIdx = block.indexOf("\n");
    const title = (newlineIdx === -1 ? block : block.slice(0, newlineIdx)).trim();
    if (STRIPPED_SECTIONS.has(title.toLowerCase())) continue;

    const content = newlineIdx === -1 ? "" : block.slice(newlineIdx + 1).trim();
    const items = parseItems(content);
    if (items.length > 0) {
      sections.push({ title, items });
    }
  }
  return sections;
}

/**
 * Parse items from a section body. Handles:
 *  - `**Label** — Description` (paragraph style)
 *  - `- **Label** — Description` (list style)
 *  - `- Plain text` (no bold prefix)
 */
function parseItems(content: string): { label: string; description: string }[] {
  const items: { label: string; description: string }[] = [];
  const lines = content.split("\n");

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Strip leading list marker
    const stripped = line.replace(/^[-*]\s+/, "");

    // Try to extract **Label** — Description
    const match = stripped.match(/^\*\*(.+?)\*\*\s*[—–\-:]\s*(.+)$/);
    if (match) {
      items.push({ label: match[1].trim(), description: match[2].trim() });
    } else if (stripped.length > 0) {
      // Plain text item — use the full text as the label
      items.push({ label: stripped, description: "" });
    }
  }
  return items;
}

// ── Fetcher ────────────────────────────────────────────────────────────────────

const RELEASES_URL = GITHUB_RELEASES_API;

/** Shown in What's New when GitHub has not published the alpha tag yet. */
function bundledAlphaRelease(): ReleaseData {
  return {
    version: "0.1.8-alpha.1",
    date: "Jun 10, 2026",
    name: "0.1.8 Closed Alpha",
    sections: [
      {
        title: "What's New",
        items: [
          {
            label: "Closed alpha build",
            description:
              "First McCal-Codes closed alpha with onboarding asset sync, Create Pack prefab picker, pack backup, and in-app bug reporter.",
          },
          {
            label: "What to test checklist",
            description:
              "After onboarding, alpha testers see a focus-area checklist (onboarding, pack wizard, preview, export/bridge, pack backup, bug reports).",
          },
          {
            label: "Preview settings sidebar",
            description:
              "Collapsible settings rail in split view — expand via toolbar Settings or the edge chevron.",
          },
        ],
      },
      {
        title: "Features",
        items: [
          {
            label: "Onboarding asset sync",
            description: "Step 3 runs Hytale release sync in-wizard with Browse and Sync now.",
          },
          {
            label: "Home Learn dialog",
            description: "Walkthroughs open from onboarding Step 4 and Home → Learn.",
          },
          {
            label: "Visual prefab picker",
            description: "Create Pack Advanced → Biome: search, category chips, and live 3D preview.",
          },
          {
            label: "Pack backup settings",
            description:
              "Settings → General: prompt toggle, default backup folder, back up open project, reset skip list.",
          },
          {
            label: "Bug reporter attachments",
            description:
              "Capture preview screenshots and attach files; paths copy into the debug bundle for GitHub drag-and-drop.",
          },
          {
            label: "Bug reporter v2",
            description: "Area-specific hints, steps/expected/actual fields, redacted paths, structured debug bundle.",
          },
        ],
      },
      {
        title: "Fixes",
        items: [
          {
            label: "Preview HUD drag",
            description: "Material legend and timing overlay no longer move opposite to the drag direction.",
          },
        ],
      },
      {
        title: "Testing",
        items: [
          {
            label: "Report bugs in-app",
            description:
              "Settings → File a Bug Report — copy bundle, attach screenshots, open McCal-Codes GitHub with prefilled fields.",
          },
          {
            label: "GitHub templates",
            description: "Bug, feature, alpha feedback, docs, and question templates on McCal-Codes/TerraNova.",
          },
          {
            label: "Beta guide",
            description: "See docs/BETA_TESTING.md for platform install notes and first-run checklist.",
          },
        ],
      },
    ],
  };
}

function mergeBundledReleases(releases: ReleaseData[]): ReleaseData[] {
  const bundled = bundledAlphaRelease();
  if (releases.some((r) => r.version === bundled.version)) return releases;
  return [bundled, ...releases];
}

interface GitHubRelease {
  tag_name: string;
  name: string | null;
  published_at: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
}

function parseVersion(tag: string): string {
  return tag.replace(/^v/, "");
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function toReleaseData(gh: GitHubRelease): ReleaseData {
  return {
    version: parseVersion(gh.tag_name),
    date: formatDate(gh.published_at),
    name: gh.name ?? parseVersion(gh.tag_name),
    sections: parseReleaseBody(gh.body ?? ""),
  };
}

export async function fetchReleases(): Promise<ReleaseData[]> {
  // 1. In-memory cache (fastest)
  if (memoryCache) return mergeBundledReleases(memoryCache);

  // 2. localStorage cache (survives page reloads)
  const stored = readLocalStorageCache();
  if (stored) {
    memoryCache = mergeBundledReleases(stored);
    return memoryCache;
  }

  // 3. Network fetch
  const res = await fetch(RELEASES_URL, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);

  const raw: GitHubRelease[] = await res.json();
  const releases = mergeBundledReleases(
    raw
      .filter((r) => !r.draft)
      .map(toReleaseData),
  );

  memoryCache = releases;
  writeLocalStorageCache(releases);
  return releases;
}

// ── App version helper ─────────────────────────────────────────────────────────

let appVersionCache: string | null = null;

export async function getAppVersion(): Promise<string> {
  if (appVersionCache) return appVersionCache;
  try {
    appVersionCache = await getVersion();
  } catch {
    appVersionCache = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";
  }
  return appVersionCache;
}
