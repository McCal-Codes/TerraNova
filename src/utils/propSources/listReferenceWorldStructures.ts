import { listTemplateBiomes, listHytaleReleaseBiomes, pathExists, type TemplateBiomeEntry } from "@/utils/ipc";
import { listPackWizardBundleTemplates } from "@/utils/ipc";

export interface ReferenceWorldStructureEntry {
  id: string;
  displayName: string;
  description: string;
  path: string;
  source: "template" | "hytale-release";
  group: string;
  biomeCount: number;
}

function worldStructurePathFromBiomePath(biomePath: string): string {
  const norm = biomePath.replace(/\\/g, "/");
  const match = /^(.*\/HytaleGenerator)\/Biomes\//i.exec(norm);
  if (match) return `${match[1]}/WorldStructures/MainWorld.json`;
  return norm.replace(/\/Biomes\/[^/]+\.json$/i, "/WorldStructures/MainWorld.json");
}

async function collectFromBiomeEntries(
  entries: TemplateBiomeEntry[],
  source: ReferenceWorldStructureEntry["source"],
): Promise<ReferenceWorldStructureEntry[]> {
  const byTemplate = new Map<string, TemplateBiomeEntry>();
  for (const entry of entries) {
    if (!byTemplate.has(entry.templateName)) {
      byTemplate.set(entry.templateName, entry);
    }
  }

  const results: ReferenceWorldStructureEntry[] = [];
  for (const entry of byTemplate.values()) {
    const wsPath = worldStructurePathFromBiomePath(entry.path);
    if (!(await pathExists(wsPath))) continue;
    results.push({
      id: `${source}:${entry.templateName}`,
      displayName: entry.displayName,
      description: `${source === "hytale-release" ? "Hytale release" : "Bundled template"} world structure`,
      path: wsPath,
      source,
      group: source === "hytale-release" ? "Hytale Release" : entry.displayName,
      biomeCount: 0,
    });
  }
  return results;
}

/** Merge bundled templates, hytale-release sync, and wizard bundle metadata. */
export async function listReferenceWorldStructureCatalog(): Promise<ReferenceWorldStructureEntry[]> {
  const [templates, release, bundles] = await Promise.all([
    listTemplateBiomes().catch(() => [] as TemplateBiomeEntry[]),
    listHytaleReleaseBiomes().catch(() => [] as TemplateBiomeEntry[]),
    listPackWizardBundleTemplates().catch(() => []),
  ]);

  const merged = new Map<string, ReferenceWorldStructureEntry>();

  for (const entry of [
    ...(await collectFromBiomeEntries(release, "hytale-release")),
    ...(await collectFromBiomeEntries(templates, "template")),
  ]) {
    merged.set(entry.path.toLowerCase(), entry);
  }

  for (const bundle of bundles) {
    if (!bundle.hasWorldStructure) continue;
    const existing = [...merged.values()].find((e) =>
      e.path.toLowerCase().includes(`/${bundle.id.toLowerCase()}/`.replace(/\\/g, "/")),
    );
    if (existing) {
      merged.set(existing.path.toLowerCase(), {
        ...existing,
        displayName: bundle.displayName,
        description: bundle.description,
      });
    }
  }

  return [...merged.values()].sort((a, b) => {
    const g = a.group.localeCompare(b.group);
    return g !== 0 ? g : a.displayName.localeCompare(b.displayName);
  });
}
