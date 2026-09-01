import {
  DENSITY_BASICS_GALLERY_CASES,
  HYTALE_GALLERY_CASES,
  HYTALE_GALLERY_BIOME_PATHS,
  isHytaleGalleryCase,
  type GalleryCase,
} from "@/dev/shapePreviewGalleryCases";
import {
  isDevLabCategory,
  isSafeCacheRelativePath,
  type DevLabCase,
  type DevLabCaseCategory,
} from "./devLabTypes";

/**
 * The Dev Lab case registry.
 *
 * Existing shape-gallery cases are *adapted*, not duplicated — they remain the
 * source of truth in shapePreviewGalleryCases.ts, and this layer projects them
 * into the declarative registry shape. That keeps one definition per case while
 * the gallery migrates incrementally.
 *
 * Adding a new case should mean adding a fixture and one entry here, never
 * editing a Dev Lab component.
 */

/** Cases adapted from the existing synthetic density gallery. */
function adaptDensityBasics(): DevLabCase[] {
  return DENSITY_BASICS_GALLERY_CASES.map((caseId) => ({
    id: `gallery:${caseId}`,
    title: caseId,
    description: `Adapted from the shape preview gallery case "${caseId}".`,
    category: "Density" as DevLabCaseCategory,
    tags: ["gallery", "synthetic"],
    source: { kind: "synthetic" as const, setupId: caseId },
    preview: { mode: "2d" as const },
    expected: {
      summary: "Evaluates without error and produces a finite density field.",
      allowApproximation: true,
    },
  }));
}

/** Cases adapted from the Hytale reference biomes the gallery already knows about. */
function adaptHytaleCases(): DevLabCase[] {
  return HYTALE_GALLERY_CASES.filter(isHytaleGalleryCase).map((caseId) => {
    const relativePath = HYTALE_GALLERY_BIOME_PATHS[caseId as keyof typeof HYTALE_GALLERY_BIOME_PATHS];
    return {
      id: `gallery:${caseId}`,
      title: caseId,
      description: `Real Hytale biome from the managed asset cache.`,
      category: "Imported Assets" as DevLabCaseCategory,
      tags: ["gallery", "hytale"],
      source: {
        kind: "hytale-cache" as const,
        relativePath: relativePath ?? "",
        channel: "either" as const,
      },
      preview: { mode: "voxel" as const, materials: true },
      expected: {
        summary: "Loads from the synced cache, resolves imports, and evaluates.",
        allowApproximation: true,
      },
    };
  });
}

let cached: DevLabCase[] | null = null;

/** All registered cases. Adapted gallery cases first, then any hand-authored ones. */
export function getDevLabCases(): DevLabCase[] {
  if (!cached) {
    cached = [...adaptDensityBasics(), ...adaptHytaleCases(), ...HAND_AUTHORED_CASES];
  }
  return cached;
}

/** Reset the memo. Tests only. */
export function resetDevLabCaseCache(): void {
  cached = null;
}

/**
 * Hand-authored cases live here so they are reviewed as data.
 *
 * Intentionally empty at Phase 2: every case currently comes from the existing
 * gallery, so nothing is duplicated. New cases get appended here.
 */
export const HAND_AUTHORED_CASES: DevLabCase[] = [];

export function getDevLabCase(id: string): DevLabCase | undefined {
  return getDevLabCases().find((c) => c.id === id);
}

export function getDevLabCategories(): DevLabCaseCategory[] {
  const seen = new Set<DevLabCaseCategory>();
  for (const c of getDevLabCases()) seen.add(c.category);
  return [...seen];
}

export interface DevLabCaseFilter {
  search?: string;
  category?: DevLabCaseCategory | "all";
}

export function filterDevLabCases(cases: DevLabCase[], filter: DevLabCaseFilter): DevLabCase[] {
  const needle = filter.search?.trim().toLowerCase() ?? "";
  return cases.filter((c) => {
    if (filter.category && filter.category !== "all" && c.category !== filter.category) return false;
    if (!needle) return true;
    return (
      c.id.toLowerCase().includes(needle) ||
      c.title.toLowerCase().includes(needle) ||
      c.tags.some((t) => t.toLowerCase().includes(needle))
    );
  });
}

export interface RegistryProblem {
  caseId: string;
  message: string;
}

/**
 * Validate the registry itself.
 *
 * Runs as a test rather than at import time so a malformed case is a build
 * failure with a useful message instead of a blank Dev Lab.
 */
export function validateDevLabRegistry(cases: DevLabCase[] = getDevLabCases()): RegistryProblem[] {
  const problems: RegistryProblem[] = [];
  const seen = new Set<string>();

  for (const c of cases) {
    if (seen.has(c.id)) problems.push({ caseId: c.id, message: "duplicate case id" });
    seen.add(c.id);

    if (!c.title.trim()) problems.push({ caseId: c.id, message: "empty title" });
    if (!isDevLabCategory(c.category)) {
      problems.push({ caseId: c.id, message: `unknown category "${c.category}"` });
    }
    if (!c.expected.summary.trim()) {
      problems.push({ caseId: c.id, message: "expected.summary is required" });
    }
    if (c.expected.requiredNodeTypes && c.expected.requiredNodeTypes.length === 0) {
      problems.push({ caseId: c.id, message: "requiredNodeTypes present but empty" });
    }
    if (c.source.kind === "hytale-cache" && !isSafeCacheRelativePath(c.source.relativePath)) {
      problems.push({
        caseId: c.id,
        message: `unsafe or empty cache path "${c.source.relativePath}"`,
      });
    }
    if (!["2d", "3d", "voxel"].includes(c.preview.mode)) {
      problems.push({ caseId: c.id, message: `invalid preview mode "${c.preview.mode}"` });
    }
    for (const [key, value] of Object.entries(c.preview)) {
      if (typeof value === "number" && !Number.isFinite(value)) {
        problems.push({ caseId: c.id, message: `preview.${key} is not finite` });
      }
    }
  }

  return problems;
}

/** The gallery case id behind an adapted entry, for the compatibility layer. */
export function galleryCaseIdOf(devLabCase: DevLabCase): GalleryCase | null {
  if (!devLabCase.id.startsWith("gallery:")) return null;
  return devLabCase.id.slice("gallery:".length) as GalleryCase;
}
