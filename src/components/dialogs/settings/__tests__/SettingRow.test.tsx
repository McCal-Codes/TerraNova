import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { SettingRow } from "../SettingRow";
import { getById } from "@/settings/index";
import { useSettingsStore } from "@/stores/settingsStore";

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(async () => "/picked/path") }));

describe("SettingRow", () => {
  beforeEach(() => {
    const s = useSettingsStore.getState();
    s.setInstantSaveEnabled(false);
    s.setInstantSaveDebounceMs(200);
    s.setFlowDirection("LR");
  });

  describe("toggle", () => {
    const def = () => getById("editor.instantSave")!;

    it("renders as a switch reflecting the store value", () => {
      render(<SettingRow def={def()} />);
      const control = screen.getByRole("switch", { name: /instant save/i });
      expect(control).toHaveAttribute("aria-checked", "false");
    });

    it("writes through to the store when toggled", () => {
      render(<SettingRow def={def()} />);
      fireEvent.click(screen.getByRole("switch", { name: /instant save/i }));
      expect(useSettingsStore.getState().instantSaveEnabled).toBe(true);
    });

    it("re-renders from an external store change", () => {
      render(<SettingRow def={def()} />);
      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
      act(() => useSettingsStore.getState().setInstantSaveEnabled(true));
      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    });

    it("binds the description via aria-describedby", () => {
      render(<SettingRow def={def()} />);
      const control = screen.getByRole("switch");
      const describedBy = control.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      expect(document.getElementById(describedBy!)).toHaveTextContent(/write project changes/i);
    });
  });

  describe("modified state", () => {
    it("shows nothing extra at the default value", () => {
      render(<SettingRow def={getById("editor.instantSave")!} />);
      expect(screen.queryByText("Modified")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /reset/i })).not.toBeInTheDocument();
    });

    it("announces modified with text, not color alone", () => {
      useSettingsStore.getState().setInstantSaveEnabled(true);
      render(<SettingRow def={getById("editor.instantSave")!} />);
      expect(screen.getByText("Modified")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /reset instant save to default/i })).toBeInTheDocument();
    });

    it("restores the default when reset is clicked", () => {
      useSettingsStore.getState().setInstantSaveEnabled(true);
      render(<SettingRow def={getById("editor.instantSave")!} />);
      fireEvent.click(screen.getByRole("button", { name: /reset instant save to default/i }));
      expect(useSettingsStore.getState().instantSaveEnabled).toBe(false);
      expect(screen.queryByText("Modified")).not.toBeInTheDocument();
    });
  });

  describe("number", () => {
    const def = () => getById("editor.instantSaveDebounceMs")!;

    it("writes a valid value through to the store", () => {
      render(<SettingRow def={def()} />);
      fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "450" } });
      expect(useSettingsStore.getState().instantSaveDebounceMs).toBe(450);
    });

    it("exposes min/max/step from the control spec", () => {
      render(<SettingRow def={def()} />);
      const input = screen.getByRole("spinbutton");
      expect(input).toHaveAttribute("min", "100");
      expect(input).toHaveAttribute("max", "5000");
    });

    it("clamps below the minimum via the store, so no invalid value is persisted", () => {
      render(<SettingRow def={def()} />);
      fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "10" } });
      expect(useSettingsStore.getState().instantSaveDebounceMs).toBe(100);
    });
  });

  describe("radio", () => {
    const def = () => getById("editor.flowDirection")!;

    it("renders a labelled radiogroup with one option checked", () => {
      render(<SettingRow def={def()} />);
      const group = screen.getByRole("radiogroup", { name: /graph flow direction/i });
      expect(group).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /left to right/i })).toBeChecked();
    });

    it("writes the selected option through to the store", () => {
      render(<SettingRow def={def()} />);
      fireEvent.click(screen.getByRole("radio", { name: /right to left/i }));
      expect(useSettingsStore.getState().flowDirection).toBe("RL");
    });
  });

  describe("panel-owned", () => {
    it("navigates via the deep link instead of rendering a control", () => {
      const onNavigate = vi.fn();
      render(<SettingRow def={getById("performance.maxWorkerThreads")!} onNavigate={onNavigate} />);
      fireEvent.click(screen.getByRole("button", { name: /open/i }));
      expect(onNavigate).toHaveBeenCalledWith({ category: "performance", subTab: "cpu" });
    });

    it("disables the control when no navigation handler is supplied", () => {
      render(<SettingRow def={getById("performance.maxWorkerThreads")!} />);
      expect(screen.getByRole("button", { name: /open/i })).toBeDisabled();
    });
  });
});
