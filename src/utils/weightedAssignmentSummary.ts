export interface WeightedAssignmentEntry {
  Weight?: number;
  Assignments?: Record<string, unknown>;
}

export interface WeightedPrefabPathEntry {
  Path?: string;
  Weight?: number;
}

export interface ColumnBlockEntry {
  Y?: number;
  Material?: unknown;
}

export function readMaterialSolid(material: unknown): string {
  return readSolidMaterial(material) ?? "";
}

function readSolidMaterial(material: unknown): string | null {
  if (typeof material === "string") return material;
  if (material && typeof material === "object" && "Solid" in (material as Record<string, unknown>)) {
    const solid = (material as { Solid?: unknown }).Solid;
    return typeof solid === "string" ? solid : null;
  }
  return null;
}

/** One-line summary for a WeightedAssignments[i] entry (Hytale shape). */
export function summarizeWeightedAssignmentEntry(entry: unknown): string {
  if (!entry || typeof entry !== "object") return "Invalid entry";
  const row = entry as WeightedAssignmentEntry;
  const weight = row.Weight ?? 1;
  const asgn = row.Assignments;
  if (!asgn || typeof asgn !== "object") {
    return `Weight ${weight} — empty assignment`;
  }

  const asgnType = (asgn.Type as string) ?? "Assignment";
  const prop = asgn.Prop as Record<string, unknown> | undefined;
  if (!prop || typeof prop !== "object") {
    return `Weight ${weight} — ${asgnType}`;
  }

  const propType = (prop.Type as string) ?? "Prop";
  if (propType === "Column") {
    const blocks = prop.ColumnBlocks as Array<{ Material?: unknown }> | undefined;
    const solids = (blocks ?? [])
      .map((b) => readSolidMaterial(b?.Material))
      .filter((s): s is string => !!s);
    const mat = solids[0] ?? "column";
    const extra = solids.length > 1 ? ` (+${solids.length - 1} blocks)` : "";
    return `Weight ${weight} — Column · ${mat}${extra}`;
  }

  if (propType === "Prefab") {
    const paths = prop.WeightedPrefabPaths as WeightedPrefabPathEntry[] | undefined;
    const singlePath = typeof prop.Path === "string" ? prop.Path : null;
    if (paths && paths.length > 0) {
      const first = paths[0]?.Path ?? "(no path)";
      const short = first.split("/").pop() ?? first;
      if (paths.length === 1) {
        return `Weight ${weight} — Prefab · ${short}`;
      }
      return `Weight ${weight} — Prefab · ${paths.length} variants · ${short}…`;
    }
    return `Weight ${weight} — Prefab · ${singlePath ?? "(no path)"}`;
  }

  if (propType === "Imported") {
    const name = typeof prop.Name === "string" ? prop.Name : null;
    return `Weight ${weight} — Imported · ${name ?? "?"}`;
  }

  return `Weight ${weight} — ${propType}`;
}

/** Normalize Hytale inline assignment notes and legacy delimiter keys. */
export function normalizeInlineAssignment(assignment: Record<string, unknown>): Record<string, unknown> {
  const next = { ...assignment };
  if (typeof next.$Comment === "string" && !next._comment) {
    next._comment = next.$Comment;
    delete next.$Comment;
  }
  return next;
}

/** Hytale uses `Assignments` (assignments) or `Assignment` (some exports). */
export function readDelimiterAssignment(
  delimiter: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (delimiter.Assignments && typeof delimiter.Assignments === "object") {
    return normalizeInlineAssignment(delimiter.Assignments as Record<string, unknown>);
  }
  if (delimiter.Assignment && typeof delimiter.Assignment === "object") {
    return normalizeInlineAssignment(delimiter.Assignment as Record<string, unknown>);
  }
  return undefined;
}

export function writeDelimiterAssignment(
  delimiter: Record<string, unknown>,
  assignment: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...delimiter };
  const usesSingular =
    delimiter.Assignment != null
    && typeof delimiter.Assignment === "object"
    && (delimiter.Assignments == null || typeof delimiter.Assignments !== "object");
  if (usesSingular) {
    next.Assignment = assignment;
    delete next.Assignments;
  } else {
    next.Assignments = assignment;
    delete next.Assignment;
  }
  return next;
}

export function delimiterUsesAssignmentBands(delimiters: unknown): boolean {
  if (!Array.isArray(delimiters) || delimiters.length === 0) return false;
  return delimiters.some((row) => {
    if (!row || typeof row !== "object") return false;
    const d = row as Record<string, unknown>;
    return readDelimiterAssignment(d) != null
      || ("Min" in d && "Max" in d && !("Material" in d));
  });
}

export function delimiterUsesMaterialBands(delimiters: unknown): boolean {
  if (!Array.isArray(delimiters) || delimiters.length === 0) return false;
  if (delimiterUsesAssignmentBands(delimiters)) return false;
  return delimiters.some((row) => {
    if (!row || typeof row !== "object") return false;
    const d = row as Record<string, unknown>;
    return "Material" in d && ("From" in d || "To" in d);
  });
}

export function isInternalMaterialFieldFunction(fields: Record<string, unknown>): boolean {
  return Array.isArray(fields.Materials)
    && Array.isArray(fields.DelimiterRanges)
    && fields.Materials.length > 0;
}

export function summarizeMaterialNode(material: unknown): string {
  if (typeof material === "string") return material;
  if (!material || typeof material !== "object") return "Material";
  const row = material as Record<string, unknown>;
  const type = (row.Type as string) ?? "Material";
  const solid = readMaterialSolid(row.Material ?? row);
  if (solid) return `${type} · ${solid}`;
  return type;
}

export function readFieldFunctionMaterialSolid(material: unknown): string {
  if (typeof material === "string") return material;
  if (!material || typeof material !== "object") return "";
  const row = material as Record<string, unknown>;
  if (row.Type === "Constant") {
    return readMaterialSolid(row.Material);
  }
  return readMaterialSolid(row);
}

export function writeFieldFunctionMaterialSolid(
  material: unknown,
  solid: string,
): Record<string, unknown> {
  if (material && typeof material === "object") {
    const row = { ...(material as Record<string, unknown>) };
    if (row.Type === "Constant") {
      const existing = row.Material;
      if (existing && typeof existing === "object") {
        row.Material = { ...(existing as Record<string, unknown>), Solid: solid, Fluid: "" };
      } else if (typeof existing === "string") {
        row.Material = solid;
      } else {
        row.Material = { Solid: solid, Fluid: "" };
      }
      return row;
    }
  }
  return { Type: "Constant", Material: { Solid: solid, Fluid: "" } };
}

export const DEFAULT_MATERIAL_DELIMITER = {
  From: 0,
  To: 25,
  Material: { Type: "Constant", Material: { Solid: "Rock_Stone", Fluid: "" } },
} as const;

/** Summary for inline Assignments on FieldFunction delimiters. */
export function summarizeAssignments(assignment: unknown): string {
  if (!assignment || typeof assignment !== "object") return "Empty assignment";
  const row = normalizeInlineAssignment(assignment as Record<string, unknown>);
  const type = (row.Type as string) ?? "Assignment";

  if (type === "Weighted") {
    const entries = Array.isArray(row.WeightedAssignments)
      ? (row.WeightedAssignments as unknown[])
      : [];
    const skip = typeof row.SkipChance === "number" ? row.SkipChance : 0;
    const first = entries[0] ? summarizeWeightedAssignmentEntry(entries[0]) : null;
    const detail = first?.replace(/^Weight \d+ — /, "") ?? "no entries";
    const skipNote = skip > 0 ? ` · skip ${Math.round(skip * 100)}%` : "";
    return `Weighted · ${entries.length} pick${entries.length === 1 ? "" : "s"}${skipNote} · ${detail}`;
  }

  if (type === "Constant") {
    const prop = row.Prop as Record<string, unknown> | undefined;
    if (!prop) return "Constant";
    return summarizeWeightedAssignmentEntry({ Weight: 1, Assignments: row }).replace(/^Weight 1 — /, "Constant · ");
  }

  if (type === "Imported") {
    const name = typeof row.Name === "string" ? row.Name : "?";
    return `Imported · ${name}`;
  }

  return type;
}

export function totalWeightedAssignmentWeight(entries: WeightedAssignmentEntry[]): number {
  return entries.reduce((sum, e) => sum + (typeof e.Weight === "number" ? e.Weight : 0), 0);
}

export function weightedAssignmentChance(
  entryWeight: number,
  total: number,
): number {
  if (total <= 0) return 0;
  return (entryWeight / total) * 100;
}

/** Read ColumnBlocks from a weighted entry's nested Prop. */
export function readColumnBlocks(entry: WeightedAssignmentEntry): ColumnBlockEntry[] {
  const prop = entry.Assignments?.Prop as Record<string, unknown> | undefined;
  if (!prop || prop.Type !== "Column") return [];
  const blocks = prop.ColumnBlocks;
  if (!Array.isArray(blocks)) return [];
  return [...(blocks as ColumnBlockEntry[])].sort(
    (a, b) => (typeof a.Y === "number" ? a.Y : 0) - (typeof b.Y === "number" ? b.Y : 0),
  );
}

/** Update ColumnBlocks on nested Column prop. */
export function writeColumnBlocks(
  entry: WeightedAssignmentEntry,
  blocks: ColumnBlockEntry[],
): WeightedAssignmentEntry {
  const asgn = { ...(entry.Assignments ?? { Type: "Constant" }) };
  const prop = { ...((asgn.Prop as Record<string, unknown>) ?? { Type: "Column" }) };
  prop.Type = "Column";
  prop.ColumnBlocks = blocks;
  asgn.Prop = prop;
  return { ...entry, Assignments: asgn };
}

export function readColumnBlockSolid(block: ColumnBlockEntry): string {
  return readMaterialSolid(block.Material);
}

export function writeColumnBlockSolid(block: ColumnBlockEntry, solid: string): ColumnBlockEntry {
  const material = block.Material;
  if (material && typeof material === "object") {
    return {
      ...block,
      Material: { ...(material as Record<string, unknown>), Solid: solid },
    };
  }
  return { ...block, Material: { Solid: solid } };
}

export function nextColumnBlockY(blocks: ColumnBlockEntry[]): number {
  if (blocks.length === 0) return 0;
  const maxY = blocks.reduce(
    (max, block) => Math.max(max, typeof block.Y === "number" ? block.Y : 0),
    0,
  );
  return maxY + 1;
}

export const DEFAULT_COLUMN_BLOCK: ColumnBlockEntry = {
  Y: 0,
  Material: { Solid: "Plant_Grass" },
};

/** Read primary Column block Solid id for simple edits. */
export function readColumnPrimarySolid(entry: WeightedAssignmentEntry): string {
  const blocks = readColumnBlocks(entry);
  return blocks.length > 0 ? readColumnBlockSolid(blocks[0]) : "";
}

/** Read WeightedPrefabPaths from a weighted entry's nested Prop. */
export function readWeightedPrefabPaths(entry: WeightedAssignmentEntry): WeightedPrefabPathEntry[] {
  const prop = entry.Assignments?.Prop as Record<string, unknown> | undefined;
  if (!prop || prop.Type !== "Prefab") return [];
  const paths = prop.WeightedPrefabPaths;
  return Array.isArray(paths) ? [...(paths as WeightedPrefabPathEntry[])] : [];
}

/** Update WeightedPrefabPaths on nested Prefab prop. */
export function writeWeightedPrefabPaths(
  entry: WeightedAssignmentEntry,
  paths: WeightedPrefabPathEntry[],
): WeightedAssignmentEntry {
  const asgn = { ...(entry.Assignments ?? { Type: "Constant" }) };
  const prop = { ...((asgn.Prop as Record<string, unknown>) ?? { Type: "Prefab" }) };
  prop.Type = "Prefab";
  prop.WeightedPrefabPaths = paths;
  asgn.Prop = prop;
  return { ...entry, Assignments: asgn };
}

/** Update first Column block Solid while preserving nested scanner/pattern data. */
export function writeColumnPrimarySolid(
  entry: WeightedAssignmentEntry,
  solid: string,
): WeightedAssignmentEntry {
  const blocks = readColumnBlocks(entry);
  if (blocks.length === 0) {
    return writeColumnBlocks(entry, [{ Y: 0, Material: { Solid: solid } }]);
  }
  const next = [...blocks];
  next[0] = writeColumnBlockSolid(next[0], solid);
  return writeColumnBlocks(entry, next);
}

export const DEFAULT_WEIGHTED_ASSIGNMENT_ENTRY: WeightedAssignmentEntry = {
  Weight: 1,
  Assignments: {
    Type: "Constant",
    Prop: {
      Type: "Column",
      Skip: false,
      ColumnBlocks: [{ Y: 0, Material: { Solid: "Plant_Grass" } }],
      Scanner: {
        Type: "ColumnLinear",
        Skip: false,
        MinY: 48,
        MaxY: 92,
        RelativeToPosition: false,
        TopDownOrder: true,
        ResultCap: 1,
      },
    },
  },
};

export const DEFAULT_ASSIGNMENT_DELIMITER: Record<string, unknown> = {
  Min: -1,
  Max: 1,
  Assignments: {
    Type: "Weighted",
    SkipChance: 0,
    Seed: "",
    WeightedAssignments: [structuredClone(DEFAULT_WEIGHTED_ASSIGNMENT_ENTRY)],
  },
};
