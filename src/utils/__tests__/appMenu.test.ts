import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MENU_ACTIONS, MENU_EVENT, isMenuAction } from "@/utils/appMenu";

/**
 * The native menu's ids live in Rust and its behaviour lives in TypeScript, so
 * the two can drift: an item added to menu.rs with no handler produces a menu
 * entry that silently does nothing, and a renamed id breaks an existing one.
 * Neither shows up in a type error. These tests are the tripwire.
 */

const MENU_RS = resolve(__dirname, "../../../src-tauri/src/menu.rs");
const APP_TSX = resolve(__dirname, "../../App.tsx");
const HOME_TSX = resolve(__dirname, "../../components/home/HomeScreen.tsx");

function rustMenuIds(): string[] {
  const source = readFileSync(MENU_RS, "utf8");
  // Only the `pub mod ids` block — MENU_EVENT is a const of the same shape but
  // is the event name, not a menu id.
  const block = source.slice(source.indexOf("pub mod ids {"));
  const body = block.slice(0, block.indexOf("\n}"));
  return [...body.matchAll(/pub const [A-Z_]+: &str = "([^"]+)";/g)].map((m) => m[1]!);
}

describe("native menu ids", () => {
  it("uses the same event name as the Rust side", () => {
    expect(readFileSync(MENU_RS, "utf8")).toContain(`"${MENU_EVENT}"`);
  });

  it("declares exactly the ids Rust defines", () => {
    expect([...MENU_ACTIONS].sort()).toEqual(rustMenuIds().sort());
  });

  it("has a handler registered somewhere for every action", () => {
    // Handlers are split across the two shells by context — Home has no Save,
    // the editor has no Getting Started — so the union is what must be complete.
    const wiring = readFileSync(APP_TSX, "utf8") + readFileSync(HOME_TSX, "utf8");
    const unhandled = MENU_ACTIONS.filter((action) => !wiring.includes(`"${action}"`));
    expect(
      unhandled,
      `menu items that would do nothing when clicked: ${unhandled.join(", ")}`,
    ).toEqual([]);
  });

  it("uses dotted lowercase ids so the menu they belong to is obvious", () => {
    for (const action of MENU_ACTIONS) {
      expect(action, action).toMatch(/^[a-z]+\.[a-z-]+$/);
    }
  });
});

describe("isMenuAction", () => {
  it("accepts every declared action", () => {
    for (const action of MENU_ACTIONS) expect(isMenuAction(action)).toBe(true);
  });

  it("rejects anything else, so a stale id from an older build is ignored", () => {
    for (const value of ["file.nope", "", null, undefined, 42, {}]) {
      expect(isMenuAction(value)).toBe(false);
    }
  });
});
