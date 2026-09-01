import type { NodeHandler } from "../evalContext";

const handleConditional: NodeHandler = (ctx, fields, inputs, x, y, z) => {
  const cond = ctx.getInput(inputs, "Condition", x, y, z);
  const threshold = Number(fields.Threshold ?? 0);
  return cond >= threshold
    ? ctx.getInput(inputs, "TrueInput", x, y, z)
    : ctx.getInput(inputs, "FalseInput", x, y, z);
};

const handleMin: NodeHandler = (ctx, _fields, inputs, x, y, z) => {
  let result = ctx.getInput(inputs, "Inputs[0]", x, y, z);
  for (let i = 1; inputs.has(`Inputs[${i}]`); i++) {
    result = Math.min(result, ctx.getInput(inputs, `Inputs[${i}]`, x, y, z));
  }
  return result;
};

const handleMax: NodeHandler = (ctx, _fields, inputs, x, y, z) => {
  let result = ctx.getInput(inputs, "Inputs[0]", x, y, z);
  for (let i = 1; inputs.has(`Inputs[${i}]`); i++) {
    result = Math.max(result, ctx.getInput(inputs, `Inputs[${i}]`, x, y, z));
  }
  return result;
};

const handleAverageFunction: NodeHandler = (ctx, _fields, inputs, x, y, z) => {
  let avgSum = 0;
  let avgCount = 0;
  for (let i = 0; inputs.has(`Inputs[${i}]`); i++) {
    avgSum += ctx.getInput(inputs, `Inputs[${i}]`, x, y, z);
    avgCount++;
  }
  return avgCount > 0 ? avgSum / avgCount : 0;
};

const handleMix: NodeHandler = (ctx, _fields, inputs, x, y, z) => {
  const a = ctx.getInput(inputs, "InputA", x, y, z);
  const b = ctx.getInput(inputs, "InputB", x, y, z);
  const hasFactor = inputs.has("Factor");
  const f = hasFactor ? ctx.getInput(inputs, "Factor", x, y, z) : 0.5;
  return a + (b - a) * f;
};

/**
 * Switch — pick the input whose case matches the ambient switch state.
 *
 * V2's field is `SwitchCases` (plus an optional `Default`); `SwitchStates` is a
 * TerraNova-era spelling kept for graphs already saved with it.
 *
 * The comparison is a plain integer equality against `Context.switchState`, which
 * SwitchStateDensity assigns directly as an `int`. It previously ran both sides
 * through `hashSeed`, which only behaved because the old seed helper passed numbers
 * through unchanged — it is a seed derivation, not an integer parser.
 */
const handleSwitch: NodeHandler = (ctx, fields, inputs, x, y, z) => {
  const switchCases = (fields.SwitchCases ?? fields.SwitchStates) as (string | number)[] | undefined;
  if (switchCases && switchCases.length > 0) {
    for (let i = 0; i < switchCases.length; i++) {
      if (Math.trunc(Number(switchCases[i] ?? 0)) === ctx.switchState) {
        const src = inputs.get(`Inputs[${i}]`);
        return src ? ctx.evaluate(src, x, y, z) : 0;
      }
    }
    const fallback = inputs.get("Default");
    return fallback ? ctx.evaluate(fallback, x, y, z) : 0;
  } else {
    const selector = Math.max(0, Math.floor(Number(fields.Selector ?? 0)));
    const src = inputs.get(`Inputs[${selector}]`);
    return src ? ctx.evaluate(src, x, y, z) : 0;
  }
};

const handleBlendCurve: NodeHandler = (ctx, _fields, inputs, x, y, z) => {
  const a = ctx.getInput(inputs, "InputA", x, y, z);
  const b = ctx.getInput(inputs, "InputB", x, y, z);
  const rawFactor = ctx.getInput(inputs, "Factor", x, y, z);
  const curvedFactor = ctx.applyCurve("Curve", rawFactor, inputs);
  return a + (b - a) * curvedFactor;
};

interface MultiMixKeyedEntry {
  Value: number;
  DensityIndex: number;
}

/**
 * `MultiMix` — interpolate between N keyed densities by a selector density.
 *
 * The node carries two key shapes and both are live:
 *
 *  - **Editor form**: `Keys` is a flat number[], densities arrive on
 *    `Densities[i]` handles and the selector on `Selector`.
 *  - **Hytale native form**: `Keys` is [{Value, DensityIndex}], densities
 *    arrive on `Inputs[i]`, and the selector is the one input no key refers to.
 *    Confirmed against Example_Multi_Mixer_Curve/Horizontal and the jar, where
 *    `MultiMixDensity(List<Key>, Density)` takes the keys plus one influence
 *    density with the keyed densities supplied separately via `setInputs`.
 *
 * A third, unrelated shape exists: TerraNova's BlendCurve exports as a 3-input
 * MultiMix with a Curve and no Keys. That is handled by the importer's named
 * handles, never here.
 */
const handleMultiMix: NodeHandler = (ctx, fields, inputs, x, y, z) => {
  const rawKeys = fields.Keys;
  if (!Array.isArray(rawKeys) || rawKeys.length === 0) return 0;

  const keyed = typeof rawKeys[0] === "object" && rawKeys[0] !== null;

  // Normalise both shapes to (value, handle) pairs.
  let entries: { value: number; handle: string }[];
  let selector: number;

  if (keyed) {
    const keys = rawKeys as MultiMixKeyedEntry[];
    let inputCount = 0;
    while (inputs.has(`Inputs[${inputCount}]`)) inputCount++;
    if (inputCount === 0) return 0;

    const referenced = new Set(keys.map((k) => k.DensityIndex));
    let selectorIndex = -1;
    for (let i = 0; i < inputCount; i++) {
      if (!referenced.has(i)) selectorIndex = i;
    }
    if (selectorIndex < 0) selectorIndex = inputCount - 1;

    selector = ctx.getInput(inputs, `Inputs[${selectorIndex}]`, x, y, z);
    entries = keys.map((k) => ({ value: k.Value, handle: `Inputs[${k.DensityIndex}]` }));
  } else {
    const keys = rawKeys as number[];
    selector = ctx.getInput(inputs, "Selector", x, y, z);
    entries = keys.map((value, idx) => ({ value, handle: `Densities[${idx}]` }));
  }

  const at = (handle: string): number => ctx.getInput(inputs, handle, x, y, z);

  // Sort by key value so bracketing works regardless of authoring order.
  const sorted = [...entries].sort((a, b) => a.value - b.value);
  if (selector <= sorted[0].value) return at(sorted[0].handle);
  const last = sorted[sorted.length - 1];
  if (selector >= last.value) return at(last.handle);

  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i];
    const hi = sorted[i + 1];
    if (selector < lo.value || selector > hi.value) continue;
    const span = hi.value - lo.value;
    // Coincident keys would divide by zero; take the lower deterministically.
    if (span === 0) return at(lo.handle);
    const t = (selector - lo.value) / span;
    const a = at(lo.handle);
    const b = at(hi.handle);
    return a + (b - a) * t;
  }
  return at(sorted[0].handle);
};

export function buildCombinatorHandlers(): Map<string, NodeHandler> {
  return new Map<string, NodeHandler>([
    ["Conditional", handleConditional],
    ["Min", handleMin],
    ["MinFunction", handleMin],
    ["Max", handleMax],
    ["MaxFunction", handleMax],
    ["AverageFunction", handleAverageFunction],
    ["Mix", handleMix],
    ["Blend", handleMix],
    ["Switch", handleSwitch],
    ["MultiMix", handleMultiMix],
    ["BlendCurve", handleBlendCurve],
  ]);
}
