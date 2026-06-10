const SHAPE_SUFFIXES = [
  "_Roof_Steep", "_Roof_Shallow", "_Roof_Flat", "_Roof_Hollow", "_Roof",
  "_Stairs_Corner_Left", "_Stairs_Corner_Right", "_Stairs",
  "_Half", "_Quarter", "_ThreeQuarter",
  "_Fence_Corner", "_Fence_Platform", "_Fence",
  "_Beam", "_Wall_Corner", "_Wall", "_Pillar_Base", "_Pillar", "_Bars", "_Ladder",
  "_Door_Medium", "_Door", "_Platform", "_Window",
  "_Stalactite_Large", "_Stalactite_Medium", "_Stalactite_Small", "_Stalactite",
  "_Icicle_Large", "_Icicle_Medium", "_Icicle_Small", "_Icicle",
] as const;

const VARIANT_SUFFIXES = ["_Decorative", "_Ornate", "_Mossy", "_Smooth"] as const;

/** Resolve BlockTextures filename from block name (client-side fallback chain). */
export function resolveTextureName(
  blockName: string,
  textureIndex: Record<string, string>,
): string | null {
  let name = blockName.startsWith("*") ? blockName.slice(1) : blockName;
  const sdIdx = name.indexOf("_State_Definitions");
  if (sdIdx > 0) name = name.slice(0, sdIdx);

  const lower = name.toLowerCase();
  if (textureIndex[lower]) return textureIndex[lower];

  for (const suf of SHAPE_SUFFIXES) {
    if (name.endsWith(suf)) {
      const base = name.slice(0, -suf.length).toLowerCase();
      if (textureIndex[base]) return textureIndex[base];
    }
  }

  for (const v of VARIANT_SUFFIXES) {
    if (name.endsWith(v)) {
      const base = name.slice(0, -v.length).toLowerCase();
      if (textureIndex[base]) return textureIndex[base];
    }
  }

  let bestMatch: string | null = null;
  let bestLen = 0;
  for (const key of Object.keys(textureIndex)) {
    if (lower.startsWith(key) && key.length > bestLen) {
      bestMatch = textureIndex[key];
      bestLen = key.length;
    }
  }

  return bestMatch;
}

export function resolveBlockTexture(
  blockName: string,
  textureIndex: Record<string, string>,
): string | null {
  const file = resolveTextureName(blockName, textureIndex);
  return file ? `bt:${file}` : null;
}
