import type { HytaleComment, HytaleGroup, ImportMetadata } from "@/utils/hytaleToInternal";

/** TerraNova biome tab keys in canonical export / layout order. */
export const BIOME_SECTION_ORDER = [
  "Terrain",
  "MaterialProvider",
  "EnvironmentProvider",
  "TintProvider",
] as const;

const SECTION_NAME_ALIASES: Record<string, string[]> = {
  Terrain: ["terrain"],
  MaterialProvider: ["materials", "material", "solidity"],
  EnvironmentProvider: ["environment", "weather", "atmosphere", "env"],
  TintProvider: ["tint", "color"],
};

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function propSectionKeys(sectionKeys: string[]): string[] {
  return sectionKeys
    .filter((key) => key.startsWith("Props["))
    .sort((a, b) => {
      const ai = Number.parseInt(/\[(\d+)\]/.exec(a)?.[1] ?? "0", 10);
      const bi = Number.parseInt(/\[(\d+)\]/.exec(b)?.[1] ?? "0", 10);
      return ai - bi;
    });
}

/**
 * Discover biome section tab keys present in a wrapper without building graphs.
 */
export function discoverBiomeSectionKeys(wrapper: Record<string, unknown>): string[] {
  const keys: string[] = [];

  const terrain = wrapper.Terrain as Record<string, unknown> | undefined;
  const density = terrain?.Density;
  if (density && typeof density === "object" && "Type" in (density as Record<string, unknown>)) {
    keys.push("Terrain");
  }

  const matProvider = wrapper.MaterialProvider;
  if (matProvider && typeof matProvider === "object" && "Type" in (matProvider as Record<string, unknown>)) {
    keys.push("MaterialProvider");
  }

  if (Array.isArray(wrapper.Props)) {
    for (let i = 0; i < wrapper.Props.length; i++) {
      keys.push(`Props[${i}]`);
    }
  }

  const environmentProvider = wrapper.EnvironmentProvider;
  if (
    environmentProvider &&
    typeof environmentProvider === "object" &&
    "Type" in (environmentProvider as Record<string, unknown>)
  ) {
    keys.push("EnvironmentProvider");
  }

  const tintProvider = wrapper.TintProvider;
  if (tintProvider && typeof tintProvider === "object" && "Type" in (tintProvider as Record<string, unknown>)) {
    keys.push("TintProvider");
  }

  return keys;
}

export function biomeSectionSortOrder(sectionKeys: string[]): string[] {
  const fixed = BIOME_SECTION_ORDER.filter((key) => sectionKeys.includes(key));
  const fixedSet = new Set<string>(fixed);
  const props = propSectionKeys(sectionKeys);
  const propsSet = new Set(props);
  const rest = sectionKeys.filter(
    (key) => !fixedSet.has(key) && !propsSet.has(key),
  );
  return [...fixed, ...props, ...rest];
}

/** Minimum $Nodes hits inside a frame before spatial routing overrides a weak name match. */
export const SPATIAL_ROUTE_MIN_HITS = 2;

function collectNodeIdsFromAsset(asset: unknown, ids: Set<string>): void {
  if (!asset || typeof asset !== "object") return;
  if (Array.isArray(asset)) {
    for (const item of asset) collectNodeIdsFromAsset(item, ids);
    return;
  }
  const record = asset as Record<string, unknown>;
  if (typeof record.$NodeId === "string") {
    ids.add(record.$NodeId);
  }
  for (const value of Object.values(record)) {
    collectNodeIdsFromAsset(value, ids);
  }
}

/**
 * Map each TerraNova biome tab to the Hytale $NodeId set in that JSON subtree.
 * Used to route community frame labels by canvas overlap instead of title guessing.
 */
export function collectBiomeSectionNodeIds(
  wrapper: Record<string, unknown>,
): Record<string, Set<string>> {
  const sectionNodeIds: Record<string, Set<string>> = {};

  const terrain = wrapper.Terrain as Record<string, unknown> | undefined;
  const density = terrain?.Density;
  if (density && typeof density === "object" && "Type" in (density as Record<string, unknown>)) {
    const ids = new Set<string>();
    collectNodeIdsFromAsset(density, ids);
    sectionNodeIds.Terrain = ids;
  }

  const matProvider = wrapper.MaterialProvider;
  if (matProvider && typeof matProvider === "object" && "Type" in (matProvider as Record<string, unknown>)) {
    const ids = new Set<string>();
    collectNodeIdsFromAsset(matProvider, ids);
    sectionNodeIds.MaterialProvider = ids;
  }

  if (Array.isArray(wrapper.Props)) {
    for (let i = 0; i < wrapper.Props.length; i++) {
      const ids = new Set<string>();
      collectNodeIdsFromAsset(wrapper.Props[i], ids);
      sectionNodeIds[`Props[${i}]`] = ids;
    }
  }

  const environmentProvider = wrapper.EnvironmentProvider;
  if (
    environmentProvider &&
    typeof environmentProvider === "object" &&
    "Type" in (environmentProvider as Record<string, unknown>)
  ) {
    const ids = new Set<string>();
    collectNodeIdsFromAsset(environmentProvider, ids);
    sectionNodeIds.EnvironmentProvider = ids;
  }

  const tintProvider = wrapper.TintProvider;
  if (tintProvider && typeof tintProvider === "object" && "Type" in (tintProvider as Record<string, unknown>)) {
    const ids = new Set<string>();
    collectNodeIdsFromAsset(tintProvider, ids);
    sectionNodeIds.TintProvider = ids;
  }

  return sectionNodeIds;
}

function countNodesInGroup(
  group: HytaleGroup,
  nodeIds: Set<string>,
  nodePositions: Record<string, { x: number; y: number }>,
): number {
  let count = 0;
  for (const id of nodeIds) {
    const pos = nodePositions[id];
    if (pos && groupContainsPoint(group, pos.x, pos.y)) {
      count++;
    }
  }
  return count;
}

/**
 * Route a Hytale $Groups frame to a TerraNova biome tab.
 * Community mods use fine labels ("Grass", "Crystal Roof") — spatial overlap is primary.
 */
export function routeGroupToSection(
  group: HytaleGroup,
  sectionKeys: string[],
  sectionNodeIds: Record<string, Set<string>>,
  nodePositions: Record<string, { x: number; y: number }>,
): string {
  const fallback = sectionKeys[0] ?? "Terrain";
  const nameSection = matchSectionForGroupName(group.name, sectionKeys);

  let bestSection: string | null = null;
  let bestCount = 0;
  const counts: { section: string; count: number }[] = [];

  for (const section of sectionKeys) {
    const ids = sectionNodeIds[section];
    if (!ids) continue;
    const count = countNodesInGroup(group, ids, nodePositions);
    counts.push({ section, count });
    if (count > bestCount) {
      bestCount = count;
      bestSection = section;
    }
  }

  if (bestCount >= SPATIAL_ROUTE_MIN_HITS && bestSection) {
    const tied = counts.filter((entry) => entry.count === bestCount);
    if (tied.length === 1) return bestSection;
    if (nameSection && tied.some((entry) => entry.section === nameSection)) return nameSection;
    return bestSection;
  }

  if (nameSection) return nameSection;

  if (bestCount > 0 && bestSection) return bestSection;

  return fallback;
}

function matchSectionForGroupName(name: string, sectionKeys: string[]): string | null {
  const norm = normalizeLabel(name);
  if (!norm) return null;

  for (const section of BIOME_SECTION_ORDER) {
    if (!sectionKeys.includes(section)) continue;
    const aliases = SECTION_NAME_ALIASES[section] ?? [];
    if (aliases.some((alias) => norm === alias || norm.includes(alias))) {
      return section;
    }
  }

  const props = propSectionKeys(sectionKeys);
  if (props.length > 0) {
    if (norm.includes("position") || norm.includes("assignment") || norm.includes("prop")) {
      const indexMatch = norm.match(/prop(?:s)?\s*(\d+)/);
      if (indexMatch) {
        const key = `Props[${Number.parseInt(indexMatch[1], 10) - 1}]`;
        if (sectionKeys.includes(key)) return key;
      }
      return props[0];
    }
  }

  return null;
}

function annotationCenter(annotation: { x: number; y: number; width: number; height: number }) {
  return {
    x: annotation.x + annotation.width / 2,
    y: annotation.y + annotation.height / 2,
  };
}

function groupContainsPoint(group: HytaleGroup, x: number, y: number): boolean {
  return (
    x >= group.x
    && x <= group.x + group.width
    && y >= group.y
    && y <= group.y + group.height
  );
}

function matchSectionForComment(
  comment: HytaleComment,
  groups: HytaleGroup[],
  sectionKeys: string[],
  sectionNodeIds: Record<string, Set<string>>,
  nodePositions: Record<string, { x: number; y: number }>,
  fallback: string,
): string {
  const { x, y } = annotationCenter(comment);
  for (const group of groups) {
    if (!groupContainsPoint(group, x, y)) continue;
    return routeGroupToSection(group, sectionKeys, sectionNodeIds, nodePositions);
  }
  return fallback;
}

export interface SectionAnnotationSlice {
  hytaleComments: HytaleComment[];
  hytaleGroups: HytaleGroup[];
}

function emptySlice(): SectionAnnotationSlice {
  return { hytaleComments: [], hytaleGroups: [] };
}

/**
 * Split one Hytale $NodeEditorMetadata annotation set across TerraNova biome tabs.
 * Hytale uses a single canvas; TerraNova uses per-field section graphs.
 */
export function splitImportMetadataBySection(
  metadata: ImportMetadata,
  sectionKeys: string[],
  wrapper?: Record<string, unknown> | null,
): Map<string, SectionAnnotationSlice> {
  const slices = new Map<string, SectionAnnotationSlice>();
  for (const key of sectionKeys) {
    slices.set(key, emptySlice());
  }

  const fallback = sectionKeys[0] ?? "Terrain";
  const sectionNodeIds = wrapper ? collectBiomeSectionNodeIds(wrapper) : {};
  const nodePositions = metadata.nodePositions ?? {};

  for (const group of metadata.hytaleGroups) {
    const section = wrapper
      ? routeGroupToSection(group, sectionKeys, sectionNodeIds, nodePositions)
      : (matchSectionForGroupName(group.name, sectionKeys) ?? fallback);
    slices.get(section)?.hytaleGroups.push(group);
  }

  for (const comment of metadata.hytaleComments) {
    const section = matchSectionForComment(
      comment,
      metadata.hytaleGroups,
      sectionKeys,
      sectionNodeIds,
      nodePositions,
      fallback,
    );
    slices.get(section)?.hytaleComments.push(comment);
  }

  return slices;
}

export function sectionImportMetadata(
  base: ImportMetadata | null | undefined,
  slice: SectionAnnotationSlice | undefined,
): ImportMetadata | null {
  if (!slice || (slice.hytaleComments.length === 0 && slice.hytaleGroups.length === 0)) {
    return null;
  }

  return {
    comments: base?.comments ?? {},
    nodeIds: base?.nodeIds ?? {},
    nodePositions: base?.nodePositions ?? {},
    nodeEditorMetadata: base?.nodeEditorMetadata,
    hytaleComments: slice.hytaleComments,
    hytaleGroups: slice.hytaleGroups,
  };
}
