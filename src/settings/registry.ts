import {
  SETTINGS_CATEGORIES,
  type AnySettingDefinition,
  type CategoryId,
  type CategoryMeta,
} from "./types";

export * from "./types";

export const CATEGORY_META: readonly CategoryMeta[] = [
  { id: "general", label: "General" },
  { id: "editor", label: "Editor" },
  { id: "performance", label: "Preview & performance", panelOwned: true },
  { id: "files", label: "Files & backups" },
  { id: "assets", label: "Hytale assets" },
  { id: "shortcuts", label: "Shortcuts", panelOwned: true },
  { id: "account", label: "Account", panelOwned: true },
  { id: "developer", label: "Developer", devOnly: true },
  { id: "updates", label: "Updates" },
  { id: "about", label: "About", panelOwned: true },
];

const CATEGORY_LABELS = new Map(CATEGORY_META.map((c) => [c.id, c.label]));

export function getCategoryLabel(id: CategoryId): string {
  return CATEGORY_LABELS.get(id) ?? id;
}

// ── Registration ──────────────────────────────────────────────────────────────

const registry = new Map<string, AnySettingDefinition>();

/**
 * Registers definitions. Called once per definitions module at import time.
 * Duplicate ids throw rather than silently overwriting — a duplicate means two
 * modules disagree about who owns a setting.
 */
export function registerSettings(defs: readonly AnySettingDefinition[]): void {
  for (const def of defs) {
    const existing = registry.get(def.id);
    if (existing) {
      throw new Error(`Duplicate setting id "${def.id}" (already registered by ${existing.category})`);
    }
    if (!SETTINGS_CATEGORIES.includes(def.category)) {
      throw new Error(`Setting "${def.id}" has unknown category "${def.category}"`);
    }
    registry.set(def.id, def);
  }
}

export function getAllSettings(): AnySettingDefinition[] {
  return [...registry.values()];
}

export function getById(id: string): AnySettingDefinition | undefined {
  return registry.get(id);
}

export function getByCategory(category: CategoryId): AnySettingDefinition[] {
  return getAllSettings().filter((d) => d.category === category);
}

/** Section slugs for a category, in registration order. */
export function getSections(category: CategoryId): string[] {
  const seen: string[] = [];
  for (const def of getByCategory(category)) {
    if (!seen.includes(def.section)) seen.push(def.section);
  }
  return seen;
}

// ── Modified / reset ──────────────────────────────────────────────────────────

/**
 * Structural equality for setting values. Handles the shapes actually stored:
 * primitives, string arrays, and plain records (svgExportSettings,
 * keybindingOverrides).
 */
export function valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  // Object.is separates 0 from -0. For a setting they are the same value, and
  // reporting "Modified" for a -0 against a 0 default would never clear.
  if (typeof a === "number" && typeof b === "number" && a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== "object") return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => valuesEqual(item, b[i]));
  }

  const aRec = a as Record<string, unknown>;
  const bRec = b as Record<string, unknown>;
  const aKeys = Object.keys(aRec);
  const bKeys = Object.keys(bRec);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(
    (key) => Object.prototype.hasOwnProperty.call(bRec, key) && valuesEqual(aRec[key], bRec[key]),
  );
}

/** True when a setting should be shown/searched in the current environment. */
export function isAvailable(def: AnySettingDefinition, developerMode: boolean): boolean {
  if (def.devOnly && !developerMode) return false;
  return def.available?.() ?? true;
}

export function isModified(def: AnySettingDefinition): boolean {
  return !valuesEqual(def.read(), def.defaultValue);
}

export function getModifiedSettings(): AnySettingDefinition[] {
  return getAllSettings().filter(isModified);
}

export function resetSetting(def: AnySettingDefinition): void {
  def.write(def.defaultValue);
}

export function resetCategory(category: CategoryId, developerMode = true): void {
  for (const def of getByCategory(category)) {
    if (isAvailable(def, developerMode)) resetSetting(def);
  }
}

export function resetAllSettings(): void {
  for (const def of getAllSettings()) resetSetting(def);
}

// ── Search ────────────────────────────────────────────────────────────────────

export const SEARCH_TOKENS = [
  "@modified",
  "@developer",
  "@experimental",
  "@advanced",
  "@restart",
  "@user",
  "@project",
] as const;

export type SearchToken = (typeof SEARCH_TOKENS)[number];

function isSearchToken(word: string): word is SearchToken {
  return (SEARCH_TOKENS as readonly string[]).includes(word);
}

interface IndexEntry {
  def: AnySettingDefinition;
  /** Lowercased, whitespace-joined haystack. Built once at module load. */
  haystack: string;
}

let index: IndexEntry[] | null = null;

function buildHaystack(def: AnySettingDefinition): string {
  return [
    def.label,
    def.description ?? "",
    def.id,
    def.id.replace(/[.]/g, " "),
    def.section,
    getCategoryLabel(def.category),
    ...(def.searchTerms ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

function getIndex(): IndexEntry[] {
  // Rebuilt when the registry has grown (definition modules import lazily in
  // tests); cheap because it is a pure string join over a few dozen entries.
  if (!index || index.length !== registry.size) {
    index = getAllSettings().map((def) => ({ def, haystack: buildHaystack(def) }));
  }
  return index;
}

export interface SearchOptions {
  /** When false, devOnly settings are excluded entirely. */
  developerMode?: boolean;
}

/**
 * Matches label, description, id, section, category and searchTerms.
 * Supports `@`-prefixed filter tokens, which compose with each other and with
 * free text: `@modified asset` means "modified settings mentioning asset".
 */
export function searchSettings(
  query: string,
  { developerMode = false }: SearchOptions = {},
): AnySettingDefinition[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const tokens = words.filter(isSearchToken);
  // Anything else starting with "@" is a mistyped filter. Treating it as free
  // text would match nothing and read as "no such setting" rather than "no such
  // filter", so unknown tokens are ignored and the rest of the query still runs.
  const terms = words.filter((w) => !w.startsWith("@"));

  if (!tokens.length && !terms.length) return [];

  return getIndex()
    .filter(({ def, haystack }) => {
      if (!isAvailable(def, developerMode)) return false;

      for (const token of tokens) {
        switch (token) {
          case "@modified":
            if (!isModified(def)) return false;
            break;
          case "@developer":
            if (!def.devOnly) return false;
            break;
          case "@experimental":
            if (!def.experimental) return false;
            break;
          case "@advanced":
            if (!def.advanced) return false;
            break;
          case "@restart":
            if (!def.requiresRestart) return false;
            break;
          case "@user":
            if (!def.scopes.includes("user")) return false;
            break;
          case "@project":
            if (!def.scopes.includes("project")) return false;
            break;
        }
      }

      return terms.every((term) => haystack.includes(term));
    })
    .map((entry) => entry.def);
}

/**
 * Empties the registry.
 *
 * Used by `registerAllSettings` to stay idempotent — Vite re-evaluates the
 * definitions module on every HMR update under src/settings, and a second
 * registration pass would otherwise throw on the first duplicate id and take
 * the running app down. Also used by tests that register in isolation.
 */
export function clearRegistry(): void {
  registry.clear();
  index = null;
}
