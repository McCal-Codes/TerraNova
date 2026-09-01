import type { NodeHandler } from "../evalContext";
import { getNodeType } from "../evalTypes";

const handleYOverride: NodeHandler = (ctx, fields, inputs, x, _y, z) => {
  const overrideY = Number(fields.OverrideY ?? fields.Y ?? fields.Value ?? 0);
  return ctx.getInput(inputs, "Input", x, overrideY, z);
};

const handleXOverride: NodeHandler = (ctx, fields, inputs, _x, y, z) => {
  const overrideX = Number(fields.OverrideX ?? fields.Value ?? 0);
  return ctx.getInput(inputs, "Input", overrideX, y, z);
};

const handleZOverride: NodeHandler = (ctx, fields, inputs, x, y) => {
  const overrideZ = Number(fields.OverrideZ ?? fields.Value ?? 0);
  return ctx.getInput(inputs, "Input", x, y, overrideZ);
};

const handleAnchor: NodeHandler = (ctx, fields, inputs, x, y, z) => {
  const isReversed = fields.Reversed === true;
  if (ctx.anchorSet) {
    if (isReversed) {
      return ctx.getInput(inputs, "Input", x + ctx.anchorX, y + ctx.anchorY, z + ctx.anchorZ);
    } else {
      return ctx.getInput(inputs, "Input", x - ctx.anchorX, y - ctx.anchorY, z - ctx.anchorZ);
    }
  } else {
    // V2: when densityAnchor is null, pass through with original position unchanged
    return ctx.getInput(inputs, "Input", x, y, z);
  }
};

const handleExported: NodeHandler = (ctx, _fields, inputs, x, y, z) => {
  return ctx.getInput(inputs, "Input", x, y, z);
};

const handleImported: NodeHandler = (ctx, fields, inputs, x, y, z) => {
  if (inputs.has("Input")) {
    return ctx.getInput(inputs, "Input", x, y, z);
  }
  const key = String(fields.Name ?? fields.ExportAs ?? "").trim();
  if (!key) return 0;

  const nested = ctx.resolveExternalImport(key);
  if (nested) {
    return nested.evaluate(nested.rootId, x, y, z);
  }

  for (const [id, node] of ctx.nodeById) {
    if (getNodeType(node) !== "Exported") continue;
    const nodeFields = (node.data as Record<string, unknown>).fields as Record<string, unknown> | undefined;
    const exportAs = String(nodeFields?.ExportAs ?? nodeFields?.Name ?? "").trim();
    if (exportAs === key) {
      return ctx.evaluate(id, x, y, z);
    }
  }
  return 0;
};

const handleOffset: NodeHandler = (ctx, _fields, inputs, x, y, z) => {
  return ctx.getInput(inputs, "Input", x, y, z) + ctx.getInput(inputs, "Offset", x, y, z);
};

const handleDistance: NodeHandler = (ctx, _fields, inputs, x, y, z) => {
  const dist = Math.sqrt(x * x + y * y + z * z);
  return ctx.applyCurve("Curve", dist, inputs);
};

const handleAmplitude: NodeHandler = (ctx, _fields, inputs, x, y, z) => {
  const v = ctx.getInput(inputs, "Input", x, y, z);
  const amp = ctx.getInput(inputs, "Amplitude", x, y, z);
  return v * amp;
};

const handleYSampled: NodeHandler = (ctx, fields, inputs, x, y, z) => {
  if (inputs.has("YProvider")) {
    const targetY = ctx.getInput(inputs, "YProvider", x, y, z);
    return ctx.getInput(inputs, "Input", x, targetY, z);
  }
  const sampleDist = Number(fields.SampleDistance ?? 4.0);
  const sampleOffset = Number(fields.SampleOffset ?? 0.0);
  if (sampleDist <= 0) {
    return ctx.getInput(inputs, "Input", x, y, z);
  }
  const gridY = Math.floor((y - sampleOffset) / sampleDist);
  const y0 = gridY * sampleDist + sampleOffset;
  const y1 = y0 + sampleDist;
  const v0 = ctx.getInput(inputs, "Input", x, y0, z);
  const v1 = ctx.getInput(inputs, "Input", x, y1, z);
  const ratio = (y - y0) / sampleDist;
  const isInterpolated = fields.IsInterpolated !== false;
  return isInterpolated ? v0 + (v1 - v0) * ratio : (ratio < 0.5 ? v0 : v1);
};

/**
 * SwitchState — evaluate the subtree with the switch state set to a fixed integer.
 *
 * V2's field is `SwitchState`; `State` is a TerraNova-era spelling kept for graphs
 * already saved with it. SwitchStateDensity assigns the value straight into
 * `Context.switchState` as an `int`, so it is truncated, never hashed.
 */
const handleSwitchState: NodeHandler = (ctx, fields, inputs, x, y, z) => {
  const state = Math.trunc(Number(fields.SwitchState ?? fields.State ?? 0));
  if (!inputs.has("Input")) {
    return state;
  }
  const prevState = ctx.switchState;
  ctx.switchState = state;
  try {
    return ctx.getInput(inputs, "Input", x, y, z);
  } finally {
    // Restore even if a nested handler throws, or the state leaks into siblings.
    ctx.switchState = prevState;
  }
};

export function buildOverrideHandlers(): Map<string, NodeHandler> {
  return new Map<string, NodeHandler>([
    ["YOverride", handleYOverride],
    ["XOverride", handleXOverride],
    ["ZOverride", handleZOverride],
    ["Anchor", handleAnchor],
    ["Exported", handleExported],
    ["Imported", handleImported],
    ["ImportedValue", handleImported],
    ["Offset", handleOffset],
    ["Distance", handleDistance],
    ["Amplitude", handleAmplitude],
    ["YSampled", handleYSampled],
    ["SwitchState", handleSwitchState],
  ]);
}
