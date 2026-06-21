import { describe, expect, it } from "vitest";
import {
  CloudRain,
  CloudSun,
  Image,
  Moon,
  Mountain,
  Star,
  TreePine,
  Waves,
} from "lucide-react";
import { getFileIconSpec, getReferencedAssetKindIcon } from "@/utils/fileTreeIcons";

describe("getFileIconSpec", () => {
  it("maps biome json to Mountain", () => {
    expect(getFileIconSpec("Server/HytaleGenerator/Biomes/Autumn.json").Icon).toBe(Mountain);
  });

  it("maps weather json to CloudRain", () => {
    expect(getFileIconSpec("Weather_Clear.json").Icon).toBe(CloudRain);
  });

  it("maps environment json to TreePine", () => {
    expect(getFileIconSpec("Env_Zone1_Plains.json").Icon).toBe(TreePine);
  });

  it("maps density json to Waves", () => {
    expect(getFileIconSpec("Terrain_Density.json").Icon).toBe(Waves);
  });

  it("maps png to Image", () => {
    expect(getFileIconSpec("texture.png").Icon).toBe(Image);
  });
});

describe("getReferencedAssetKindIcon", () => {
  it("maps environment-weather to CloudSun", () => {
    expect(
      getReferencedAssetKindIcon({ kind: "environment-weather", label: "Weather_Clear" }),
    ).toBe(CloudSun);
  });

  it("maps Moon weather textures", () => {
    expect(
      getReferencedAssetKindIcon({ kind: "weather-texture", label: "MoonTexture" }),
    ).toBe(Moon);
  });

  it("maps Stars weather textures", () => {
    expect(
      getReferencedAssetKindIcon({ kind: "weather-texture", label: "Stars" }),
    ).toBe(Star);
  });

  it("falls back weather textures to Image", () => {
    expect(
      getReferencedAssetKindIcon({ kind: "weather-texture", label: "SunGlow" }),
    ).toBe(Image);
  });
});
