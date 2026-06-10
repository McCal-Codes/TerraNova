import { normalizePath } from "@/utils/pathUtils";
import type { ProjectLegacyHit } from "@/utils/projectLegacyScanner";

/**
 * Issues sidebar badge: canvas diagnostics for the open file plus legacy hits
 * in other generator JSON files (avoids double-counting open-file legacy).
 */
export function computeIssueBadgeCount(
  diagnosticsCount: number,
  projectHits: ProjectLegacyHit[],
  currentFile: string | null,
): number {
  const otherFileLegacyCount = currentFile
    ? projectHits.filter(
        (hit) => normalizePath(hit.file).toLowerCase() !== normalizePath(currentFile).toLowerCase(),
      ).length
    : projectHits.length;
  return diagnosticsCount + otherFileLegacyCount;
}
