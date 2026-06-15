/**
 * Manual verification tests for pre-release density node Hytale JSON output.
 *
 * Run with: npx vitest run src/utils/__tests__/prereleaseNodeExport.test.ts
 *
 * These tests print the full Hytale JSON so you can compare against the
 * actual Hytale API docs / pre-release generator schema.
 */
import { describe, it, expect } from "vitest";
import { internalToHytale } from "../internalToHytale";
import { hytaleToInternal } from "../hytaleToInternal";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toHytale(internal: Record<string, unknown>) {
  return internalToHytale(internal as Parameters<typeof internalToHytale>[0]);
}

// ---------------------------------------------------------------------------
// Cube SDF
// ---------------------------------------------------------------------------

describe("Cube SDF — Hytale JSON", () => {
  it("bare Cube with no curve", () => {
    const result = toHytale({ Type: "Cube" });
    // Expected: { $NodeId: "CubeDensityNode-...", Type: "Cube", Skip: false }
    // No Inputs[], no extra fields
    expect(result.Type).toBe("Cube");
    expect(result.Skip).toBe(false);
    expect(result.Inputs).toBeUndefined();
    console.log("\n[Cube — no curve]", JSON.stringify(result, null, 2));
  });

  it("Cube with a Manual curve connected", () => {
    const result = toHytale({
      Type: "Cube",
      Curve: {
        Type: "Manual",
        Points: [[0, 0], [1, 1]],
      },
    });
    // Curve should appear as a nested object (not in Inputs[])
    // because Cube is not in DENSITY_NAMED_TO_ARRAY with a Curve key
    expect(result.Type).toBe("Cube");
    expect(result.Skip).toBe(false);
    console.log("\n[Cube — Manual curve]", JSON.stringify(result, null, 2));
  });

  it("round-trips bare Cube through Hytale format", () => {
    const hytale = {
      $NodeId: "CubeDensityNode-test",
      Type: "Cube",
      Skip: false,
    };
    const { asset } = hytaleToInternal(hytale);
    const exported = toHytale({ Type: asset.Type as string, ...asset });
    expect(exported.Type).toBe("Cube");
    expect(exported.Skip).toBe(false);
    console.log("\n[Cube — round-trip]", JSON.stringify(exported, null, 2));
  });
});

// ---------------------------------------------------------------------------
// Axis SDF
// ---------------------------------------------------------------------------

describe("Axis SDF — Hytale JSON", () => {
  it("Axis with default fields, no curve", () => {
    const result = toHytale({
      Type: "Axis",
      Axis: { x: 0, y: 1, z: 0 },
      IsAnchored: false,
    });
    // Expected: Type, Skip, Axis (as Point3D or plain vector?), IsAnchored
    expect(result.Type).toBe("Axis");
    expect(result.Skip).toBe(false);
    console.log("\n[Axis — default]", JSON.stringify(result, null, 2));
  });

  it("Axis with diagonal direction", () => {
    const result = toHytale({
      Type: "Axis",
      Axis: { x: 1, y: 0, z: 0 },
      IsAnchored: true,
    });
    expect(result.Type).toBe("Axis");
    console.log("\n[Axis — X direction, anchored]", JSON.stringify(result, null, 2));
  });

  it("Axis with Manual curve", () => {
    const result = toHytale({
      Type: "Axis",
      Axis: { x: 0, y: 1, z: 0 },
      IsAnchored: false,
      Curve: {
        Type: "Manual",
        Points: [[0, 0], [1, 1]],
      },
    });
    expect(result.Type).toBe("Axis");
    console.log("\n[Axis — Manual curve]", JSON.stringify(result, null, 2));
  });
});

// ---------------------------------------------------------------------------
// Angle (position node)
// ---------------------------------------------------------------------------

describe("Angle — Hytale JSON", () => {
  it("Angle with default vector (up)", () => {
    const result = toHytale({
      Type: "Angle",
      Vector: { x: 0, y: 1, z: 0 },
      IsAxis: false,
    });
    // Vector should be exported as Point3D { $NodeId, X, Y, Z }
    expect(result.Type).toBe("Angle");
    expect(result.Skip).toBe(false);
    console.log("\n[Angle — up vector]", JSON.stringify(result, null, 2));
  });

  it("Angle with IsAxis=true (treats angle as axis-symmetric)", () => {
    const result = toHytale({
      Type: "Angle",
      Vector: { x: 1, y: 0, z: 0 },
      IsAxis: true,
    });
    expect(result.Type).toBe("Angle");
    console.log("\n[Angle — X axis, IsAxis=true]", JSON.stringify(result, null, 2));
  });

  it("round-trips Angle through Hytale format", () => {
    const hytale = {
      $NodeId: "AngleDensityNode-test",
      Type: "Angle",
      Skip: false,
      Vector: { $NodeId: "Point3D-test", X: 0, Y: 1, Z: 0 },
      IsAxis: false,
    };
    const { asset } = hytaleToInternal(hytale);
    const exported = toHytale({ Type: asset.Type as string, ...asset });
    expect(exported.Type).toBe("Angle");
    console.log("\n[Angle — round-trip]", JSON.stringify(exported, null, 2));
  });
});

// ---------------------------------------------------------------------------
// OffsetConstant (active V2 node, not legacy)
// ---------------------------------------------------------------------------

describe("OffsetConstant — Hytale JSON", () => {
  it("OffsetConstant with Value and connected Input", () => {
    const result = toHytale({
      Type: "OffsetConstant",
      Value: 0.5,
      Input: {
        Type: "SimplexNoise2D",
        Scale: 1.0,
        Seed: "A",
        Octaves: 1,
        Lacunarity: 1.0,
        Persistence: 1.0,
      },
    });
    expect(result.Type).toBe("OffsetConstant");
    expect(result.Skip).toBe(false);
    // Input should be in Inputs[] array
    expect(Array.isArray(result.Inputs)).toBe(true);
    console.log("\n[OffsetConstant]", JSON.stringify(result, null, 2));
  });
});
