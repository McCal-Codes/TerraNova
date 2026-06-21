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

const CACHE_STORAGE_KEY = "terranova:releases-cache-v3";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let memoryCache: ReleaseData[] | null = null;
let memoryCacheKey: string | null = null;

function readMemoryCache(): ReleaseData[] | null {
  if (memoryCacheKey !== CACHE_STORAGE_KEY) {
    memoryCache = null;
    memoryCacheKey = CACHE_STORAGE_KEY;
  }
  return memoryCache;
}

function writeMemoryCache(releases: ReleaseData[]): ReleaseData[] {
  memoryCacheKey = CACHE_STORAGE_KEY;
  memoryCache = releases;
  return releases;
}

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

/** Strip common inline markdown for UI display (links, bold, code). */
export function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function isReleaseHeaderTitle(title: string): boolean {
  return /^\[?v?\d+\.\d+/.test(title) || title.length > 100;
}

function shouldSkipSectionTitle(title: string): boolean {
  const normalized = title.toLowerCase();
  return STRIPPED_SECTIONS.has(normalized) || isReleaseHeaderTitle(title);
}

/** Split markdown at `##` or `###` headings (title excludes the # prefix). */
function splitAtHeadingLevel(body: string, level: 2 | 3): { title: string; content: string }[] {
  const marker = "#".repeat(level);
  const regex = new RegExp(`^${marker}\\s+(.+)$`, "gm");
  const sections: { title: string; content: string }[] = [];
  const matches = [...body.matchAll(regex)];
  if (matches.length === 0) return [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const title = stripInlineMarkdown(match[1]?.trim() ?? "");
    const contentStart = (match.index ?? 0) + match[0].length;
    const contentEnd = i + 1 < matches.length ? matches[i + 1].index! : body.length;
    sections.push({ title, content: body.slice(contentStart, contentEnd).trim() });
  }
  return sections;
}

function appendSection(
  sections: ReleaseSection[],
  title: string,
  content: string,
): void {
  if (!title || shouldSkipSectionTitle(title)) return;
  const items = parseItems(content);
  if (items.length > 0) sections.push({ title, items });
}

// ── Markdown parser ────────────────────────────────────────────────────────────

/** @internal Exported for unit tests. */
export function parseReleaseBody(body: string): ReleaseSection[] {
  const sections: ReleaseSection[] = [];
  // Drop leading H1 release title (e.g. "# TerraNova Alpha Release")
  const text = body.trim().replace(/^#\s+[^\n]+\n*/m, "").trim();
  if (!text) return sections;

  const h2Sections = splitAtHeadingLevel(text, 2);
  if (h2Sections.length > 0) {
    for (const h2 of h2Sections) {
      const h3Sections = splitAtHeadingLevel(h2.content, 3);
      if (h3Sections.length > 0) {
        for (const h3 of h3Sections) {
          appendSection(sections, h3.title, h3.content);
        }
      } else {
        appendSection(sections, h2.title, h2.content);
      }
    }
    return sections;
  }

  for (const h3 of splitAtHeadingLevel(text, 3)) {
    appendSection(sections, h3.title, h3.content);
  }
  return sections;
}

/**
 * Parse list items from a section body. Ignores headings, blockquotes, and prose paragraphs.
 * Handles:
 *  - `- **Label** — Description`
 *  - `- Plain text`
 *  - `- [ ] Task item`
 */
function parseItems(content: string): { label: string; description: string }[] {
  const items: { label: string; description: string }[] = [];

  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/^#{1,6}\s/.test(line)) continue;
    if (/^>/.test(line)) continue;

    const isListLine = /^[-*]\s/.test(line);
    const isBoldLabelLine = /^\*\*.+\*\*\s*[—–\-:]/.test(line);
    if (!isListLine && !isBoldLabelLine) continue;

    const stripped = line.replace(/^[-*]\s+/, "");

    const taskMatch = stripped.match(/^\[[ xX]\]\s*(.+)$/);
    if (taskMatch) {
      items.push({ label: stripInlineMarkdown(taskMatch[1]), description: "" });
      continue;
    }

    const boldMatch = stripped.match(/^\*\*(.+?)\*\*\s*[—–\-:]\s*(.+)$/);
    if (boldMatch) {
      items.push({
        label: stripInlineMarkdown(boldMatch[1]),
        description: stripInlineMarkdown(boldMatch[2]),
      });
      continue;
    }

    items.push({ label: stripInlineMarkdown(stripped), description: "" });
  }
  return items;
}

// ── Fetcher ────────────────────────────────────────────────────────────────────

const RELEASES_URL = GITHUB_RELEASES_API;

/** Shown in What's New when GitHub has not published the alpha tag yet. */
function bundledAlphaRelease(): ReleaseData {
  return {
    version: "0.1.8-alpha.4",
    date: "Jun 21, 2026",
    name: "0.1.8 Closed Alpha",
    sections: [
      {
        title: "Highlights",
        items: [
          {
            label: "Atmosphere tab tint editing",
            description:
              "Tune SimplexNoise2D density and delimiter bands from the biome Atmosphere tab without opening the Tint graph.",
          },
          {
            label: "Preview fidelity honesty",
            description:
              "Fidelity badge scores only preview-path density nodes; approximated types show a named callout with Issues link.",
          },
          {
            label: "Launch & session polish",
            description:
              "Restore toasts on failure, empty-tree file reopen fix, License and Notice viewers in Settings.",
          },
          {
            label: "Voxel material legend",
            description:
              "Hide or show individual block materials from Voxel preview settings; mesh rebuilds without re-evaluating density.",
          },
        ],
      },
      {
        title: "Icons & navigation",
        items: [
          {
            label: "Semantic file tree icons",
            description:
              "Distinct Lucide icons for biomes, weather, environment, materials, world structures, and settings JSON.",
          },
          {
            label: "Referenced Assets icons",
            description: "Kind icons on Asset Tools referenced-asset rows beside status dots.",
          },
        ],
      },
      {
        title: "Onboarding & settings",
        items: [
          {
            label: "Session restore reliability",
            description:
              "Toasts when project or file restore fails; last file reopens even when the directory tree is empty.",
          },
          {
            label: "Getting Started link",
            description: "Onboarding Step 4 links Getting Started and mentions F1 in-editor docs.",
          },
          {
            label: "License & Notice",
            description: "Settings → About opens readable LICENSE and NOTICE modals.",
          },
          {
            label: "What's New sync",
            description: "Closing What's New from Settings marks the version seen.",
          },
        ],
      },
      {
        title: "Preview",
        items: [
          {
            label: "Material preview callout",
            description:
              "Warns when material stacks use passthrough nodes; points to Voxel preview on Terrain.",
          },
          {
            label: "GradientWarp approximated",
            description: "Included in approximated preview callout when on the evaluation path.",
          },
        ],
      },
      {
        title: "Testing",
        items: [
          {
            label: "What to test modal",
            description:
              "Expanded alpha.4 checklist — session restore, tint Atmosphere tab, fidelity callouts, legend toggles, legal viewers.",
          },
          {
            label: "Bug reporter v2",
            description:
              "Screenshots, file attachments, debug bundle v2, McCal-Codes GitHub prefills.",
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
  const cached = readMemoryCache();
  if (cached) return mergeBundledReleases(cached);

  // 2. localStorage cache (survives page reloads)
  const stored = readLocalStorageCache();
  if (stored) {
    return mergeBundledReleases(writeMemoryCache(stored));
  }

  // 3. Network fetch
  const res = await fetch(RELEASES_URL, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);

  const raw: GitHubRelease[] = await res.json();
  const releases = mergeBundledReleases(
    raw
      .filter((r) => !r.draft && !r.tag_name.toLowerCase().includes("alpha-channel"))
      .map(toReleaseData),
  );

  writeMemoryCache(releases);
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
