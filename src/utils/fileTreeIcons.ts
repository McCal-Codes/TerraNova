import type { LucideIcon } from "lucide-react";
import {
  Box,
  Building2,
  Cloud,
  CloudRain,
  CloudSun,
  Database,
  File,
  FileJson,
  Globe,
  Image,
  Layers,
  Leaf,
  ListChecks,
  Moon,
  Mountain,
  Settings,
  Star,
  TreePine,
  Waves,
} from "lucide-react";

export interface FileIconSpec {
  Icon: LucideIcon;
  className: string;
}

export interface ReferencedAssetKindEntry {
  kind: "weather-texture" | "environment-weather";
  label: string;
}

const FILE_ICON_BASE = "h-4 w-4 shrink-0";
const REF_ICON_BASE = "h-3.5 w-3.5 shrink-0 text-tn-text-muted";

export function getFileIconSpec(nameOrPath: string): FileIconSpec {
  const normalized = nameOrPath.replace(/\\/g, "/").toLowerCase();
  const lower = normalized.includes("/")
    ? normalized.slice(normalized.lastIndexOf("/") + 1)
    : normalized;
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".")) : "";

  if (ext === ".png" || ext === ".jpg" || ext === ".jpeg" || ext === ".dds") {
    return { Icon: Image, className: `${FILE_ICON_BASE} text-purple-400` };
  }
  if (ext === ".bson") {
    return { Icon: Database, className: `${FILE_ICON_BASE} text-slate-400` };
  }
  if (ext === ".json") {
    if (normalized.includes("/biomes/") || lower.includes("biome")) {
      return { Icon: Mountain, className: `${FILE_ICON_BASE} text-emerald-400` };
    }
    if (lower.includes("assignment")) {
      return { Icon: ListChecks, className: `${FILE_ICON_BASE} text-emerald-400` };
    }
    if (lower.includes("density") || lower.includes("terrain")) {
      return { Icon: Waves, className: `${FILE_ICON_BASE} text-sky-400` };
    }
    if (lower.includes("material")) {
      return { Icon: Layers, className: `${FILE_ICON_BASE} text-orange-400` };
    }
    if (
      lower.includes("worldstructure")
      || lower.includes("world_structure")
      || lower.includes("structure")
    ) {
      return { Icon: Building2, className: `${FILE_ICON_BASE} text-violet-400` };
    }
    if (
      normalized.includes("/environments/")
      || lower.startsWith("env_")
      || lower.includes("environment")
      || lower.includes("environ")
    ) {
      return { Icon: TreePine, className: `${FILE_ICON_BASE} text-cyan-400` };
    }
    if (normalized.includes("/weathers/") || lower.includes("weather")) {
      return { Icon: CloudRain, className: `${FILE_ICON_BASE} text-cyan-400` };
    }
    if (lower.includes("settings") || lower.includes("config") || lower === "manifest.json") {
      return { Icon: Settings, className: `${FILE_ICON_BASE} text-tn-text-muted` };
    }
    if (lower.includes("world")) {
      return { Icon: Globe, className: `${FILE_ICON_BASE} text-indigo-400` };
    }
    if (lower.includes("prefab") || lower.includes("instance")) {
      return { Icon: Box, className: `${FILE_ICON_BASE} text-amber-400` };
    }
    // Legacy biome-style leaf for generic assignment-like names
    if (lower.includes("prop")) {
      return { Icon: Leaf, className: `${FILE_ICON_BASE} text-emerald-400` };
    }
    return { Icon: FileJson, className: `${FILE_ICON_BASE} text-tn-text-muted` };
  }
  return { Icon: File, className: `${FILE_ICON_BASE} text-tn-text-muted` };
}

export function getReferencedAssetKindIcon(entry: ReferencedAssetKindEntry): LucideIcon | null {
  if (entry.kind === "environment-weather") {
    return CloudSun;
  }
  if (entry.kind === "weather-texture") {
    if (entry.label.startsWith("Moon")) return Moon;
    if (entry.label.startsWith("Cloud")) return Cloud;
    if (entry.label === "Stars" || entry.label === "StarMap") return Star;
    return Image;
  }
  return null;
}

export function getReferencedAssetKindIconClassName(): string {
  return REF_ICON_BASE;
}
