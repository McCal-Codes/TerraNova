import { describe, expect, it, vi, afterEach } from "vitest";

describe("formatShortcut", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses Ctrl labels on non-Mac platforms", async () => {
    vi.stubGlobal("navigator", { userAgent: "Windows NT 10.0" });
    vi.resetModules();
    const { formatShortcut } = await import("../platform");
    expect(formatShortcut("Ctrl+N")).toBe("Ctrl+N");
    expect(formatShortcut("Ctrl+Shift+S")).toBe("Ctrl+Shift+S");
  });

  it("uses Mac symbols on macOS", async () => {
    vi.stubGlobal("navigator", { userAgent: "Macintosh" });
    vi.resetModules();
    const { formatShortcut } = await import("../platform");
    expect(formatShortcut("Ctrl+N")).toBe("⌘N");
    expect(formatShortcut("Ctrl+Shift+S")).toBe("⌘⇧S");
  });
});
