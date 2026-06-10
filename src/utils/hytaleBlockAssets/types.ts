export interface BlockModelBox {
  pos: [number, number, number];
  size: [number, number, number];
  quat: [number, number, number, number];
}

export interface ModelIndexEntry {
  relPath: string;
  absPath: string;
}

export interface BlockAssetIndex {
  textureIndex: Record<string, string>;
  modelIndex: Record<string, ModelIndexEntry[]>;
  modelTexIndex: Record<string, string>;
  decoThemes: Record<string, string>;
}

export interface ResolvedBlockModel {
  boxes: BlockModelBox[] | null;
  texturePath: string | null;
  blockTexture: string | null;
  modelPath: string | null;
}

export interface PrefabBlockInstance {
  x: number;
  y: number;
  z: number;
  name: string;
  rotation?: number;
  level?: number;
}

export interface PrefabJson {
  version?: number;
  blockIdVersion?: number;
  anchorX?: number;
  anchorY?: number;
  anchorZ?: number;
  blocks: PrefabBlockInstance[];
  entities?: unknown[];
}

/** Alias used by the Tauri client wrapper. */
export type HytalePrefabJson = PrefabJson;

export type GetModelBoxes = (modelPath: string, absPath: string) => BlockModelBox[] | null;
