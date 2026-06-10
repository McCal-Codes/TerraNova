import {
  WORLDGEN_V1_BRIDGE_PRESETS,
  resolveSaveModPackRoot,
  type WorldgenV1ModPackId,
} from "@/utils/hytaleModPaths";
import { linkModPackToBridge, openSaveModPackByPath } from "@/utils/saveModWorkflow";

/** Set Bridge server mod path to an embedded save pack (pack root, not parent mods/). */
export async function linkSaveModPackToBridge(
  packId: WorldgenV1ModPackId,
): Promise<string> {
  const packRoot = await resolveSaveModPackRoot(packId);
  return linkModPackToBridge(packRoot);
}

/**
 * Open a Worldgen V1 mod folder as the TerraNova project, link Bridge to the same path,
 * and optionally open a starter biome file for editing.
 */
export async function openSaveModPackInEditor(
  packId: WorldgenV1ModPackId,
  openFile?: (filePath: string) => Promise<void>,
): Promise<string> {
  const packRoot = await resolveSaveModPackRoot(packId);
  const preset = WORLDGEN_V1_BRIDGE_PRESETS.find((p) => p.id === packId);
  return openSaveModPackByPath(packRoot, openFile, preset?.exampleBiomeRelative);
}
