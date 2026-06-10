import type { ReactFlowInstance, Edge } from "@xyflow/react";
import { AssetCategory, CATEGORY_COLORS } from "@/schema/types";
import { getDensityAccentColor } from "@/schema/densitySubcategories";
import { getHandles, HANDLE_REGISTRY } from "@/nodes/handleRegistry";
import { resolveCompoundHandles } from "@/nodes/shared/resolveCompoundHandles";
import { HEADER_H, ROW_H, handleTop } from "@/nodes/shared/nodeLayout";
import { INPUT_HANDLE_COLOR, getHandleColor } from "@/nodes/shared/handles";
import type { HandleDef } from "@/nodes/shared/handles";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useToastStore } from "@/stores/toastStore";
import { getLanguageHelpers } from "@/languages/useLanguage";
import type { FlowDirection } from "@/constants";
import { isTauriRuntime } from "@/utils/platform";
import { getNodeFields, type FieldDef } from "@/schema/schemaLoader";
import { formatRange, formatVec3 } from "@/nodes/shared/formatters";
import { safeDisplay } from "@/nodes/shared/displayUtils";
import { isAuthorNoteText, stripAuthorNotePrefix } from "@/utils/annotationUtils";
import { rasterizeSvgToPngBlob as rasterizeSvgToPngBlobImpl } from "./exportSvgRasterize";

export { rasterizeSvgToPngBlob } from "./exportSvgRasterize";

const FIELD_LABEL_SHORT: Record<string, string> = {
  Frequency: "Freq",
  Amplitude: "Amp",
  Lacunarity: "Lac",
  Persistence: "Persist",
  Octaves: "Oct",
  Scale: "Scale",
  Seed: "Seed",
};

const ASSET_REF_FIELD_TYPES = new Set([
  "curveRef", "CurveAsset", "PatternAsset", "PositionProviderAsset",
  "VectorProviderAsset", "object",
]);

// ── Public types ──────────────────────────────────────────────────────────

export type SvgExportScope = "full" | "viewport" | "selection";
export type SvgExportMode = "presentation" | "debug";
export type SvgExportBackground = "dark" | "light" | "transparent";
/** Match editor canvas flow, or force left-to-right / right-to-left handle layout. */
export type SvgExportFlowDirection = "canvas" | FlowDirection;
export type SvgExportResolution = 1920 | 3840;

export interface SvgNodeTheme {
  nodeBg: string;
  nodeBorder: string;
  handleZoneBg: string;
  textMuted: string;
  textValue: string;
  debugIdText: string;
  edgeFallback: string;
  edgeOpacity: string;
}

const DARK_NODE_THEME: SvgNodeTheme = {
  nodeBg: "#262320",
  nodeBorder: "#3d3a36",
  handleZoneBg: "#2e2c28",
  textMuted: "#b8b4ac",
  textValue: "#e4e0d8",
  debugIdText: "#ffffff",
  edgeFallback: "#666666",
  edgeOpacity: "0.6",
};

const LIGHT_NODE_THEME: SvgNodeTheme = {
  nodeBg: "#ffffff",
  nodeBorder: "#c8c4bc",
  handleZoneBg: "#f0eeea",
  textMuted: "#5c584f",
  textValue: "#2a2824",
  debugIdText: "#8a8478",
  edgeFallback: "#7a756c",
  edgeOpacity: "0.75",
};

export function getSvgNodeTheme(background: SvgExportBackground): SvgNodeTheme {
  return background === "light" || background === "transparent"
    ? LIGHT_NODE_THEME
    : DARK_NODE_THEME;
}

export function resolveSvgExportFlowDirection(
  option: SvgExportFlowDirection,
  canvasFlow: FlowDirection,
): FlowDirection {
  return option === "canvas" ? canvasFlow : option;
}

export interface SvgExportSettings {
  scope: SvgExportScope;
  background: SvgExportBackground;
  showGrid: boolean;
  includeAnnotations: boolean;
  mode: SvgExportMode;
  padding: number;
  flowDirection: SvgExportFlowDirection;
  resolution: SvgExportResolution;
}

export type SvgExportOptions = SvgExportSettings;

export const DEFAULT_SVG_EXPORT_SETTINGS: SvgExportSettings = {
  scope: "full",
  background: "dark",
  showGrid: false,
  includeAnnotations: false,
  mode: "presentation",
  padding: 40,
  flowDirection: "canvas",
  resolution: 3840,
};

export interface SvgExportStats {
  width: number;
  height: number;
  nodeCount: number;
  edgeCount: number;
  annotationCount: number;
}

export const SVG_EXPORT_LARGE_NODE_COUNT = 150;
export const SVG_EXPORT_LARGE_WIDTH = 3200;

export function isLargeSvgExport(stats: SvgExportStats): boolean {
  return (
    stats.nodeCount >= SVG_EXPORT_LARGE_NODE_COUNT ||
    stats.width >= SVG_EXPORT_LARGE_WIDTH ||
    stats.height >= SVG_EXPORT_LARGE_WIDTH
  );
}

function formatCount(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function formatSvgExportStatsLine(stats: SvgExportStats): string {
  const parts = [
    `${stats.width} × ${stats.height} px`,
    formatCount(stats.nodeCount, "node", "nodes"),
    formatCount(stats.edgeCount, "edge", "edges"),
  ];
  if (stats.annotationCount > 0) {
    parts.push(formatCount(stats.annotationCount, "note", "notes"));
  }
  return parts.join(" · ");
}

const SVG_BACKGROUNDS: Record<
  SvgExportBackground,
  { fill: string | null; gridStroke: string }
> = {
  dark: { fill: "#1c1a17", gridStroke: "#333333" },
  light: { fill: "#f5f4f0", gridStroke: "#d4d0c8" },
  transparent: { fill: null, gridStroke: "#c8c4bc" },
};

export function parseSvgExportStats(svg: string): SvgExportStats | null {
  const width = Number(svg.match(/\bwidth="(\d+)"/)?.[1]);
  const height = Number(svg.match(/\bheight="(\d+)"/)?.[1]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;

  const edgesBlock = svg.match(/<g class="edges">([\s\S]*?)<\/g>/)?.[1] ?? "";
  return {
    width,
    height,
    // Each exported node root group uses the shadow filter; non-greedy </g> would under-count.
    nodeCount: (svg.match(/filter="url\(#shadow\)"/g) ?? []).length,
    edgeCount: (edgesBlock.match(/<path /g) ?? []).length,
    annotationCount: (svg.match(/data-tn-annotation="/g) ?? []).length,
  };
}

// ── Constants ─────────────────────────────────────────────────────────────

const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
const COMMENT_COLOR = "#e8d44d";
const COMMENT_BG = "rgba(232, 212, 77, 0.12)";
const COMMENT_BORDER = "rgba(232, 212, 77, 0.5)";
const AUTHOR_NOTE_COLOR = "#7dcfff";
const AUTHOR_NOTE_BG = "rgba(125, 207, 255, 0.12)";
const AUTHOR_NOTE_BORDER = "rgba(125, 207, 255, 0.5)";
const FRAME_COLOR = "#4a7fa5";
const FRAME_BG = "rgba(74, 127, 165, 0.07)";
const FRAME_BORDER = "rgba(74, 127, 165, 0.35)";
const ROOT_COLOR = "#8B4450";
const GROUP_COLOR_START = "#6B5B3E";
const GROUP_COLOR_END = "#8B7355";
const HANDLE_RADIUS = 7;
const HANDLE_STROKE_COLOR = "#000000";
const HANDLE_STROKE_OPACITY = "0.4";
const GRID_SIZE = 20;
const DEFAULT_NODE_W = 220;
const ROOT_BODY_H = 36;
const GROUP_FOOTER_H = 24;
const GROUP_EMPTY_BODY_H = 28;
/** Intrinsic pixel width for exported SVG (viewBox scales to fit). */
const SVG_EXPORT_TARGET_WIDTH = 3840;

function fmtSvgNum(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

interface SvgClipRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function pointInClipRect(p: { x: number; y: number }, rect: SvgClipRect): boolean {
  return p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom;
}

/** Clip an external wire endpoint to the nearest point on the export rectangle boundary. */
function clipEndpointToRect(
  anchor: { x: number; y: number },
  endpoint: { x: number; y: number },
  rect: SvgClipRect,
): { x: number; y: number } {
  if (pointInClipRect(endpoint, rect)) return endpoint;

  const dx = endpoint.x - anchor.x;
  const dy = endpoint.y - anchor.y;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return endpoint;

  const hits: { t: number; x: number; y: number }[] = [];
  if (Math.abs(dx) > 1e-9) {
    for (const xEdge of [rect.left, rect.right]) {
      const t = (xEdge - anchor.x) / dx;
      const y = anchor.y + t * dy;
      if (y >= rect.top && y <= rect.bottom && t > 1e-6) {
        hits.push({ t, x: xEdge, y });
      }
    }
  }
  if (Math.abs(dy) > 1e-9) {
    for (const yEdge of [rect.top, rect.bottom]) {
      const t = (yEdge - anchor.y) / dy;
      const x = anchor.x + t * dx;
      if (x >= rect.left && x <= rect.right && t > 1e-6) {
        hits.push({ t, x, y: yEdge });
      }
    }
  }

  if (hits.length === 0) return endpoint;
  hits.sort((a, b) => a.t - b.t);
  const hit = hits[0];
  return { x: hit.x, y: hit.y };
}

export function computeSvgOutputDimensions(
  viewBoxWidth: number,
  viewBoxHeight: number,
  targetWidth = SVG_EXPORT_TARGET_WIDTH,
): { width: number; height: number } {
  if (viewBoxWidth <= 0 || viewBoxHeight <= 0) {
    return { width: targetWidth, height: targetWidth };
  }
  if (viewBoxWidth >= viewBoxHeight) {
    return {
      width: targetWidth,
      height: Math.max(1, Math.round(targetWidth * (viewBoxHeight / viewBoxWidth))),
    };
  }
  return {
    width: Math.max(1, Math.round(targetWidth * (viewBoxWidth / viewBoxHeight))),
    height: targetWidth,
  };
}

export function sanitizeExportBaseName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\.+$/g, "");
  return cleaned || "graph";
}

export function resolveSvgExportBaseName(currentFile: string | null): string {
  if (!currentFile) return "graph";
  const leaf = currentFile.replace(/^.*[/\\]/, "");
  const stem = leaf.replace(/\.[^.]+$/, "");
  return sanitizeExportBaseName(stem);
}

export function resolveSvgExportFileName(
  baseName: string,
  scope: SvgExportScope,
  extension: "svg" | "png",
): string {
  const suffix =
    scope === "selection" ? "selection" : scope === "viewport" ? "viewport" : "graph";
  return `${baseName}-${suffix}.${extension}`;
}

export function getSelectedExportNodeIds(
  nodes: { id: string; type?: string; selected?: boolean }[],
  selectedNodeId: string | null,
): Set<string> {
  const selected = nodes.filter((n) => n.selected);
  if (selected.length === 0 && selectedNodeId) {
    const fallback = nodes.find((n) => n.id === selectedNodeId);
    if (fallback) selected.push(fallback);
  }
  return new Set(selected.map((n) => n.id));
}

const PREFIX_TO_CATEGORY: Record<string, AssetCategory> = {
  Curve: AssetCategory.Curve,
  Material: AssetCategory.MaterialProvider,
  Pattern: AssetCategory.Pattern,
  Position: AssetCategory.PositionProvider,
  Prop: AssetCategory.Prop,
  Scanner: AssetCategory.Scanner,
  Assignment: AssetCategory.Assignment,
  Vector: AssetCategory.VectorProvider,
  Environment: AssetCategory.EnvironmentProvider,
  Tint: AssetCategory.TintProvider,
  BlockMask: AssetCategory.BlockMask,
  Directionality: AssetCategory.Directionality,
  PropDistribution: AssetCategory.PropDistribution,
  Condition: AssetCategory.Condition,
  Layer: AssetCategory.Layer,
  PointGenerator: AssetCategory.PointGenerator,
  Terrain: AssetCategory.Terrain,
  CaveGenerator: AssetCategory.CaveGenerator,
  Generator: AssetCategory.Generator,
  Biome: AssetCategory.Biome,
  WorldStructure: AssetCategory.WorldStructure,
};

// ── Helpers ───────────────────────────────────────────────────────────────

function escXml(str: unknown): string {
  const text = str == null ? "" : String(str);
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getCategoryFromRfType(rfType: string): AssetCategory | null {
  const colonIdx = rfType.indexOf(":");
  if (colonIdx > 0) {
    return PREFIX_TO_CATEGORY[rfType.substring(0, colonIdx)] ?? null;
  }
  if (rfType === "Root" || rfType === "group") return null;
  return AssetCategory.Density;
}

/** Convert HSL to 6-digit hex string. */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Deterministic hash-based color for unknown/generic node types. */
function getGenericTypeColor(typeName: string): string {
  const KNOWN: Record<string, string> = {
    NoiseRange: "#5A6FA0",
    Constant: "#5B8DBF",
    SpaceAndDepth: "#C87D3A",
    DAOTerrain: "#4E9E8F",
  };
  if (KNOWN[typeName]) return KNOWN[typeName];
  let hash = 0;
  for (let i = 0; i < typeName.length; i++) {
    hash = typeName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hslToHex(Math.abs(hash) % 360, 40, 48);
}

function isLabelSignificant(label: string): boolean {
  if (label === "Input" || label === "Output") return false;
  if (/^Input \d+$/.test(label) || /^Output \d+$/.test(label)) return false;
  if (/^Input [A-Z]$/.test(label)) return false;
  if (/^Entry \d+$/.test(label)) return false;
  return true;
}

function formatExportFieldValue(value: unknown, def: FieldDef): string {
  if (def.type === "boolean" || typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (value && typeof value === "object" && "Min" in (value as Record<string, unknown>)) {
    return formatRange(value);
  }
  if (value && typeof value === "object" && !Array.isArray(value) && "x" in (value as Record<string, unknown>)) {
    return formatVec3(value);
  }
  if (Array.isArray(value) && value.length === 3 && (def.type === "vector3d" || def.type === "vector3i")) {
    return `(${value[0]}, ${value[1]}, ${value[2]})`;
  }
  if (def.name === "Material" || def.name === "Solid") {
    if (typeof value === "string" && value.length > 0) return value;
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      if (typeof obj.Solid === "string") return obj.Solid;
      if (typeof obj.Material === "string") return obj.Material;
    }
  }
  if (Array.isArray(value)) return `${value.length} items`;
  if (value == null && Array.isArray(def.default) && def.default.length === 3) {
    return `(${def.default[0]}, ${def.default[1]}, ${def.default[2]})`;
  }
  return String(safeDisplay(value, def.default != null ? safeDisplay(def.default) : "—"));
}

function resolveExportFields(
  typeKey: string,
  fields: Record<string, unknown>,
): { label: string; value: string }[] {
  const defs = getNodeFields(typeKey).filter((d) => !ASSET_REF_FIELD_TYPES.has(d.type));
  if (defs.length > 0) {
    return defs.map((def) => ({
      label: FIELD_LABEL_SHORT[def.name] ?? def.name,
      value: formatExportFieldValue(fields[def.name], def),
    }));
  }
  return Object.entries(fields)
    .filter(([, v]) => typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    .map(([key, value]) => ({
      label: FIELD_LABEL_SHORT[key] ?? key,
      value: typeof value === "boolean" ? (value ? "Yes" : "No") : String(value),
    }));
}

function exportHandleLabel(handle: HandleDef, index: number, multi: boolean): string {
  const base = handle.label || handle.id;
  if (!multi) return base;
  return isLabelSignificant(handle.label) ? `[${index}] ${base}` : `[${index}] ${base}`;
}

function computeNodeContentHeight(
  variant: NodeVariant,
  maxRows: number,
  fieldCount: number,
): number {
  const handleZoneH =
    variant === "group" && maxRows === 0
      ? GROUP_EMPTY_BODY_H
      : variant === "root"
        ? ROOT_BODY_H
        : maxRows * ROW_H;
  const fieldsH = variant !== "root" && variant !== "group" && fieldCount > 0
    ? fieldCount * 18 + 12
    : 0;
  const groupFooterH = variant === "group" ? GROUP_FOOTER_H : 0;
  return HEADER_H + handleZoneH + fieldsH + groupFooterH;
}

/** Discover handles for GenericNode (schema + edge-connected, mirrors GenericNode). */
function resolveGenericHandles(nodeId: string, edges: Edge[], dataType: string): HandleDef[] {
  const schemaHandles = getHandles(dataType);
  const schemaTargets = schemaHandles.filter((h) => h.type === "target");
  const schemaSources = schemaHandles.filter((h) => h.type === "source");

  const edgeOnlyTargets: HandleDef[] = [];
  const seen = new Set<string>();
  for (const e of edges) {
    if (e.target !== nodeId || !e.targetHandle || seen.has(e.targetHandle)) continue;
    seen.add(e.targetHandle);
    if (schemaTargets.some((h) => h.id === e.targetHandle)) continue;
    edgeOnlyTargets.push({
      id: e.targetHandle,
      label: e.targetHandle,
      type: "target",
      category: schemaTargets[0]?.category ?? schemaSources[0]?.category ?? AssetCategory.Density,
    });
  }

  const targets =
    schemaTargets.length > 0
      ? [...schemaTargets, ...edgeOnlyTargets]
      : edgeOnlyTargets.length > 0
        ? edgeOnlyTargets
        : [{ id: "input", label: "Input", type: "target" as const, category: AssetCategory.Density }];

  const sources =
    schemaSources.length > 0
      ? schemaSources
      : [{ id: "output", label: "Output", type: "source" as const, category: targets[0]?.category ?? AssetCategory.Density }];

  return [...targets, ...sources];
}

interface GroupExternalConnection {
  handleId: string;
  direction: "in" | "out";
}

/** Resolve group handles from collapsed group metadata, with edge fallback. */
function resolveGroupHandlesFromData(
  data: Record<string, unknown>,
  nodeId: string,
  edges: Edge[],
): HandleDef[] {
  const map = data.externalConnectionMap as GroupExternalConnection[] | undefined;
  if (Array.isArray(map) && map.length > 0) {
    return map.map((conn) => ({
      id: conn.handleId,
      label: conn.handleId,
      type: conn.direction === "in" ? ("target" as const) : ("source" as const),
      category: AssetCategory.Density,
    }));
  }
  return resolveGroupHandles(nodeId, edges);
}

/** Discover handles for GroupNode by inspecting edges. */
function resolveGroupHandles(nodeId: string, edges: Edge[]): HandleDef[] {
  const inHandles: HandleDef[] = [];
  const outHandles: HandleDef[] = [];
  const inIds = new Set<string>();
  const outIds = new Set<string>();
  for (const e of edges) {
    if (e.target === nodeId && e.targetHandle && !inIds.has(e.targetHandle)) {
      inIds.add(e.targetHandle);
      inHandles.push({ id: e.targetHandle, label: e.targetHandle, type: "target", category: AssetCategory.Density });
    }
    if (e.source === nodeId && e.sourceHandle && !outIds.has(e.sourceHandle)) {
      outIds.add(e.sourceHandle);
      outHandles.push({ id: e.sourceHandle, label: e.sourceHandle, type: "source", category: AssetCategory.Density });
    }
  }
  return [...inHandles, ...outHandles];
}

// ── Node render data ──────────────────────────────────────────────────────

type NodeVariant = "base" | "root" | "group" | "generic";

interface NodeRenderData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  variant: NodeVariant;
  headerColor: string;
  displayName: string;
  rawType: string;
  handles: HandleDef[];
  fields: { label: string; value: string }[];
  groupChildCount?: number;
  groupBodyText?: string;
}

interface AnnotationRenderData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: "comment" | "frame";
  title: string;
  body: string;
  isAuthorNote: boolean;
}

function isAnnotationNode(type: string | undefined): boolean {
  return type === "comment" || type === "frame";
}

function nodeIntersectsRect(
  x: number,
  y: number,
  width: number,
  height: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
): boolean {
  return x + width >= left && x <= right && y + height >= top && y <= bottom;
}

function computeNodesBounds(
  nodes: Array<{ x: number; y: number; width: number; height: number }>,
): SvgClipRect | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  if (!isFinite(minX)) return null;
  return { left: minX, top: minY, right: maxX, bottom: maxY };
}

function wrapSvgTextLines(text: string, maxChars: number, maxLines: number): string[] {
  const lines: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim();
    while (line.length > maxChars) {
      lines.push(line.slice(0, maxChars));
      line = line.slice(maxChars).trimStart();
      if (lines.length >= maxLines) return lines.slice(0, maxLines);
    }
    lines.push(line);
    if (lines.length >= maxLines) return lines.slice(0, maxLines);
  }
  return lines.slice(0, maxLines);
}

function renderAnnotationSvg(ann: AnnotationRenderData): string {
  const p: string[] = [];
  p.push(`<g data-tn-annotation="${ann.kind}" transform="translate(${ann.x}, ${ann.y})">`);

  if (ann.kind === "frame") {
    p.push(
      `<rect width="${ann.width}" height="${ann.height}" rx="8" fill="${FRAME_BG}" stroke="${FRAME_BORDER}" stroke-width="1" />`,
    );
    p.push(`<rect width="${ann.width}" height="28" rx="8" fill="${FRAME_COLOR}" fill-opacity="0.12" />`);
    p.push(`<line x1="0" y1="28" x2="${ann.width}" y2="28" stroke="${FRAME_BORDER}" stroke-width="1" />`);
    p.push(
      `<text x="10" y="18" font-family="${FONT}" font-size="11" font-weight="600" fill="${FRAME_COLOR}">${escXml(ann.title)}</text>`,
    );
  } else {
    const accent = ann.isAuthorNote ? AUTHOR_NOTE_COLOR : COMMENT_COLOR;
    const bg = ann.isAuthorNote ? AUTHOR_NOTE_BG : COMMENT_BG;
    const border = ann.isAuthorNote ? AUTHOR_NOTE_BORDER : COMMENT_BORDER;
    p.push(
      `<rect width="${ann.width}" height="${ann.height}" rx="6" fill="${bg}" stroke="${border}" stroke-width="1" />`,
    );
    p.push(`<rect width="${ann.width}" height="22" rx="6" fill="${accent}" fill-opacity="0.12" />`);
    p.push(`<line x1="0" y1="22" x2="${ann.width}" y2="22" stroke="${border}" stroke-width="1" />`);
    p.push(
      `<text x="8" y="14" font-family="${FONT}" font-size="10" font-weight="600" fill="${accent}">${escXml(ann.title)}</text>`,
    );
    const lines = wrapSvgTextLines(ann.body, 42, 8);
    for (let i = 0; i < lines.length; i++) {
      p.push(
        `<text x="8" y="${34 + i * 14}" font-family="${FONT}" font-size="10" fill="${accent}">${escXml(lines[i])}</text>`,
      );
    }
  }

  p.push(`</g>`);
  return p.join("\n");
}

// ── Main export ───────────────────────────────────────────────────────────

export function generateSvg(
  reactFlow: ReactFlowInstance,
  options: SvgExportOptions,
): string {
  const { nodes, edges, selectedNodeId } = useEditorStore.getState();
  const canvasFlowDirection = useSettingsStore.getState().flowDirection;
  const flowDirection = resolveSvgExportFlowDirection(options.flowDirection, canvasFlowDirection);
  const nodeTheme = getSvgNodeTheme(options.background);
  const { getTypeDisplayName } = getLanguageHelpers();
  const isLR = flowDirection === "LR";

  // ── 1. Build render data for each node ──────────────────────────────────

  const allNodeData: NodeRenderData[] = [];
  /** Map from "nodeId-source-handleId" or "nodeId-target-handleId" → absolute position */
  const handlePosMap = new Map<string, { x: number; y: number }>();

  const graphNodes = nodes.filter((node) => !isAnnotationNode(node.type));
  const exportableNodes = graphNodes;

  const allAnnotationData: AnnotationRenderData[] = [];
  if (options.includeAnnotations) {
    for (const node of nodes.filter((n) => isAnnotationNode(n.type))) {
      const data = (node.data ?? {}) as Record<string, unknown>;
      const internal = reactFlow.getInternalNode?.(node.id);
      const posAbs = internal?.internals?.positionAbsolute ?? node.position ?? { x: 0, y: 0 };
      const measuredW = internal?.measured?.width;
      const measuredH = internal?.measured?.height;
      const width =
        typeof data.width === "number"
          ? data.width
          : measuredW ?? (node.type === "comment" ? 240 : 300);
      const height =
        typeof data.height === "number"
          ? data.height
          : measuredH ?? (node.type === "comment" ? 110 : 200);

      if (node.type === "frame") {
        allAnnotationData.push({
          id: node.id,
          x: posAbs.x,
          y: posAbs.y,
          width,
          height,
          kind: "frame",
          title: typeof data.name === "string" && data.name ? data.name : "Frame",
          body: "",
          isAuthorNote: false,
        });
      } else {
        const text = typeof data.text === "string" ? data.text : "";
        const isAuthorNote = isAuthorNoteText(text);
        allAnnotationData.push({
          id: node.id,
          x: posAbs.x,
          y: posAbs.y,
          width,
          height,
          kind: "comment",
          title: isAuthorNote ? "Author Note" : "Comment",
          body: isAuthorNote ? stripAuthorNotePrefix(text) : text,
          isAuthorNote,
        });
      }
    }
  }

  for (const node of exportableNodes) {
    const rfType = node.type ?? "default";
    const data = (node.data ?? {}) as Record<string, unknown>;
    const dataType = typeof data.type === "string" ? data.type : rfType;
    const rawFields = data.fields;
    const fields =
      rawFields && typeof rawFields === "object" && !Array.isArray(rawFields)
        ? (rawFields as Record<string, unknown>)
        : {};

    // Determine variant
    let variant: NodeVariant;
    if (rfType === "Root") variant = "root";
    else if (rfType === "group") variant = "group";
    else if (!(rfType in HANDLE_REGISTRY)) variant = "generic";
    else variant = "base";

    // Internal node from React Flow for measured dimensions + handle bounds
    const internal = reactFlow.getInternalNode?.(node.id);
    const posAbs = internal?.internals?.positionAbsolute ?? node.position ?? { x: 0, y: 0 };
    const measuredW = internal?.measured?.width;

    // Resolve handles
    let handles: HandleDef[];
    if (variant === "root") handles = getHandles("Root");
    else if (variant === "group") handles = resolveGroupHandlesFromData(data, node.id, edges);
    else if (variant === "generic") handles = resolveGenericHandles(node.id, edges, dataType);
    else handles = resolveCompoundHandles(node.id, rfType, edges);

    const inputs = handles.filter((h) => h.type === "target");
    const outputs = handles.filter((h) => h.type === "source");
    const maxRows = Math.max(inputs.length, outputs.length, variant === "root" ? 1 : 0);

    const exportFields =
      variant !== "root" && variant !== "group"
        ? resolveExportFields(dataType, fields)
        : [];

    const width = measuredW ?? DEFAULT_NODE_W;
    const height = computeNodeContentHeight(variant, maxRows, exportFields.length);

    // Header color
    let headerColor: string;
    if (variant === "root") {
      headerColor = ROOT_COLOR;
    } else if (variant === "group") {
      headerColor = GROUP_COLOR_END;
    } else if (variant === "generic") {
      headerColor = getGenericTypeColor(dataType);
    } else {
      const cat = getCategoryFromRfType(rfType);
      if (cat === AssetCategory.Density) {
        headerColor = getDensityAccentColor(dataType) ?? CATEGORY_COLORS[AssetCategory.Density];
      } else if (cat) {
        headerColor = CATEGORY_COLORS[cat];
      } else {
        headerColor = "#8C8878";
      }
    }

    // Display name
    const displayName =
      variant === "root"
        ? "ROOT"
        : variant === "group"
          ? (typeof data.name === "string" && data.name ? data.name : "Group")
          : getTypeDisplayName(dataType);

    // ── Handle positions ────────────────────────────────────────────────
    const hBounds = internal?.internals?.handleBounds;
    let usedBounds = false;

    if (hBounds) {
      for (const hb of hBounds.source ?? []) {
        if (!hb.id) continue;
        const ax = posAbs.x + hb.x + hb.width / 2;
        const ay = posAbs.y + hb.y + hb.height / 2;
        handlePosMap.set(`${node.id}-source-${hb.id}`, { x: ax, y: ay });
        usedBounds = true;
      }
      for (const hb of hBounds.target ?? []) {
        if (!hb.id) continue;
        const ax = posAbs.x + hb.x + hb.width / 2;
        const ay = posAbs.y + hb.y + hb.height / 2;
        handlePosMap.set(`${node.id}-target-${hb.id}`, { x: ax, y: ay });
        usedBounds = true;
      }
    }

    // Fallback: compute from layout constants
    if (!usedBounds) {
      const inputX = isLR ? 0 : width;
      const outputX = isLR ? width : 0;
      if (variant === "root") {
        const handleCy = posAbs.y + HEADER_H + ROOT_BODY_H / 2;
        handlePosMap.set(`${node.id}-target-input`, { x: posAbs.x + inputX, y: handleCy });
      } else {
        inputs.forEach((h, i) => {
          handlePosMap.set(`${node.id}-target-${h.id}`, {
            x: posAbs.x + inputX,
            y: posAbs.y + HEADER_H + handleTop(i),
          });
        });
        outputs.forEach((h, i) => {
          handlePosMap.set(`${node.id}-source-${h.id}`, {
            x: posAbs.x + outputX,
            y: posAbs.y + HEADER_H + handleTop(i),
          });
        });
      }
    }

    // Group-specific data
    let groupChildCount: number | undefined;
    let groupBodyText: string | undefined;
    if (variant === "group") {
      const internalNodes = data.internalNodes;
      groupChildCount = Array.isArray(internalNodes) ? internalNodes.length : 0;
      const inCount = handles.filter((h) => h.type === "target").length;
      const outCount = handles.filter((h) => h.type === "source").length;
      if (Math.max(inCount, outCount) === 0) {
        groupBodyText = `${groupChildCount} node${groupChildCount !== 1 ? "s" : ""} grouped`;
      }
    }

    allNodeData.push({
      id: node.id,
      x: posAbs.x,
      y: posAbs.y,
      width,
      height,
      variant,
      headerColor,
      displayName,
      rawType: dataType,
      handles,
      fields: exportFields,
      groupChildCount,
      groupBodyText,
    });
  }

  // ── 2. Viewport filtering ───────────────────────────────────────────────

  const exportableIds = new Set(exportableNodes.map((n) => n.id));
  let visibleNodes = allNodeData;
  let visibleAnnotations = allAnnotationData;
  let visibleEdges = edges.filter(
    (e) => exportableIds.has(e.source) && exportableIds.has(e.target),
  );
  let selectionClipIds: Set<string> | null = null;

  if (options.scope === "viewport") {
    const vp = reactFlow.getViewport();
    const wrapper = document.querySelector(".react-flow");
    const wW = wrapper?.clientWidth ?? 1200;
    const wH = wrapper?.clientHeight ?? 800;

    const visLeft = -vp.x / vp.zoom;
    const visTop = -vp.y / vp.zoom;
    const visRight = (wW - vp.x) / vp.zoom;
    const visBottom = (wH - vp.y) / vp.zoom;

    visibleNodes = allNodeData.filter(
      (n) =>
        n.x + n.width >= visLeft &&
        n.x <= visRight &&
        n.y + n.height >= visTop &&
        n.y <= visBottom,
    );
    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    visibleEdges = edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target));
    visibleAnnotations = allAnnotationData.filter((ann) =>
      nodeIntersectsRect(ann.x, ann.y, ann.width, ann.height, visLeft, visTop, visRight, visBottom),
    );
  } else if (options.scope === "selection") {
    const selectedIds = getSelectedExportNodeIds(nodes, selectedNodeId);
    selectionClipIds = selectedIds;
    visibleNodes = allNodeData.filter((n) => selectedIds.has(n.id));
    visibleEdges = edges.filter(
      (e) => selectedIds.has(e.source) || selectedIds.has(e.target),
    );
    const selectionBounds = computeNodesBounds(visibleNodes);
    visibleAnnotations = allAnnotationData.filter((ann) => {
      if (selectedIds.has(ann.id)) return true;
      if (!selectionBounds) return false;
      return nodeIntersectsRect(
        ann.x,
        ann.y,
        ann.width,
        ann.height,
        selectionBounds.left,
        selectionBounds.top,
        selectionBounds.right,
        selectionBounds.bottom,
      );
    });
  }

  // ── 3. Compute viewBox ──────────────────────────────────────────────────

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const n of visibleNodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  for (const ann of visibleAnnotations) {
    minX = Math.min(minX, ann.x);
    minY = Math.min(minY, ann.y);
    maxX = Math.max(maxX, ann.x + ann.width);
    maxY = Math.max(maxY, ann.y + ann.height);
  }
  if (!isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 400;
    maxY = 300;
  }

  const pad = options.scope === "viewport" ? 0 : options.padding;
  const vbX = minX - pad;
  const vbY = minY - pad;
  const vbW = maxX - minX + pad * 2;
  const vbH = maxY - minY + pad * 2;
  const { width: outW, height: outH } = computeSvgOutputDimensions(
    vbW,
    vbH,
    options.resolution,
  );
  const clipRect: SvgClipRect = {
    left: vbX,
    top: vbY,
    right: vbX + vbW,
    bottom: vbY + vbH,
  };

  // ── 4. Build SVG string ─────────────────────────────────────────────────

  const svg: string[] = [];

  const metaTitle = escXml(resolveSvgExportBaseName(useProjectStore.getState().currentFile));
  const metaDesc = escXml(
    `${visibleNodes.length} nodes, ${visibleEdges.length} edges, ${options.scope} scope export from TerraNova`,
  );
  const shadowOpacity =
    options.background === "light" || options.background === "transparent" ? "0.22" : "0.4";

  svg.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  svg.push(
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
      `viewBox="${fmtSvgNum(vbX)} ${fmtSvgNum(vbY)} ${fmtSvgNum(vbW)} ${fmtSvgNum(vbH)}" ` +
      `width="${outW}" height="${outH}" ` +
      `text-rendering="geometricPrecision" shape-rendering="geometricPrecision">`,
  );
  svg.push(`<title>${metaTitle}</title>`);
  svg.push(`<desc>${metaDesc}</desc>`);

  // Defs
  svg.push(`<defs>`);
  svg.push(
    `<filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">`,
    `<feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur" />`,
    `<feOffset in="blur" dx="0" dy="2" result="shifted" />`,
    `<feFlood flood-color="#000000" flood-opacity="${shadowOpacity}" result="color" />`,
    `<feComposite in="color" in2="shifted" operator="in" result="shadow" />`,
    `<feMerge>`,
    `<feMergeNode in="shadow" />`,
    `<feMergeNode in="SourceGraphic" />`,
    `</feMerge>`,
    `</filter>`,
  );
  const bgStyle = SVG_BACKGROUNDS[options.background];
  const showGrid = options.showGrid && options.background !== "transparent";
  if (showGrid) {
    svg.push(
      `<pattern id="grid" width="${GRID_SIZE}" height="${GRID_SIZE}" patternUnits="userSpaceOnUse">`,
      `<path d="M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}" fill="none" stroke="${bgStyle.gridStroke}" stroke-width="0.5" />`,
      `</pattern>`,
    );
  }
  // Group gradient (defined once, referenced by all group nodes)
  svg.push(
    `<linearGradient id="groupGrad" x1="0" y1="0" x2="1" y2="0">`,
    `<stop offset="0%" stop-color="${GROUP_COLOR_START}" />`,
    `<stop offset="100%" stop-color="${GROUP_COLOR_END}" />`,
    `</linearGradient>`,
  );
  svg.push(`</defs>`);

  // Background
  if (bgStyle.fill) {
    svg.push(`<rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="${bgStyle.fill}" />`);
  }
  if (showGrid) {
    svg.push(`<rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="url(#grid)" />`);
  }

  if (visibleAnnotations.length > 0) {
    svg.push(`<g class="annotations">`);
    for (const ann of visibleAnnotations) {
      svg.push(renderAnnotationSvg(ann));
    }
    svg.push(`</g>`);
  }

  // ── Edges layer ─────────────────────────────────────────────────────────

  svg.push(`<g class="edges">`);

  for (const edge of visibleEdges) {
    const srcKey = `${edge.source}-source-${edge.sourceHandle ?? "output"}`;
    const tgtKey = `${edge.target}-target-${edge.targetHandle ?? "input"}`;
    let sp = handlePosMap.get(srcKey);
    let tp = handlePosMap.get(tgtKey);
    if (!sp || !tp) continue;

    const sourceExternal = selectionClipIds ? !selectionClipIds.has(edge.source) : false;
    const targetExternal = selectionClipIds ? !selectionClipIds.has(edge.target) : false;
    const isExternalEdge = sourceExternal || targetExternal;

    if (selectionClipIds) {
      if (sourceExternal) {
        sp = clipEndpointToRect(tp, sp, clipRect);
      }
      if (targetExternal) {
        tp = clipEndpointToRect(sp, tp, clipRect);
      }
    }

    // Bezier control point offset (matches React Flow default)
    const dx = tp.x - sp.x;
    const offset = Math.max(Math.abs(dx) * 0.5, 50);
    const cx1 = sp.x + (isLR ? offset : -offset);
    const cy1 = sp.y;
    const cx2 = tp.x + (isLR ? -offset : offset);
    const cy2 = tp.y;

    // Edge color from source output handle's category
    let edgeColor = nodeTheme.edgeFallback;
    const srcNode = allNodeData.find((n) => n.id === edge.source);
    if (srcNode) {
      const outH = srcNode.handles.find(
        (h) => h.type === "source" && h.id === (edge.sourceHandle ?? "output"),
      );
      if (outH) edgeColor = getHandleColor(outH.category);
    }

    const dashAttr = isExternalEdge ? ` stroke-dasharray="8 6"` : "";
    svg.push(
      `<path d="M ${sp.x} ${sp.y} C ${cx1} ${cy1} ${cx2} ${cy2} ${tp.x} ${tp.y}" ` +
        `fill="none" stroke="${edgeColor}" stroke-width="2" stroke-opacity="${nodeTheme.edgeOpacity}"${dashAttr} />`,
    );
  }

  svg.push(`</g>`);

  // ── Nodes layer ─────────────────────────────────────────────────────────

  svg.push(`<g class="nodes">`);

  for (const nd of visibleNodes) {
    svg.push(renderNodeSvg(nd, options.mode, flowDirection, nodeTheme));
  }

  svg.push(`</g>`);
  svg.push(`</svg>`);

  return svg.join("\n");
}

// ── Per-node SVG rendering ────────────────────────────────────────────────

function computeRenderedHeight(nd: NodeRenderData): number {
  const inputs = nd.handles.filter((h) => h.type === "target");
  const outputs = nd.handles.filter((h) => h.type === "source");
  const maxRows = Math.max(inputs.length, outputs.length, nd.variant === "root" ? 1 : 0);
  return computeNodeContentHeight(nd.variant, maxRows, nd.fields.length);
}

function renderNodeSvg(
  nd: NodeRenderData,
  mode: string,
  flowDirection: FlowDirection,
  theme: SvgNodeTheme,
): string {
  const isLR = flowDirection === "LR";
  const w = nd.width;
  const inputs = nd.handles.filter((h) => h.type === "target");
  const outputs = nd.handles.filter((h) => h.type === "source");
  const maxRows = Math.max(inputs.length, outputs.length, nd.variant === "root" ? 1 : 0);
  const handleZoneH =
    nd.variant === "group" && maxRows === 0
      ? GROUP_EMPTY_BODY_H
      : nd.variant === "root"
        ? ROOT_BODY_H
        : maxRows * ROW_H;

  const showFields = nd.variant !== "root" && nd.variant !== "group" && nd.fields.length > 0;
  const groupFooterH = nd.variant === "group" ? GROUP_FOOTER_H : 0;
  const totalH = computeRenderedHeight(nd);

  const p: string[] = [];
  p.push(`<g transform="translate(${nd.x}, ${nd.y})" filter="url(#shadow)">`);

  // Body
  p.push(
    `<rect width="${w}" height="${totalH}" rx="5" fill="${theme.nodeBg}" stroke="${theme.nodeBorder}" stroke-width="1" />`,
  );

  if (handleZoneH > 0) {
    p.push(
      `<rect x="0" y="${HEADER_H}" width="${w}" height="${handleZoneH}" fill="${theme.handleZoneBg}" />`,
    );
  }

  // Header
  const headerFill = nd.variant === "group" ? "url(#groupGrad)" : nd.headerColor;
  p.push(`<rect width="${w}" height="${HEADER_H}" rx="5" fill="${headerFill}" />`);
  // Square off bottom corners of header (overlap with a non-rounded rect)
  p.push(`<rect x="0" y="${HEADER_H - 5}" width="${w}" height="5" fill="${headerFill}" />`);

  // Header text
  const nameY = nd.variant !== "root" && nd.displayName !== nd.rawType
    ? HEADER_H / 2 - 3
    : HEADER_H / 2 + 1;
  p.push(
    `<text x="12" y="${nameY}" dominant-baseline="middle" ` +
      `font-family="${FONT}" font-size="11" font-weight="600" fill="white">${escXml(nd.displayName)}</text>`,
  );

  // Raw type subtext (when display name differs, or always in debug mode)
  if (nd.variant !== "root" && nd.variant !== "group") {
    if (mode === "debug" || nd.displayName !== nd.rawType) {
      p.push(
        `<text x="12" y="${HEADER_H / 2 + 8}" dominant-baseline="middle" ` +
          `font-family="${FONT}" font-size="8" fill="#ffffff" fill-opacity="0.5">${escXml(nd.rawType)}</text>`,
      );
    }
  }

  // Group node child count badge
  if (nd.variant === "group" && nd.groupChildCount !== undefined) {
    const bx = w - 52;
    const by = (HEADER_H - 16) / 2;
    p.push(`<rect x="${bx}" y="${by}" width="24" height="16" rx="3" fill="#000000" fill-opacity="0.3" />`);
    p.push(
      `<text x="${bx + 12}" y="${HEADER_H / 2 + 1}" text-anchor="middle" dominant-baseline="middle" ` +
        `font-family="${FONT}" font-size="9" fill="white">${nd.groupChildCount}</text>`,
    );
  }

  // ── Handles ───────────────────────────────────────────────────────────

  const inputX = isLR ? 0 : w;
  const outputX = isLR ? w : 0;
  const labelInX = isLR ? 16 : w - 16;
  const labelOutX = isLR ? w - 16 : 16;
  const anchorIn = isLR ? "start" : "end";
  const anchorOut = isLR ? "end" : "start";
  const showIdx = inputs.length >= 2;
  const showOutIdx = outputs.length >= 2;

  if (nd.variant === "root") {
    const cy = HEADER_H + ROOT_BODY_H / 2;
    p.push(
      `<circle cx="${inputX}" cy="${cy}" r="${HANDLE_RADIUS}" fill="${INPUT_HANDLE_COLOR}" stroke="${HANDLE_STROKE_COLOR}" stroke-opacity="${HANDLE_STROKE_OPACITY}" stroke-width="2" />`,
    );
    p.push(
      `<text x="28" y="${cy}" dominant-baseline="middle" ` +
        `font-family="${FONT}" font-size="11" fill="${theme.textMuted}">Graph Output</text>`,
    );
  }

  for (let i = 0; i < inputs.length; i++) {
    if (nd.variant === "root") break;
    const h = inputs[i];
    const cy = HEADER_H + handleTop(i);
    p.push(
      `<circle cx="${inputX}" cy="${cy}" r="${HANDLE_RADIUS}" fill="${INPUT_HANDLE_COLOR}" stroke="${HANDLE_STROKE_COLOR}" stroke-opacity="${HANDLE_STROKE_OPACITY}" stroke-width="2" />`,
    );
    p.push(
      `<text x="${labelInX}" y="${cy}" dominant-baseline="middle" text-anchor="${anchorIn}" ` +
        `font-family="${FONT}" font-size="11" fill="${theme.textMuted}">${escXml(exportHandleLabel(h, i, showIdx))}</text>`,
    );
  }

  for (let i = 0; i < outputs.length; i++) {
    if (nd.variant === "root") break;
    const h = outputs[i];
    const cy = HEADER_H + handleTop(i);
    const color = getHandleColor(h.category);
    p.push(
      `<circle cx="${outputX}" cy="${cy}" r="${HANDLE_RADIUS}" fill="${color}" stroke="${HANDLE_STROKE_COLOR}" stroke-opacity="${HANDLE_STROKE_OPACITY}" stroke-width="2" />`,
    );
    p.push(
      `<text x="${labelOutX}" y="${cy}" dominant-baseline="middle" text-anchor="${anchorOut}" ` +
        `font-family="${FONT}" font-size="11" fill="${theme.textMuted}">${escXml(exportHandleLabel(h, i, showOutIdx))}</text>`,
    );
  }

  // ── Group body / footer ───────────────────────────────────────────────

  if (nd.variant === "group") {
    if (nd.groupBodyText) {
      p.push(
        `<text x="12" y="${HEADER_H + GROUP_EMPTY_BODY_H / 2 + 1}" dominant-baseline="middle" ` +
          `font-family="${FONT}" font-size="11" fill="${theme.textMuted}" font-style="italic">${escXml(nd.groupBodyText)}</text>`,
      );
    }
    const footerY = totalH - groupFooterH;
    p.push(
      `<line x1="0" y1="${footerY}" x2="${w}" y2="${footerY}" stroke="${GROUP_COLOR_END}" stroke-opacity="0.2" stroke-width="1" />`,
    );
    p.push(
      `<text x="12" y="${footerY + GROUP_FOOTER_H / 2 + 1}" dominant-baseline="middle" ` +
        `font-family="${FONT}" font-size="11" fill="${theme.textMuted}">Double-click to expand</text>`,
    );
  }

  // ── Fields zone ───────────────────────────────────────────────────────

  if (showFields) {
    const fieldY = HEADER_H + handleZoneH;
    p.push(
      `<line x1="0" y1="${fieldY}" x2="${w}" y2="${fieldY}" stroke="${nd.headerColor}" stroke-opacity="0.2" stroke-width="1" />`,
    );
    for (let i = 0; i < nd.fields.length; i++) {
      const { label, value } = nd.fields[i];
      const y = fieldY + 10 + i * 18 + 4;
      p.push(
        `<text x="12" y="${y}" font-family="${FONT}" font-size="11" fill="${theme.textMuted}">${escXml(label)}</text>`,
      );
      p.push(
        `<text x="${w - 12}" y="${y}" text-anchor="end" font-family="monospace, ${FONT}" font-size="11" fill="${theme.textValue}">${escXml(value)}</text>`,
      );
    }
  }

  // Debug mode: node ID overlay
  if (mode === "debug") {
    p.push(
      `<text x="${w / 2}" y="${totalH + 14}" text-anchor="middle" ` +
        `font-family="${FONT}" font-size="8" fill="${theme.debugIdText}" fill-opacity="0.55">${escXml(nd.id)}</text>`,
    );
  }

  p.push(`</g>`);
  return p.join("\n");
}

// ── File writing ──────────────────────────────────────────────────────────

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeDialogPath(filePath: string): string {
  return filePath.replace(/^file:\/\/\/?/i, "");
}

function defaultGraphExportPath(
  exportPath: string,
  baseName: string,
  scope: SvgExportScope,
  extension: "svg" | "png",
): string {
  const base = exportPath.replace(/[\\/]+$/, "");
  const sep = base.includes("\\") ? "\\" : "/";
  return `${base}${sep}${resolveSvgExportFileName(baseName, scope, extension)}`;
}

function downloadBlobInBrowser(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadSvgInBrowser(svgString: string, fileName: string): void {
  downloadBlobInBrowser(
    new Blob([svgString], { type: "image/svg+xml;charset=utf-8" }),
    fileName,
  );
}

function showExportSuccessToast(
  normalizedPath: string,
  formatLabel: "SVG" | "PNG",
): void {
  const addToast = useToastStore.getState().addToast;
  const dirPortion = normalizedPath.replace(/[/\\][^/\\]+$/, "");
  useSettingsStore.getState().setExportPath(dirPortion);
  addToast(`Exported ${formatLabel} to ${normalizedPath}`, "success", {
    label: "Show in folder",
    onClick: () => {
      void import("@/utils/ipc").then(({ showInFolder }) =>
        showInFolder(dirPortion).catch((error) => {
          addToast(`Could not open folder: ${getErrorMessage(error)}`, "error");
        }),
      );
    },
  });
}

export async function writeSvgToFile(
  svgString: string,
  scope: SvgExportScope = "full",
): Promise<boolean> {
  const addToast = useToastStore.getState().addToast;
  const baseName = resolveSvgExportBaseName(useProjectStore.getState().currentFile);
  const downloadName = resolveSvgExportFileName(baseName, scope, "svg");

  if (!isTauriRuntime()) {
    try {
      downloadSvgInBrowser(svgString, downloadName);
      addToast(`Downloaded ${downloadName}`, "success");
      return true;
    } catch (error) {
      if (import.meta.env.DEV) console.error("Export SVG failed:", error);
      addToast(`Export SVG failed: ${getErrorMessage(error)}`, "error");
      return false;
    }
  }

  const { save } = await import("@tauri-apps/plugin-dialog");
  const { exportTextFile } = await import("@/utils/ipc");

  const exportPath = useSettingsStore.getState().exportPath;
  let filePath: string | null;
  try {
    filePath = await save({
      defaultPath: exportPath
        ? defaultGraphExportPath(exportPath, baseName, scope, "svg")
        : downloadName,
      filters: [{ name: "SVG Image", extensions: ["svg"] }],
    });
  } catch (error) {
    if (import.meta.env.DEV) console.error("Export SVG save dialog failed:", error);
    addToast(`Export SVG failed: ${getErrorMessage(error)}`, "error");
    return false;
  }

  if (!filePath) return false;

  const normalizedPath = normalizeDialogPath(filePath);

  try {
    await exportTextFile(normalizedPath, svgString);
  } catch (error) {
    if (import.meta.env.DEV) console.error("Export SVG failed:", error);
    addToast(`Export SVG failed: ${getErrorMessage(error)}`, "error");
    return false;
  }

  showExportSuccessToast(normalizedPath, "SVG");
  return true;
}

export async function writePngToFile(
  pngBlob: Blob,
  scope: SvgExportScope = "full",
): Promise<boolean> {
  const addToast = useToastStore.getState().addToast;
  const baseName = resolveSvgExportBaseName(useProjectStore.getState().currentFile);
  const downloadName = resolveSvgExportFileName(baseName, scope, "png");

  if (!isTauriRuntime()) {
    try {
      downloadBlobInBrowser(pngBlob, downloadName);
      addToast(`Downloaded ${downloadName}`, "success");
      return true;
    } catch (error) {
      if (import.meta.env.DEV) console.error("Export PNG failed:", error);
      addToast(`Export PNG failed: ${getErrorMessage(error)}`, "error");
      return false;
    }
  }

  const { save } = await import("@tauri-apps/plugin-dialog");
  const { writeFile } = await import("@tauri-apps/plugin-fs");

  const exportPath = useSettingsStore.getState().exportPath;
  let filePath: string | null;
  try {
    filePath = await save({
      defaultPath: exportPath
        ? defaultGraphExportPath(exportPath, baseName, scope, "png")
        : downloadName,
      filters: [{ name: "PNG Image", extensions: ["png"] }],
    });
  } catch (error) {
    if (import.meta.env.DEV) console.error("Export PNG save dialog failed:", error);
    addToast(`Export PNG failed: ${getErrorMessage(error)}`, "error");
    return false;
  }

  if (!filePath) return false;

  const normalizedPath = normalizeDialogPath(filePath);

  try {
    const buffer =
      typeof pngBlob.arrayBuffer === "function"
        ? await pngBlob.arrayBuffer()
        : await new Response(pngBlob).arrayBuffer();
    await writeFile(normalizedPath, new Uint8Array(buffer));
  } catch (error) {
    if (import.meta.env.DEV) console.error("Export PNG failed:", error);
    addToast(`Export PNG failed: ${getErrorMessage(error)}`, "error");
    return false;
  }

  showExportSuccessToast(normalizedPath, "PNG");
  return true;
}

export async function copySvgTextToClipboard(svg: string): Promise<void> {
  const addToast = useToastStore.getState().addToast;
  try {
    await navigator.clipboard.writeText(svg);
    addToast("Copied SVG text to clipboard", "success");
  } catch (error) {
    if (import.meta.env.DEV) console.error("Copy SVG text failed:", error);
    addToast(`Copy failed: ${getErrorMessage(error)}`, "error");
  }
}

export async function copySvgImageToClipboard(svg: string): Promise<void> {
  const addToast = useToastStore.getState().addToast;
  try {
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
      addToast("Image clipboard is not supported in this environment.", "warning");
      return;
    }

    const stats = parseSvgExportStats(svg);
    const pngBlob = await rasterizeSvgToPngBlobImpl(
      svg,
      stats?.width ?? SVG_EXPORT_TARGET_WIDTH,
      stats?.height ?? SVG_EXPORT_TARGET_WIDTH,
    );
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": pngBlob }),
    ]);
    addToast("Copied PNG image to clipboard", "success");
  } catch (error) {
    if (import.meta.env.DEV) console.error("Copy SVG image failed:", error);
    addToast(`Copy image failed: ${getErrorMessage(error)}`, "error");
  }
}

/** Generate SVG from the current graph and write it to a user-chosen path. */
export async function exportGraphAsSvg(
  reactFlow: ReactFlowInstance,
  options: SvgExportOptions,
): Promise<boolean> {
  const addToast = useToastStore.getState().addToast;

  if (options.scope === "selection") {
    const { nodes, selectedNodeId } = useEditorStore.getState();
    if (getSelectedExportNodeIds(nodes, selectedNodeId).size === 0) {
      addToast("Select one or more nodes to export a selection.", "warning");
      return false;
    }
  }

  useSettingsStore.getState().setSvgExportSettings(options);

  try {
    const svgString = generateSvg(reactFlow, options);
    return await writeSvgToFile(svgString, options.scope);
  } catch (error) {
    if (import.meta.env.DEV) console.error("Export SVG failed:", error);
    addToast(`Export SVG failed: ${getErrorMessage(error)}`, "error");
    return false;
  }
}

/** Generate PNG from the current graph and write it to a user-chosen path. */
export async function exportGraphAsPng(
  reactFlow: ReactFlowInstance,
  options: SvgExportOptions,
): Promise<boolean> {
  const addToast = useToastStore.getState().addToast;

  if (options.scope === "selection") {
    const { nodes, selectedNodeId } = useEditorStore.getState();
    if (getSelectedExportNodeIds(nodes, selectedNodeId).size === 0) {
      addToast("Select one or more nodes to export a selection.", "warning");
      return false;
    }
  }

  useSettingsStore.getState().setSvgExportSettings(options);

  try {
    const svgString = generateSvg(reactFlow, options);
    const stats = parseSvgExportStats(svgString);
    const pngBlob = await rasterizeSvgToPngBlobImpl(
      svgString,
      stats?.width ?? options.resolution,
      stats?.height ?? options.resolution,
    );
    return await writePngToFile(pngBlob, options.scope);
  } catch (error) {
    if (import.meta.env.DEV) console.error("Export PNG failed:", error);
    addToast(`Export PNG failed: ${getErrorMessage(error)}`, "error");
    return false;
  }
}
