import { copyFile, createDirectory, exportAssetFile, pathExists } from "@/utils/ipc";
import { joinPath } from "@/utils/pathUtils";
import { buildDefaultWeatherDoc } from "./defaultWeatherDoc";

export interface MaterializeWeatherFilesInput {
  weathersDir: string;
  importIds?: string[];
  createIds?: string[];
  bundledPathIndex: Record<string, string>;
  overwrite?: boolean;
}

export interface MaterializeWeatherFilesResult {
  imported: number;
  created: number;
  skipped: number;
  failed: number;
}

export async function materializeWeatherFiles(
  input: MaterializeWeatherFilesInput,
): Promise<MaterializeWeatherFilesResult> {
  const result: MaterializeWeatherFilesResult = {
    imported: 0,
    created: 0,
    skipped: 0,
    failed: 0,
  };

  await createDirectory(input.weathersDir).catch(() => {});

  for (const weatherId of input.importIds ?? []) {
    const sourcePath = input.bundledPathIndex[weatherId.toLowerCase()];
    if (!sourcePath) {
      result.failed += 1;
      continue;
    }
    const fileName = sourcePath.split(/[/\\]/).pop() ?? `${weatherId}.json`;
    const destPath = joinPath(input.weathersDir, fileName);
    if (!input.overwrite && await pathExists(destPath)) {
      result.skipped += 1;
      continue;
    }
    try {
      await copyFile(sourcePath, destPath);
      result.imported += 1;
    } catch {
      result.failed += 1;
    }
  }

  for (const weatherId of input.createIds ?? []) {
    const destPath = joinPath(input.weathersDir, `${weatherId}.json`);
    if (!input.overwrite && await pathExists(destPath)) {
      result.skipped += 1;
      continue;
    }
    try {
      await exportAssetFile(destPath, buildDefaultWeatherDoc(weatherId));
      result.created += 1;
    } catch {
      result.failed += 1;
    }
  }

  return result;
}
