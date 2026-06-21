import type { ImportMetadata } from "@/utils/hytaleToInternal";
import { fileHasHytaleLayoutPositions } from "@/utils/applyHytaleImportLayout";
import { isBiomeFile } from "@/utils/fileTypeDetection";
import type { FileGraphCache } from "@/stores/slices/types";

/**
 * Skip in-memory file cache when a biome ships Hytale editor positions.
 * Cached graphs from before layout preservation (or after auto-layout) would
 * otherwise mask the metadata-driven import path entirely.
 */
export function shouldBypassFileCacheForHytaleLayout(
  rawContent: Record<string, unknown>,
  filePath: string,
  metadata: ImportMetadata | null | undefined,
  cached: FileGraphCache | false | null | undefined,
): boolean {
  if (!isBiomeFile(rawContent, filePath)) return false;
  if (!fileHasHytaleLayoutPositions(metadata?.nodePositions)) return false;
  if (!cached) return false;
  return cached.importLayoutMode !== "hytale";
}
