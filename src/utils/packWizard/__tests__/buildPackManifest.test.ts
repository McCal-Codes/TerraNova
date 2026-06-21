import { describe, expect, it } from "vitest";
import {
  ALL_BIOME_TEMPLATES,
  WORLD_STRUCTURE_TEMPLATES,
  slugifyHytaleModName,
  slugifyPackIdentifier,
  buildProjectPath,
} from "@/data/packWizardTemplates";
import {
  buildTerraNovaManifest,
  patchBiomeDocument,
  patchBiomeStarterPrefab,
  patchPrimaryMaterial,
  patchWorldStructureBiomeRefs,
  customEnvironmentId,
} from "@/utils/packWizard/buildPackManifest";

describe("packWizardTemplates", () => {
  it("exposes expected world structure template ids", () => {
    const ids = WORLD_STRUCTURE_TEMPLATES.map((t) => t.id);
    expect(ids).toContain("basic");
    expect(ids).toContain("void");
    expect(ids).toContain("forest-hills");
  });

  it("exposes reference biome templates", () => {
    expect(ALL_BIOME_TEMPLATES.some((t) => t.id === "reference:TwistWorldBiome")).toBe(true);
  });

  it("slugifies pack identifiers safely", () => {
    expect(slugifyPackIdentifier("My Biome")).toBe("My_Biome");
    expect(slugifyHytaleModName("My Pack")).toBe("My-Pack");
  });

  it("builds project path under target directory", () => {
    expect(buildProjectPath("C:/Projects", "My Pack")).toBe("C:/Projects/My_Pack");
  });
});

describe("buildPackManifest", () => {
  it("writes hytaleGroup and hytaleName into manifest", () => {
    const manifest = buildTerraNovaManifest({ packName: "Sky Islands", packGroup: "User" });
    expect(manifest.hytaleGroup).toBe("User");
    expect(manifest.hytaleName).toBe("Sky-Islands");
    expect(manifest.name).toBe("Sky Islands");
  });

  it("patches world structure biome references", () => {
    const world = {
      Type: "NoiseRange",
      DefaultBiome: "OldBiome",
      Biomes: [{ Biome: "OldBiome", Min: -1, Max: 1 }],
    };
    const patched = patchWorldStructureBiomeRefs(world, "NewBiome");
    expect(patched.DefaultBiome).toBe("NewBiome");
    expect((patched.Biomes as { Biome: string }[])[0]?.Biome).toBe("NewBiome");
  });

  it("strips props when starter props disabled", () => {
    const biome = { Name: "X", Props: [{ Runtime: 1 }] };
    const patched = patchBiomeDocument(biome, "Y", false);
    expect(patched.Name).toBe("Y");
    expect(patched.Props).toEqual([]);
  });

  it("derives custom environment id from biome name", () => {
    expect(customEnvironmentId("ForestHills")).toBe("Env_ForestHills");
  });

  it("injects starter prefab when template props disabled", () => {
    const biome = { Name: "X", Props: [] };
    const patched = patchBiomeStarterPrefab(biome, false, "props/rocks/boulder");
    const props = patched.Props as { PropDistribution: { Prop: { Path: string } } }[];
    expect(props).toHaveLength(1);
    expect(props[0]?.PropDistribution.Prop.Path).toBe("props/rocks/boulder");
  });

  it("appends starter prefab when template props enabled", () => {
    const biome = { Name: "X", Props: [{ Runtime: 1 }] };
    const patched = patchBiomeStarterPrefab(biome, true, "props/trees/oak_large");
    expect(patched.Props).toHaveLength(2);
  });

  it("patches primary material for basic template only", () => {
    const biome = { MaterialProvider: { Type: "Constant", Material: "stone" } };
    expect(patchPrimaryMaterial(biome, "Rock_Stone", "basic").MaterialProvider).toEqual({
      Type: "Constant",
      Material: "Rock_Stone",
    });
    expect(patchPrimaryMaterial(biome, "Rock_Stone", "forest-hills")).toBe(biome);
  });
});
