import { slugifyHytaleModName } from "@/data/packWizardTemplates";

export interface TerraNovaProjectManifest {
  name: string;
  version: string;
  description: string;
  hytaleGroup?: string;
  hytaleName?: string;
}

export function buildTerraNovaManifest(input: {
  packName: string;
  packGroup: string;
  description?: string;
}): TerraNovaProjectManifest {
  return {
    name: input.packName.trim() || "MyPack",
    version: "1.0.0",
    description: input.description ?? "",
    hytaleGroup: input.packGroup.trim() || "User",
    hytaleName: slugifyHytaleModName(input.packName),
  };
}

/** Patch world structure JSON so biome references match the wizard biome name. */
export function patchWorldStructureBiomeRefs(
  world: Record<string, unknown>,
  biomeName: string,
): Record<string, unknown> {
  const next = { ...world };
  next.DefaultBiome = biomeName;
  if (Array.isArray(next.Biomes)) {
    next.Biomes = (next.Biomes as Record<string, unknown>[]).map((entry) => ({
      ...entry,
      Biome: biomeName,
    }));
  }
  return next;
}

/** Rewrite biome Name and optionally strip Props. */
export function patchBiomeDocument(
  biome: Record<string, unknown>,
  biomeName: string,
  includeStarterProps: boolean,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...biome, Name: biomeName };
  if (!includeStarterProps) {
    next.Props = [];
  }
  return next;
}

function minimalPrefabProp(path: string): Record<string, unknown> {
  return {
    Runtime: 0,
    Skip: false,
    Positions: { Type: "Mesh2D", Resolution: 6, Jitter: 0.3 },
    Assignments: {
      Type: "Constant",
      Prop: {
        Type: "Prefab",
        Path: path,
        Directionality: { Type: "Uniform" },
        Scanner: {
          Type: "ColumnLinear",
          StepSize: 1,
          Range: { Min: 0, Max: 200 },
        },
      },
    },
  };
}

/** Inject or append a single starter prefab prop entry. */
export function patchBiomeStarterPrefab(
  biome: Record<string, unknown>,
  includeTemplateProps: boolean,
  customPath: string | null | undefined,
): Record<string, unknown> {
  const path = customPath?.trim();
  if (!path) return biome;

  const entry = minimalPrefabProp(path);
  const next = { ...biome };

  if (includeTemplateProps && Array.isArray(next.Props)) {
    next.Props = [...(next.Props as unknown[]), entry];
  } else {
    next.Props = [entry];
  }

  return next;
}

/** Override MaterialProvider for the basic biome template. */
export function patchPrimaryMaterial(
  biome: Record<string, unknown>,
  blockId: string | null | undefined,
  templateId: string,
): Record<string, unknown> {
  const id = blockId?.trim();
  if (!id || templateId !== "basic") return biome;

  return {
    ...biome,
    MaterialProvider: { Type: "Constant", Material: id },
  };
}

export function customEnvironmentId(biomeName: string): string {
  return `Env_${biomeName}`;
}

export function customWeatherId(biomeName: string): string {
  return `Weather_${biomeName}`;
}
