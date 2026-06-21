const PROP_SECTION_INDEX_RE = /\[(\d+)\]/;

/** Numeric index from a biome section key like `Props[2]`. */
export function parsePropSectionIndex(key: string): number {
  return Number.parseInt(PROP_SECTION_INDEX_RE.exec(key)?.[1] ?? "0", 10);
}

/** Compare `Props[i]` keys by numeric index (not lexicographic string order). */
export function comparePropSectionKeys(a: string, b: string): number {
  return parsePropSectionIndex(a) - parsePropSectionIndex(b);
}

/** Sort `Props[i]` keys in numeric index order. */
export function sortPropSectionKeys(keys: string[]): string[] {
  return [...keys].sort(comparePropSectionKeys);
}
