import type {
  BlockAssetIndex,
  GetModelBoxes,
  ModelIndexEntry,
  ResolvedBlockModel,
} from "./types";
import { resolveBlockTexture } from "./resolveTextureName";

const STRUCTURAL_TEMPLATES: Record<string, string> = {
  stairs: "Structures/Stairs/Stairs.blockymodel",
  stairs_corner_left: "Structures/Stairs/Stairs_Corner_Left.blockymodel",
  stairs_corner_right: "Structures/Stairs/Stairs_Corner_Right.blockymodel",
  stairs_inverted: "Structures/Stairs/Stairs.blockymodel",
  half_slab: "Structures/Base_Shapes/HalfBlock.blockymodel",
  quarter: "Structures/Base_Shapes/QuarterBlock.blockymodel",
  three_quarter: "Structures/Base_Shapes/ThreeQuarterBlock.blockymodel",
  pillar_base: "Structures/Pillars/Pillar_Base.blockymodel",
  pillar: "Structures/Pillars/Pillar_Middle.blockymodel",
};

function relDir(relPath: string): string {
  const i = relPath.lastIndexOf("/");
  return i >= 0 ? relPath.slice(0, i) : "";
}

function findModelTexture(relModelPath: string, index: BlockAssetIndex): string | null {
  const dir = relDir(relModelPath);
  const base = relModelPath.split("/").pop()?.replace(".blockymodel", "") ?? "";
  const key = (dir ? `${dir}/${base}` : base).toLowerCase();
  return index.modelTexIndex[key] ?? null;
}

function pickEntry(
  candidates: ModelIndexEntry[] | undefined,
  predicate?: (entry: ModelIndexEntry) => boolean,
): ModelIndexEntry | null {
  if (!candidates?.length) return null;
  if (predicate) {
    return candidates.find(predicate) ?? candidates[0] ?? null;
  }
  return candidates[0] ?? null;
}

function makeResult(
  match: ModelIndexEntry,
  index: BlockAssetIndex,
  getBoxes: GetModelBoxes,
  blockTexture?: string | null,
): ResolvedBlockModel {
  return {
    boxes: getBoxes(match.relPath, match.absPath),
    texturePath: findModelTexture(match.relPath, index),
    blockTexture: blockTexture ?? null,
    modelPath: match.relPath,
  };
}

function structuralResult(
  templateKey: string,
  index: BlockAssetIndex,
  getBoxes: GetModelBoxes,
  blockName: string,
): ResolvedBlockModel | null {
  const rel = STRUCTURAL_TEMPLATES[templateKey];
  if (!rel) return null;
  const candidates = index.modelIndex[rel.split("/").pop()?.replace(".blockymodel", "").toLowerCase() ?? ""];
  const entry = candidates?.find((c) => c.relPath === rel) ?? { relPath: rel, absPath: rel };
  const blockTexture = resolveBlockTexture(blockName, index.textureIndex);
  return {
    boxes: getBoxes(entry.relPath, entry.absPath),
    texturePath: null,
    blockTexture,
    modelPath: entry.relPath,
  };
}

/**
 * Resolve block name → model boxes + texture refs (seven strategies from Prefab Viewer).
 */
export function resolveBlockModel(
  blockName: string,
  index: BlockAssetIndex,
  getBoxes: GetModelBoxes,
): ResolvedBlockModel | null {
  let name = blockName.startsWith("*") ? blockName.slice(1) : blockName;
  const sdIdx = name.indexOf("_State_Definitions");
  if (sdIdx > 0) name = name.slice(0, sdIdx);
  const lower = name.toLowerCase();

  let result: ResolvedBlockModel | null = null;

  // Strategy 1: Furniture_<Theme>_<Item>
  if (lower.startsWith("furniture_")) {
    const rest = name.slice("Furniture_".length);
    const parts = rest.split("_");
    for (let i = 1; i <= Math.min(parts.length - 1, 3); i++) {
      const theme = parts.slice(0, i).join("_");
      const item = parts.slice(i).join("_");
      const themeFolder = index.decoThemes[theme.toLowerCase()];
      if (!themeFolder) continue;
      for (const modelKey of [item.toLowerCase(), item.replace(/_/g, "").toLowerCase()]) {
        const match = pickEntry(
          index.modelIndex[modelKey],
          (c) => c.relPath.toLowerCase().includes(themeFolder.toLowerCase()),
        );
        if (match) {
          result = makeResult(match, index, getBoxes);
          break;
        }
      }
      if (result) break;
    }
  }

  // Strategy 2: Bench_<Name>
  if (!result && lower.startsWith("bench_")) {
    const itemName = name.slice("Bench_".length);
    const match = pickEntry(
      index.modelIndex[itemName.toLowerCase()],
      (c) => c.relPath.startsWith("Benches/"),
    );
    if (match) result = makeResult(match, index, getBoxes);
  }

  // Strategy 3: Plant_<Name>
  if (!result && lower.startsWith("plant_")) {
    const rest = name.slice("Plant_".length);
    const match = pickEntry(
      index.modelIndex[rest.toLowerCase()],
      (c) => c.relPath.startsWith("Foliage/"),
    );
    if (match) result = makeResult(match, index, getBoxes);
  }

  // Strategy 4: Structural suffix templates
  if (!result) {
    const fenceMatch = lower.match(/_fence(?:_(.+))?$/);
    if (fenceMatch) {
      const variant = fenceMatch[1];
      const material = name.replace(/_Fence.*$/i, "").replace(/^Rock_/, "").replace(/^Wood_/, "");
      const fenceKey = variant ? `fence_${material}_${variant}`.toLowerCase() : `fence_${material}`.toLowerCase();
      let match = pickEntry(index.modelIndex[fenceKey], (c) => c.relPath.includes("Fences/"));
      if (!match) {
        const devKey = variant ? `dev_fence_${variant}`.toLowerCase() : "dev_fence";
        match = pickEntry(index.modelIndex[devKey], (c) => c.relPath.includes("Fences/"));
      }
      if (match) {
        result = {
          boxes: getBoxes(match.relPath, match.absPath),
          texturePath: null,
          blockTexture: resolveBlockTexture(name, index.textureIndex),
          modelPath: match.relPath,
        };
      }
    }

    if (!result && lower.includes("_stairs")) {
      let stairKey = "stairs";
      if (lower.includes("corner_left")) stairKey = "stairs_corner_left";
      else if (lower.includes("corner_right")) stairKey = "stairs_corner_right";
      result = structuralResult(stairKey, index, getBoxes, name);
    }

    if (!result && lower.includes("_half")) {
      result = structuralResult("half_slab", index, getBoxes, name);
    }
    if (!result && lower.includes("_quarter") && !lower.includes("three")) {
      result = structuralResult("quarter", index, getBoxes, name);
    }
    if (!result && lower.includes("_threequarter")) {
      result = structuralResult("three_quarter", index, getBoxes, name);
    }
    if (!result && lower.includes("_pillar")) {
      result = structuralResult(
        lower.includes("_base") ? "pillar_base" : "pillar",
        index,
        getBoxes,
        name,
      );
    }
  }

  // Strategy 5: Direct basename match
  if (!result) {
    const match = pickEntry(index.modelIndex[lower]);
    if (match) result = makeResult(match, index, getBoxes);
  }

  // Strategy 6: Strip material prefix
  if (!result) {
    for (const pfx of ["Rock_", "Wood_", "Soil_", "Crystal_", "Metal_", "Coral_"]) {
      if (!name.startsWith(pfx)) continue;
      const match = pickEntry(index.modelIndex[name.slice(pfx.length).toLowerCase()]);
      if (match) {
        result = makeResult(match, index, getBoxes);
        break;
      }
    }
  }

  // Strategy 7: Animation templates
  if (!result && (lower.includes("_door") || lower.includes("_chest") || lower.includes("_trapdoor"))) {
    let animType: string | null = null;
    if (lower.includes("_trapdoor")) animType = "Trapdoor";
    else if (lower.includes("_door")) animType = "Door";
    else if (lower.includes("_chest")) animType = "Chest";
    if (animType) {
      const match = pickEntry(
        index.modelIndex[animType.toLowerCase()],
        (c) => c.relPath.includes("Animations/"),
      );
      if (match) {
        result = {
          boxes: getBoxes(match.relPath, match.absPath),
          texturePath: null,
          blockTexture: resolveBlockTexture(name, index.textureIndex),
          modelPath: match.relPath,
        };
      }
    }
  }

  if (result && !result.texturePath && !result.blockTexture) {
    result.blockTexture = resolveBlockTexture(name, index.textureIndex);
  }

  return result;
}

export function resolveBlockModels(
  blockNames: string[],
  index: BlockAssetIndex,
  getBoxes: GetModelBoxes,
): Record<string, ResolvedBlockModel | null> {
  const out: Record<string, ResolvedBlockModel | null> = {};
  for (const name of blockNames) {
    out[name] = resolveBlockModel(name, index, getBoxes);
  }
  return out;
}
