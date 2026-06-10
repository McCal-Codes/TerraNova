import {
  readColumnBlockSolid,
  type ColumnBlockEntry,
} from "./weightedAssignmentSummary";

export interface ColumnLinearScannerFields {
  MinY?: number;
  MaxY?: number;
  ResultCap?: number;
  TopDownOrder?: boolean;
  RelativeToPosition?: boolean;
}

function stripNodeIds<T extends Record<string, unknown>>(row: T): T {
  const { $NodeId: _, ...rest } = row;
  return rest as T;
}

/** Read column blocks from a Prop object (graph or inline Hytale shape). */
export function readPropColumnBlocks(prop: Record<string, unknown>): ColumnBlockEntry[] {
  if (Array.isArray(prop.ColumnBlocks)) {
    return [...(prop.ColumnBlocks as ColumnBlockEntry[])].sort(
      (a, b) => (typeof a.Y === "number" ? a.Y : 0) - (typeof b.Y === "number" ? b.Y : 0),
    );
  }
  if ("Height" in prop || "Material" in prop) {
    const y = typeof prop.Height === "number" ? prop.Height : 0;
    const material = prop.Material;
    if (typeof material === "string") {
      return [{ Y: y, Material: { Solid: material } }];
    }
    if (material && typeof material === "object") {
      return [{ Y: y, Material: stripNodeIds(material as Record<string, unknown>) }];
    }
    return [{ Y: y, Material: { Solid: "" } }];
  }
  return [];
}

/** Write column blocks back; single-block uses internal Height/Material when Y-only. */
export function writePropColumnBlocks(
  prop: Record<string, unknown>,
  blocks: ColumnBlockEntry[],
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...prop, Type: "Column" };
  if (blocks.length === 1) {
    const block = blocks[0];
    const y = typeof block.Y === "number" ? block.Y : 0;
    const solid = readColumnBlockSolid(block);
    next.Height = y;
    next.Material = solid;
    delete next.ColumnBlocks;
    return next;
  }
  next.ColumnBlocks = blocks;
  delete next.Height;
  delete next.Material;
  return next;
}

export function readPropColumnScanner(prop: Record<string, unknown>): ColumnLinearScannerFields | null {
  const scanner = prop.Scanner;
  if (!scanner || typeof scanner !== "object") return null;
  const row = scanner as Record<string, unknown>;
  if ((row.Type as string) !== "ColumnLinear") return null;
  return {
    MinY: typeof row.MinY === "number" ? row.MinY : undefined,
    MaxY: typeof row.MaxY === "number" ? row.MaxY : undefined,
    ResultCap: typeof row.ResultCap === "number" ? row.ResultCap : undefined,
    TopDownOrder: typeof row.TopDownOrder === "boolean" ? row.TopDownOrder : undefined,
    RelativeToPosition:
      typeof row.RelativeToPosition === "boolean" ? row.RelativeToPosition : undefined,
  };
}

export function writePropColumnScanner(
  prop: Record<string, unknown>,
  patch: ColumnLinearScannerFields,
): Record<string, unknown> {
  const existing = (prop.Scanner && typeof prop.Scanner === "object"
    ? prop.Scanner
    : { Type: "ColumnLinear", Skip: false }) as Record<string, unknown>;
  return {
    ...prop,
    Scanner: {
      ...existing,
      Type: "ColumnLinear",
      ...patch,
    },
  };
}

export function normalizeColumnBlocksForImport(
  blocks: Record<string, unknown>[],
): ColumnBlockEntry[] {
  return blocks.map((block) => {
    const next = stripNodeIds(block);
    if (next.Material && typeof next.Material === "object") {
      next.Material = stripNodeIds(next.Material as Record<string, unknown>);
    }
    return next as ColumnBlockEntry;
  });
}

export function shouldPreserveColumnBlocks(blocks: ColumnBlockEntry[]): boolean {
  if (blocks.length !== 1) return true;
  const only = blocks[0];
  const y = typeof only.Y === "number" ? only.Y : 0;
  const solids = blocks.map((b) => readColumnBlockSolid(b));
  return y !== 0 || solids.some((s, i) => i > 0 || !s);
}

/** Merge column prop edits and drop mutually exclusive Height/Material vs ColumnBlocks keys. */
export function mergeColumnPropFields(
  existing: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...existing, ...patch, Type: "Column" };
  if (Array.isArray(merged.ColumnBlocks) && merged.ColumnBlocks.length > 0) {
    delete merged.Height;
    delete merged.Material;
  } else {
    delete merged.ColumnBlocks;
  }
  return merged;
}
