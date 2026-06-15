import { validateAssetPack, listDirectory } from "@/utils/ipc";
import { useProjectStore } from "@/stores/projectStore";

export interface ProjectHealthDetail {
  file: string;
  field: string;
  message: string;
  severity: "Error" | "Warning" | "Info";
}

export interface ProjectHealthReport {
  projectPath: string | null;
  totalErrors: number;
  errorsBySeverity: { Error: number; Warning: number; Info: number };
  details: ProjectHealthDetail[];
}

/**
 * Compute a lightweight project health report.
 * Uses the Rust validation command where possible; falls back to an empty report
 * when no project is open or validation fails.
 */
export async function computeProjectHealth(projectPath: string | null): Promise<ProjectHealthReport> {
  const empty: ProjectHealthReport = {
    projectPath,
    totalErrors: 0,
    errorsBySeverity: { Error: 0, Warning: 0, Info: 0 },
    details: [],
  };

  if (!projectPath) return empty;

  try {
    const res = await validateAssetPack(projectPath);
    const details: ProjectHealthDetail[] = (res.errors ?? []).map((e) => ({
      file: e.file,
      field: e.field,
      message: e.message,
      severity: e.severity,
    }));
    const errorsBySeverity = { Error: 0, Warning: 0, Info: 0 };
    for (const d of details) errorsBySeverity[d.severity]++;
    return {
      projectPath,
      totalErrors: details.length,
      errorsBySeverity,
      details,
    };
  } catch (err) {
    // If validation is not available (non-Tauri), attempt a shallow directory check
    try {
      const entries = await listDirectory(projectPath);
      // Count JSON files as a non-fatal heuristic
      let jsonCount = 0;
      type DirEntry = { is_dir?: boolean; name?: string; children?: DirEntry[] };
      function walk(entriesList: DirEntry[]) {
        for (const e of entriesList) {
          if (!e) continue;
          if (e.is_dir && e.children) walk(e.children);
          else if (typeof e.name === "string" && e.name.toLowerCase().endsWith(".json")) jsonCount++;
        }
      }
      walk(entries as DirEntry[]);
      return {
        projectPath,
        totalErrors: 0,
        errorsBySeverity: { Error: 0, Warning: 0, Info: 0 },
        details: [{ file: projectPath, field: "jsonFiles", message: `${jsonCount} JSON files found (shallow scan)`, severity: "Info" }],
      };
    } catch {
      return empty;
    }
  }
}

export function useCurrentProjectPath(): string | null {
  return useProjectStore.getState().projectPath;
}
