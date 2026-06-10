import { describe, expect, it, vi, beforeEach } from "vitest";
import { validatePackWizardTargetPath } from "../validatePackWizardTargetPath";

vi.mock("@/utils/ipc", () => ({
  pathExists: vi.fn(),
  listDirectory: vi.fn(),
}));

import { listDirectory, pathExists } from "@/utils/ipc";

describe("validatePackWizardTargetPath", () => {
  beforeEach(() => {
    vi.mocked(pathExists).mockReset();
    vi.mocked(listDirectory).mockReset();
  });

  it("allows a path that does not exist yet", async () => {
    vi.mocked(pathExists).mockResolvedValue(false);
    await expect(validatePackWizardTargetPath("C:/Packs/NewPack")).resolves.toBeNull();
  });

  it("allows an empty existing folder", async () => {
    vi.mocked(pathExists).mockResolvedValue(true);
    vi.mocked(listDirectory).mockResolvedValue([]);
    await expect(validatePackWizardTargetPath("C:/Packs/Empty")).resolves.toBeNull();
  });

  it("rejects a non-empty folder", async () => {
    vi.mocked(pathExists).mockResolvedValue(true);
    vi.mocked(listDirectory).mockResolvedValue([
      { name: "manifest.json", path: "x", is_dir: false },
    ]);
    await expect(validatePackWizardTargetPath("C:/Packs/Taken")).resolves.toMatch(/already has files/);
  });
});
