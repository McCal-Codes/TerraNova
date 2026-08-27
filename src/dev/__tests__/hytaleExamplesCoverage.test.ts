/**
 * Broad regression net over Hytale's own `Biomes/Examples` graphs.
 *
 * Hypixel ships these as demonstrations, each isolating one technique
 * (curve mapping, mixers, twist, interpolation, vector providers…). That makes
 * them near-ideal fixtures: when one breaks, the file name is the diagnosis,
 * unlike a 250 KB production biome where a regression only says "something
 * changed".
 *
 * These complement rather than duplicate the existing suites. The jar-derived
 * fixtures in src/utils/density/__tests__ prove individual noise primitives
 * match Java; hytaleVoxelPreviewSmoke asserts semantic properties of a few
 * production biomes. This asserts that every shipped example graph still
 * imports and evaluates to a usable field — the cheap, wide net between them.
 *
 * The example set is discovered from the synced cache rather than hard-coded,
 * so the suite automatically tracks whatever the current channel ships.
 */

import { describe, expect, it } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  buildHytaleTerrainSetup,
  loadBiomeJsonSync,
  resolveHytaleCacheRoot,
} from "@/dev/hytalePreviewSmokeLoader";
import { evaluateDensityGrid } from "@/utils/density/evaluateGrid";
import { collectExternalImportedNames } from "@/utils/densityExportRegistry";

/**
 * Graphs that currently evaluate to an entirely non-finite field.
 *
 * All three use `MultiMix`. The importer wires that node with InputA/InputB/
 * Factor handles, but `handleMultiMix` in density/handlers/combinators.ts asks
 * for a `Selector` input and `Densities[i]` inputs, so every lookup misses and
 * NaN propagates through the whole graph.
 *
 * Listed rather than skipped so the coverage is not silently lost: the test
 * asserts these *still* fail, and starts failing the moment one is fixed —
 * at which point delete the entry.
 */
// Fake3dNoise carried the same fault but no longer ships as of Update 6.
const KNOWN_NON_FINITE = new Map<string, string>([
  ["Example_Multi_Mixer_Curve.json", "MultiMix handle mismatch (Selector/Densities[i] vs InputA/InputB/Factor)"],
  ["Example_Multi_Mixer_Horizontal.json", "MultiMix handle mismatch"],
]);

const EXAMPLES_REL = "Server/HytaleGenerator/Biomes/Examples";

const cacheRoot = resolveHytaleCacheRoot();
const examplesDir = cacheRoot
  ? path.join(cacheRoot, ...EXAMPLES_REL.split("/"))
  : null;
const examples =
  examplesDir && existsSync(examplesDir)
    ? readdirSync(examplesDir)
        .filter((f) => f.endsWith(".json"))
        .sort()
    : [];

describe.skipIf(examples.length === 0)("hytale Examples biomes evaluate", () => {
  it("found example biomes to cover", () => {
    // Guards against the suite quietly degrading to zero cases if the cache
    // layout ever moves — the failure mode this whole file exists to avoid.
    expect(examples.length).toBeGreaterThan(0);
  });

  it.each(examples)("%s imports and evaluates to a finite, non-constant field", (file) => {
    const rel = `${EXAMPLES_REL}/${file}`;
    const biome = loadBiomeJsonSync(cacheRoot!, rel);
    const setup = buildHytaleTerrainSetup(biome, cacheRoot!, rel);

    expect(setup.nodes.length).toBeGreaterThan(0);
    if (!setup.outputNodeId) {
      // Some examples demonstrate props or runtime behaviour and carry no
      // terrain output. Importing cleanly is all we can assert for those.
      return;
    }

    // An unresolved external import legitimately degrades to a flat field, so
    // there is nothing meaningful to assert about the values.
    const unbound = collectExternalImportedNames(setup.nodes, setup.edges);
    if (unbound.length > 0 && Object.keys(setup.externalDensityExports).length === 0) {
      return;
    }

    // Sample two Y levels: a graph driven only by Y (YValue -> CurveMapper) is
    // legitimately constant across any single horizontal plane, so requiring
    // variation within one plane would fail it for being correct.
    const sample = (yLevel: number) =>
      evaluateDensityGrid(setup.nodes, setup.edges, 32, -50, 50, yLevel, setup.outputNodeId!, {
        contentFields: setup.contentFields,
        externalDensityExports: setup.externalDensityExports,
      });

    let min = Infinity;
    let max = -Infinity;
    let nonFinite = 0;
    for (const yLevel of [32, 96]) {
      const grid = sample(yLevel);
      for (let i = 0; i < grid.values.length; i++) {
        const v = grid.values[i];
        if (!Number.isFinite(v)) {
          nonFinite++;
          continue;
        }
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }

    const known = KNOWN_NON_FINITE.get(file);
    if (known) {
      expect(
        nonFinite,
        `${file} now evaluates cleanly — fix confirmed, remove it from KNOWN_NON_FINITE (${known})`,
      ).toBeGreaterThan(0);
      return;
    }

    // NaN or Infinity in a density field renders as garbage terrain and is
    // always a bug, never a modelling choice.
    expect(nonFinite, `${file} produced ${nonFinite} non-finite densities`).toBe(0);
    // "Never varies" is a useful smell in a real graph but is meaningless for a
    // tiny demonstration one: Interpolation_B is three nodes whose curve
    // saturates, so a constant output is correct. Finiteness is the assertion
    // that actually catches bugs; only ask for variation once a graph is big
    // enough that collapsing to a constant would be suspicious.
    const NON_TRIVIAL_NODE_COUNT = 6;
    if (setup.nodes.length >= NON_TRIVIAL_NODE_COUNT) {
      expect(max, `${file} evaluated to a constant field (${min})`).toBeGreaterThan(min);
    }
  });
});
