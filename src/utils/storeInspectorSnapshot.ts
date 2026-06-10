/** Sanitize store state for dev inspector display (omit heavy buffers by default). */

function summarizeTypedArray(value: ArrayBufferView): string {
  const len = "length" in value && typeof value.length === "number" ? value.length : value.byteLength;
  const ctor = value.constructor.name;
  return `<${ctor}[${len}]>`;
}

export function sanitizeForInspector(value: unknown, includeBuffers = false, depth = 0): unknown {
  if (depth > 8) return "<max-depth>";

  if (value === null || value === undefined) return value;

  if (typeof value === "function") return "<function>";

  if (ArrayBuffer.isView(value)) {
    if (includeBuffers) {
      if (value instanceof Float32Array || value instanceof Float64Array) {
        return Array.from(value);
      }
      return Array.from(value as unknown as Iterable<number>);
    }
    return summarizeTypedArray(value);
  }

  if (value instanceof ArrayBuffer) {
    return includeBuffers ? `<ArrayBuffer[${value.byteLength}]>` : `<ArrayBuffer[${value.byteLength}]>`;
  }

  if (Array.isArray(value)) {
    if (value.length > 200 && !includeBuffers) {
      return [...value.slice(0, 20).map((v) => sanitizeForInspector(v, includeBuffers, depth + 1)), `…+${value.length - 20} more`];
    }
    return value.map((v) => sanitizeForInspector(v, includeBuffers, depth + 1));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    const entries = Object.entries(value as Record<string, unknown>);
    const limit = entries.length > 80 ? 80 : entries.length;
    for (let i = 0; i < limit; i++) {
      const [k, v] = entries[i];
      out[k] = sanitizeForInspector(v, includeBuffers, depth + 1);
    }
    if (entries.length > limit) {
      out["…"] = `+${entries.length - limit} keys omitted`;
    }
    return out;
  }

  return value;
}
