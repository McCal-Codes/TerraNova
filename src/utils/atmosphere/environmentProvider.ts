/**
 * Helpers for biome EnvironmentProvider JSON — including empty `{}` (server default).
 */

export function isEmptyEnvironmentProvider(provider: unknown): boolean {
  return (
    provider !== undefined
    && provider !== null
    && typeof provider === "object"
    && !Array.isArray(provider)
    && Object.keys(provider as object).length === 0
  );
}

export function usesServerDefaultEnvironment(provider: unknown): boolean {
  if (provider === undefined || provider === null) return true;
  if (isEmptyEnvironmentProvider(provider)) return true;
  if (typeof provider !== "object" || Array.isArray(provider)) return false;
  const type = (provider as Record<string, unknown>).Type;
  return type === "Default";
}

/** Short label for biome dashboard, diagnostics, and property panels. */
export function describeEnvironmentProvider(provider: unknown): string {
  if (provider === undefined || provider === null) return "—";
  if (usesServerDefaultEnvironment(provider)) return "uses server default";

  if (typeof provider !== "object" || Array.isArray(provider)) return "—";
  const record = provider as Record<string, unknown>;
  const type = typeof record.Type === "string" ? record.Type : "";

  if (type === "Constant" && typeof record.Environment === "string" && record.Environment.trim()) {
    return record.Environment.trim();
  }
  if ((type === "Imported" || type === "Exported") && typeof record.Name === "string" && record.Name.trim()) {
    return record.Name.trim();
  }
  if (type) return type;

  return "—";
}
