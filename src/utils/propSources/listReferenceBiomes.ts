import type { TemplateBiomeEntry } from "@/utils/ipc";
import { listHytaleReleaseBiomes, listTemplateBiomes } from "@/utils/ipc";

export interface ReferenceBiomeCatalogEntry extends TemplateBiomeEntry {
  group: string;
  source: "hytale-release" | "template" | "reference";
}

function groupFromPath(path: string, templateName: string): string {
  if (templateName === "hytale-release") {
    const match = /HytaleGenerator\/Biomes\/([^/]+)/i.exec(path.replace(/\\/g, "/"));
    return match?.[1] ?? "Release";
  }
  if (templateName === "references") return "Community References";
  return templateName;
}

function sourceFromTemplateName(templateName: string): ReferenceBiomeCatalogEntry["source"] {
  if (templateName === "hytale-release") return "hytale-release";
  if (templateName === "references") return "reference";
  return "template";
}

/** Merge bundled templates, references, and synced Hytale release biomes. */
export async function listReferenceBiomeCatalog(): Promise<ReferenceBiomeCatalogEntry[]> {
  const [templates, release] = await Promise.all([
    listTemplateBiomes().catch(() => [] as TemplateBiomeEntry[]),
    listHytaleReleaseBiomes().catch(() => [] as TemplateBiomeEntry[]),
  ]);

  const merged = new Map<string, ReferenceBiomeCatalogEntry>();
  for (const entry of [...release, ...templates]) {
    const key = entry.path.toLowerCase();
    if (merged.has(key)) continue;
    merged.set(key, {
      ...entry,
      group: groupFromPath(entry.path, entry.templateName),
      source: sourceFromTemplateName(entry.templateName),
    });
  }

  return [...merged.values()].sort((a, b) => {
    const group = a.group.localeCompare(b.group);
    if (group !== 0) return group;
    return a.biomeName.localeCompare(b.biomeName);
  });
}
