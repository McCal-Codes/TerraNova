import { memo, useEffect, useMemo } from "react";
import type { Plane } from "three";
import {
  BufferGeometry,
  BufferAttribute,
  Color,
  FrontSide,
  MeshStandardMaterial,
} from "three";
import type { VoxelMeshData } from "@/utils/voxelMeshBuilder";

const TINTABLE_MATERIALS = new Set([
  "Grass", "Soil_Grass", "GrassDeep", "GrassDeepSunny",
  "Grass_Dry", "Grass_Dead", "Grass_Swamp", "Grass_Snow",
  "Soil_Moss", "Soil_Leaves", "Soil_Pathway",
  "Soil_Grass_Burnt", "Soil_Grass_Cold", "Soil_Grass_Deep", "Soil_Grass_Dry",
  "Soil_Grass_Full", "Soil_Grass_Sunny", "Soil_Grass_Wet",
  "Plant_Leaves_Oak", "Plant_Leaves_Birch", "Plant_Leaves_Fir",
  "Plant_Leaves_Jungle", "Plant_Leaves_Palm", "Plant_Leaves_Azure",
  "Plant_Leaves_Crystal", "Plant_Leaves_Goldentree", "Plant_Leaves_Amber",
  "Plant_Leaves_Autumn", "Plant_Leaves_Maple",
]);

const SOIL_TINTABLE = new Set([
  "Soil_Dirt", "Soil_Loam", "Soil_Peat", "Tilled_Soil",
]);

const SAND_TINTABLE = new Set([
  "Sand", "Sand_White", "Sand_Red", "Sand_Dark", "Soil_Sand",
]);

const COOL_TINT_MATERIALS = new Set([
  "Grass_Swamp", "Grass_Snow", "Soil_Grass_Cold", "Soil_Grass_Wet",
  "Plant_Leaves_Azure", "Plant_Leaves_Crystal", "Plant_Leaves_Fir", "Plant_Leaves_Birch",
]);

const WARM_TINT_MATERIALS = new Set([
  "Grass_Dry", "Grass_Dead", "Soil_Grass_Burnt", "Soil_Grass_Dry", "Soil_Grass_Sunny",
  "Plant_Leaves_Autumn", "Plant_Leaves_Maple", "Plant_Leaves_Goldentree", "Plant_Leaves_Amber",
  "Plant_Leaves_Burnt", "Plant_Leaves_Fire",
]);

function blendHex(a: string, b: string, t: number): string {
  const ca = new Color(a);
  const cb = new Color(b);
  ca.lerp(cb, t);
  return "#" + ca.getHexString();
}

const VoxelMesh = memo(function VoxelMesh({
  data,
  wireframe,
  tintColor,
  clippingPlanes,
}: {
  data: VoxelMeshData;
  wireframe: boolean;
  tintColor?: string;
  clippingPlanes?: Plane[];
}) {
  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(data.positions, 3));
    geo.setAttribute("normal", new BufferAttribute(data.normals, 3));
    geo.setAttribute("color", new BufferAttribute(data.colors, 3));
    geo.setIndex(new BufferAttribute(data.indices, 1));
    geo.computeBoundingSphere();
    return geo;
  }, [data]);

  const material = useMemo(() => {
    const mat = new MeshStandardMaterial({
      vertexColors: true,
      wireframe,
      color: new Color(tintColor ?? "#ffffff"),
      roughness: data.materialProperties?.roughness ?? 0.8,
      metalness: data.materialProperties?.metalness ?? 0.0,
      emissive: new Color(data.materialProperties?.emissive ?? "#000000"),
      emissiveIntensity: data.materialProperties?.emissiveIntensity ?? 0.0,
      side: FrontSide,
      transparent: false,
      depthWrite: true,
      depthTest: true,
    });
    if (clippingPlanes && clippingPlanes.length > 0) {
      mat.clippingPlanes = clippingPlanes;
      mat.clipIntersection = false;
    }
    return mat;
  }, [wireframe, tintColor, data.materialProperties, clippingPlanes]);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  return (
    <mesh geometry={geometry} material={material} castShadow receiveShadow renderOrder={0} />
  );
});

export const VoxelMeshGroup = memo(function VoxelMeshGroup({
  meshData,
  wireframe,
  color1,
  color2,
  color3,
  clippingPlanes,
}: {
  meshData: VoxelMeshData[];
  wireframe: boolean;
  color1: string;
  color2: string;
  color3: string;
  clippingPlanes?: Plane[];
}) {
  return (
    <>
      {meshData.map((data) => {
        const name = data.materialName ?? "";
        const baseTint = COOL_TINT_MATERIALS.has(name)
          ? color1
          : WARM_TINT_MATERIALS.has(name)
            ? color3
            : color2;

        let tintColor: string | undefined;
        if (TINTABLE_MATERIALS.has(name)) {
          tintColor = baseTint;
        } else if (SOIL_TINTABLE.has(name)) {
          tintColor = blendHex("#ffffff", baseTint, 0.3);
        } else if (SAND_TINTABLE.has(name)) {
          tintColor = blendHex("#ffffff", blendHex(color2, color3, 0.5), 0.15);
        } else {
          tintColor = blendHex("#ffffff", baseTint, 0.1);
        }

        return (
          <VoxelMesh
            key={data.materialIndex}
            data={data}
            wireframe={wireframe}
            tintColor={tintColor}
            clippingPlanes={clippingPlanes}
          />
        );
      })}
    </>
  );
});
