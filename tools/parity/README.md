# Parity harnesses

Numeric ground truth taken from the real Hytale runtime, so "matches the game" is a
test result rather than a claim.

Everything here reads `HytaleServer.jar` from a local game install. The generated
fixtures are committed, so the test suite runs without the game.

## 1. Node parity — working

`Parity.java` + `generate.sh` → `src/utils/density/__tests__/fixtures/fbmParity.json`

Instantiates the real noise classes directly and samples them. Five sections:

| Section | Pins |
|---|---|
| `simplex2d` / `simplex3d` | raw `Simplex.noise` — gradients, permutation table, skew constants |
| `cases` | `SimplexNoiseField.valueAt` — seeded per-octave offsets, frequency/amplitude, normalizer |
| `cellCases` | `CellNoiseField` across all 7 `CellularReturnType`s |
| `defaults` | asset field defaults, **reflected** off freshly constructed asset objects |
| `seedBox` | `SeedBox` chain → the integer seed a node actually receives |

The layers are separate on purpose: a failure in `simplex2d` means the core is wrong,
a failure only in `cases` means the octave/seed layer is. Without the split, one masks
the other — which is exactly how the `mulberry32` bug survived.

Regenerate:

```bash
./tools/parity/generate.sh                 # default: macOS pre-release patchline
./tools/parity/generate.sh /path/to/HytaleServer.jar
```

Consumed by `fbmParity.test.ts`, `noiseDefaultsParity.test.ts`, `seedChain.test.ts`,
and `cellNoiseParity.test.ts` (skipped — see below).

## 2. Whole-graph parity — blocked

`GraphParity.java` decodes real worldgen JSON with the game's **own codecs**, builds
the runtime `Density`, and samples it. That is a stronger check than section 1: it
pins codec field names and defaults, node wiring, seed derivation and evaluation order
for graphs taken verbatim from shipped assets, rather than one primitive at a time.

It compiles and the decode/build/evaluate APIs are all reachable. It is blocked one
step short of running:

```
DensityAsset.CODEC.decode(...)
  → UnknownIdException: No codec registered for 'Type': 'SimplexNoise2D'
```

The type registry is populated by `AssetManager`'s **static initialiser**, and that
transitively requires a live server:

1. `AssetManager.<clinit>` → `HytaleAssetStore.<clinit>`
2. → `Options.getOptionSet()` — fixed by calling `Options.parse(new String[0])`
3. → `HytaleServer.get().getEventBus()` — **null outside a booted server**

Standing up a real `HytaleServer` to decode a JSON file is out of proportion for a
test harness, so the work stopped here rather than growing a server bootstrap.

Two ways forward, in preference order:

1. **Use the existing JVM-golden path.** A `parity:jvm` script and
   `src/dev/jvmGoldenEval/` exist on another branch. That is the same idea, already
   solved, and this harness should be reconciled with it rather than duplicated.
2. **Bypass `AssetManager`.** Register the density types directly against
   `DensityAsset.CODEC.register(name, class, builderCodec)` for each
   `*DensityAsset`, skipping the asset-store machinery entirely. More code, but no
   server needed.

`graphs/` holds the graph set to sample once it runs: noise primitives, the canonical
`Sum(noise, CurveMapper over BaseHeight)` terrain stack, `Min`/`Max`/`Inverter`
carving, the `Mix` band gate, and a `YSampled`/`Scale`/`Slider`/`YOverride` chain.

```bash
javac -cp "$JAR" -d out2 GraphParity.java
java  -cp "$JAR:out2" com.hypixel.hytale.builtin.hytalegenerator.assets.density.GraphParity graphs "world-seed"
```

## Known gap: cell noise

`cellNoiseParity.test.ts` is committed as `describe.skip`. Measured divergence is
~100% for every return type — `voronoiNoise.ts` is an independent Worley
implementation, not the FastNoiseLite path V2 uses. The fix recipe is in that file's
docstring. Its fixture-integrity checks are left active so the eventual fix has a
valid target.
