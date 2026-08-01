import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettingsDialog } from "../SettingsDialog";

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(async () => "/picked/path") }));

/**
 * Regression: a useEffect had been placed *below* `if (!open) return null`, so
 * the hook count changed when the dialog opened. React threw "Rendered more
 * hooks than during the previous render" and unmounted the whole tree — the
 * app window went blank. Rendering closed-then-open reproduces it exactly.
 *
 * eslint's react-hooks/rules-of-hooks now also guards this statically.
 */
describe("SettingsDialog open/close lifecycle", () => {
  it("renders nothing while closed", () => {
    const { container } = render(<SettingsDialog open={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("opens without changing hook count (no 'Rendered more hooks' crash)", () => {
    const onClose = vi.fn();
    const { rerender } = render(<SettingsDialog open={false} onClose={onClose} />);

    // The transition that used to throw.
    expect(() => rerender(<SettingsDialog open onClose={onClose} />)).not.toThrow();
    expect(screen.getByRole("tablist", { name: /settings categories/i })).toBeInTheDocument();
  });

  it("survives repeated open/close cycles", () => {
    const onClose = vi.fn();
    const { rerender } = render(<SettingsDialog open={false} onClose={onClose} />);
    for (let i = 0; i < 3; i++) {
      expect(() => {
        rerender(<SettingsDialog open onClose={onClose} />);
        rerender(<SettingsDialog open={false} onClose={onClose} />);
      }).not.toThrow();
    }
  });

  it("shows the search box and the category rail when open", () => {
    render(<SettingsDialog open onClose={() => {}} />);
    expect(screen.getByRole("searchbox", { name: /search settings/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /general/i })).toBeInTheDocument();
  });
});
