import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/utils/platform";

export interface ScanVolumeBoundsRequest {
  densities: Float32Array | number[];
  resolution: number;
  ySlices: number;
  rangeMin: number;
  rangeMax: number;
  yMin: number;
  yMax: number;
  yOnly?: boolean;
}

export interface ScanVolumeBoundsResponse {
  worldXMin: number;
  worldXMax: number;
  worldYMin: number;
  worldYMax: number;
  worldZMin: number;
  worldZMax: number;
  hasSolids: boolean;
}

interface ScanVolumeBoundsRaw {
  world_x_min: number;
  world_x_max: number;
  world_y_min: number;
  world_y_max: number;
  world_z_min: number;
  world_z_max: number;
  has_solids: boolean;
}

function mapScanResponse(raw: ScanVolumeBoundsRaw): ScanVolumeBoundsResponse {
  return {
    worldXMin: raw.world_x_min,
    worldXMax: raw.world_x_max,
    worldYMin: raw.world_y_min,
    worldYMax: raw.world_y_max,
    worldZMin: raw.world_z_min,
    worldZMax: raw.world_z_max,
    hasSolids: raw.has_solids,
  };
}

/** Native surface-aware volume bounds scan (Tauri only). */
export async function scanVolumeSolidsBounds(
  request: ScanVolumeBoundsRequest,
): Promise<ScanVolumeBoundsResponse | null> {
  try {
    const densities = request.densities instanceof Float32Array
      ? Array.from(request.densities)
      : request.densities;
    const raw = await invoke<ScanVolumeBoundsRaw>("scan_volume_solids_bounds", {
      request: {
        densities,
        resolution: request.resolution,
        y_slices: request.ySlices,
        range_min: request.rangeMin,
        range_max: request.rangeMax,
        y_min: request.yMin,
        y_max: request.yMax,
        y_only: request.yOnly ?? false,
      },
    });
    return mapScanResponse(raw);
  } catch {
    return null;
  }
}

export interface DiscoverBiomeContentFieldsResult {
  fields: Record<string, number>;
  biomeName: string;
  worldStructuresDir: string | null;
}

/** Load WorldStructure ContentFields for a biome path via the Rust sidecar. */
export async function discoverBiomeContentFieldsIpc(
  biomeFilePath: string,
  biomeName?: string,
): Promise<DiscoverBiomeContentFieldsResult | null> {
  try {
    const raw = await invoke<{
      fields: Record<string, number>;
      biome_name: string;
      world_structures_dir: string | null;
    }>("discover_biome_content_fields", {
      request: {
        biome_file_path: biomeFilePath,
        biome_name: biomeName ?? null,
      },
    });
    return {
      fields: raw.fields,
      biomeName: raw.biome_name,
      worldStructuresDir: raw.world_structures_dir,
    };
  } catch {
    return null;
  }
}

export function isTauriPreviewIpcAvailable(): boolean {
  return isTauriRuntime();
}
