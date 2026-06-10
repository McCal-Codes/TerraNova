export interface JsonDiffSummary {
  equal: boolean;
  internalKeys: number;
  hytaleKeys: number;
  onlyInInternal: string[];
  onlyInHytale: string[];
}

function topLevelKeys(value: Record<string, unknown> | null): string[] {
  if (!value || typeof value !== "object") return [];
  return Object.keys(value).sort();
}

export function summarizeJsonDiff(
  internal: Record<string, unknown> | null,
  hytale: Record<string, unknown> | null,
): JsonDiffSummary {
  const a = topLevelKeys(internal);
  const b = topLevelKeys(hytale);
  const setA = new Set(a);
  const setB = new Set(b);
  const onlyInInternal = a.filter((k) => !setB.has(k));
  const onlyInHytale = b.filter((k) => !setA.has(k));
  const equal = JSON.stringify(internal) === JSON.stringify(hytale);
  return {
    equal,
    internalKeys: a.length,
    hytaleKeys: b.length,
    onlyInInternal,
    onlyInHytale,
  };
}
