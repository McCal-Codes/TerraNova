import { getVersion } from "@tauri-apps/api/app";
import { GITHUB_RELEASES_API } from "@/constants/github";
import { safeStoredJson } from "@/utils/safeLocalStorage";

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
  const stored = safeStoredJson<StoredCache>(CACHE_STORAGE_KEY, null);
  if (!stored) return null;
  if (Date.now() - stored.timestamp > CACHE_TTL_MS) return null;
  return stored.releases;
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
    version: "0.1.8-alpha.2",
    date: "Jun 11, 2026",
    name: "0.1.8 Closed Alpha",
    sections: [
      {
        title: "Highlights",
        items: [
          {
            label: "Invalid JSON read-only mode",
            description:
              "Broken generator JSON opens as raw text; save and graph edits blocked until fixed and reopened.",
          },
          {
            label: "Project Health",
            description:
              "Title-bar scan lists pack validation issues with open-in-editor shortcuts.",
          },
          {
            label: "Auto-download updates",
            description:
              "New alpha builds download in the background when auto-check is on; restart from the status bar.",
          },
          {
            label: "Signed updater",
            description:
              "Alpha.1+ users update in-app from releases/latest/download/latest.json.",
          },
        ],
      },
      {
        title: "Create Pack & editor",
        items: [
          {
            label: "Visual prefab picker",
            description:
              "Quick pick, category browse, search chips, and 3D preview — no scrolling 7k prefabs.",
          },
          {
            label: "Property field editors",
            description:
              "Structured editors for curves, switch cases, nested constants/colors, and imported refs.",
          },
          {
            label: "Preview settings sidebar",
            description:
              "Collapsible rail in split view — toolbar Settings button or edge chevron.",
          },
          {
            label: "Issues clipboard",
            description: "Copy all diagnostics to clipboard; click issues to jump to nodes.",
          },
        ],
      },
      {
        title: "Fixes",
        items: [
          {
            label: "Asset sync modal",
            description: "Failed sync no longer traps the UI behind a black backdrop.",
          },
          {
            label: "Bridge save paths",
            description: "Discovers your Hytale saves — no hardcoded developer defaults.",
          },
          {
            label: "Frame nodes",
            description: "Selectable nodes inside frames; fewer false dead-node warnings.",
          },
          {
            label: "Preview HUD drag",
            description: "Legend and timing overlay move with drag when anchored right/bottom.",
          },
        ],
      },
      {
        title: "Testing",
        items: [
          {
            label: "What to test modal",
            description:
              "Alpha checklist after onboarding — onboarding, pack wizard, preview, export, backup, bug reporter.",
          },
          {
            label: "Bug reporter v2",
            description:
              "Screenshots, file attachments, debug bundle v2, McCal-Codes GitHub prefills.",
          },
          {
            label: "Alpha guide",
            description: "docs/BETA_TESTING.md — install matrix, first-run steps, Gatekeeper notes.",
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
