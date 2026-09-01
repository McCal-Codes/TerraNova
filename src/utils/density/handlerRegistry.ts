import type { NodeHandler } from "./evalContext";

/**
 * Extension point for density node handlers.
 *
 * TerraNova implements the V2 density types it knows about, and resolves
 * anything else to 0 by following an `Input` handle if one exists. That is a
 * sensible fallback but a destructive one when it is wrong: 0 is a meaningful
 * density, so a single unhandled node under a `Max` lifts every air sample to
 * solid and flattens an entire biome into a slab.
 *
 * Rather than force every new or niche node type into the core, this lets a
 * caller supply handlers at runtime:
 *
 * ```ts
 * registerDensityHandlers({
 *   MyNode: (ctx, fields, inputs, x, y, z) => ctx.getInput(inputs, "Input", x, y, z) * 2,
 * });
 * ```
 *
 * Handlers registered here are merged by `buildAllHandlers()` when an
 * evaluation context is created, and registered types stop being reported as
 * unsupported by `getEvalStatus`.
 *
 * Registration is global and affects contexts created *after* it. Register
 * during start-up, before the first preview evaluation.
 */

const extraHandlers = new Map<string, NodeHandler>();

/**
 * Add or replace density handlers.
 *
 * A key that already exists — whether built in or previously registered — is
 * replaced, so the most recent registration wins. That is deliberate: it allows
 * a caller to correct a built-in handler as well as add a missing one. Returns
 * a function that removes exactly the handlers this call installed.
 */
export function registerDensityHandlers(
  handlers: Record<string, NodeHandler> | Map<string, NodeHandler>,
): () => void {
  const entries = handlers instanceof Map ? [...handlers] : Object.entries(handlers);
  for (const [type, handler] of entries) {
    if (typeof type === "string" && type && typeof handler === "function") {
      extraHandlers.set(type, handler);
    }
  }
  return () => {
    for (const [type, handler] of entries) {
      // Only remove if still ours — a later registration for the same type owns it now.
      if (extraHandlers.get(type) === handler) extraHandlers.delete(type);
    }
  };
}

/** Remove every registered handler. Intended for tests. */
export function clearRegisteredDensityHandlers(): void {
  extraHandlers.clear();
}

/** Handlers registered so far, in registration order. */
export function getRegisteredDensityHandlers(): Map<string, NodeHandler> {
  return new Map(extraHandlers);
}

/** True when a type has a handler supplied through this extension point. */
export function hasRegisteredDensityHandler(type: string): boolean {
  return extraHandlers.has(type);
}
