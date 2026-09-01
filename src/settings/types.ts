import type { ReactNode } from "react";

/**
 * Settings registry types.
 *
 * The registry owns *metadata* about settings — labels, defaults, categories,
 * search terms — and reaches values through `read`/`write` closures that wrap
 * the existing Zustand stores. It is deliberately NOT a persistence layer:
 * `tn-settings` and `tn-config` remain the single source of truth on disk.
 */

export type SettingScope = "user" | "project";

export const SETTINGS_CATEGORIES = [
  "general",
  "editor",
  "performance",
  "files",
  "assets",
  "shortcuts",
  "account",
  "developer",
  "updates",
  "about",
] as const;

export type CategoryId = (typeof SETTINGS_CATEGORIES)[number];

export interface SettingOption<T> {
  value: T;
  label: string;
  description?: string;
  /** Rendered as a small trailing hint, e.g. "Default". */
  badge?: string;
}

export interface CustomRenderContext<T> {
  value: T;
  onChange: (value: T) => void;
  /** DOM id to attach to the primary control, for label association. */
  controlId: string;
  /** Space-separated ids to place in aria-describedby. */
  describedBy: string | undefined;
  invalid: boolean;
}

/**
 * Discriminated union — the control kind constrains the value type at the
 * `defineSetting` call site, so `kind: "toggle"` with a numeric default is a
 * compile error rather than a runtime surprise.
 */
export type ControlSpec<T> =
  | { kind: "toggle" }
  | { kind: "radio"; options: ReadonlyArray<SettingOption<T>> }
  | { kind: "select"; options: ReadonlyArray<SettingOption<T>> }
  | { kind: "number"; min?: number; max?: number; step?: number; unit?: string }
  | {
      kind: "path";
      mode: "file" | "directory";
      placeholder?: string;
      /**
       * Paths stay typeable, not just pickable. Some of these point inside a
       * zip or at a folder the picker cannot reach, so removing the text field
       * would take away the only way to set them.
       */
      readOnly?: boolean;
      /** Adds a "Default" button that resolves the OS-appropriate location. */
      resolveDefault?: () => Promise<string>;
    }
  | { kind: "custom"; render: (ctx: CustomRenderContext<T>) => ReactNode }
  /**
   * Rendered by an owning panel rather than as a row (e.g. the CPU/GPU/RAM tabs
   * of Preview & performance, or the shortcuts editor). Registered so it stays
   * searchable and resettable; search shows a navigation row that follows
   * `deepLink` instead of an inline control.
   */
  | { kind: "panel" };

/** Where a setting lives when it is rendered by a sub-panel rather than a row. */
export interface SettingDeepLink {
  category: CategoryId;
  subTab?: string;
}

export interface SettingDefinition<T = unknown> {
  /** Stable dotted id, e.g. "editor.instantSave". Also matched by search. */
  id: string;
  category: CategoryId;
  /**
   * The key this definition wraps in its owning Zustand store. Set for every
   * setting backed by a single store field; the coverage test uses it to prove
   * no store key is left without a definition. Omit only for settings that are
   * derived or span multiple keys.
   */
  storeKey?: string;
  /** Section slug within the category, e.g. "saving". */
  section: string;
  /** Sentence case. Written as if it will be extracted for localization. */
  label: string;
  description?: string;
  defaultValue: T;
  scopes: readonly SettingScope[];
  searchTerms?: readonly string[];
  control: ControlSpec<T>;
  advanced?: boolean;
  experimental?: boolean;
  requiresRestart?: boolean;
  /** Only shown (and only searchable) when developer mode is on. */
  devOnly?: boolean;
  /**
   * Feature-flag gate. When this returns false the setting is hidden from
   * panels and excluded from search — the same way flag-gated blocks were
   * hidden by the old hand-written UI. Evaluated at render time, not at
   * registration, so build-time flags and runtime capabilities both work.
   */
  available?: () => boolean;
  /** Returns an error message, or null when the value is acceptable. */
  validate?: (value: T) => string | null;
  /** Reads the live value from the owning store. */
  read: () => T;
  /** Writes through the owning store's existing setter. */
  write: (value: T) => void;
  /**
   * Set when the setting is rendered inside a sub-panel (e.g. the CPU/GPU/RAM
   * tabs of Preview & Performance). Search shows a navigation row that jumps
   * there instead of rendering an inline control.
   */
  deepLink?: SettingDeepLink;
}

/**
 * Identity helper that preserves the literal type of `defaultValue` while
 * checking the definition's shape. Prefer this over a bare object literal so
 * that the `ControlSpec<T>` / `defaultValue` relationship is enforced.
 */
export function defineSetting<T>(def: SettingDefinition<T>): SettingDefinition<T> {
  return def;
}

/**
 * Heterogeneous collections of definitions need a single element type.
 * `SettingDefinition<T>` is invariant in T (T appears in both `read`'s return
 * and `write`'s parameter), so `unknown` and `never` both fail — `any` is the
 * standard escape hatch for this shape. Call sites stay type-safe because they
 * are authored through `defineSetting<T>`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySettingDefinition = SettingDefinition<any>;

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  /** Hidden from the rail unless developer mode is enabled. */
  devOnly?: boolean;
  /**
   * Categories rendered wholesale by an existing panel. Their settings still
   * carry registry entries (so they are searchable and resettable), but the
   * category body is not built from rows.
   */
  panelOwned?: boolean;
}
