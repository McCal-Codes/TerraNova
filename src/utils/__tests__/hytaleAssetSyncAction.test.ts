import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/platform", () => ({
  isTauriRuntime: () => true,
}));

vi.mock("@/utils/hytaleDefaultPaths", () => ({
  resolveDefaultCommonAssetsPath: vi.fn(async () => "C:/Hytale/install/release/package/game/latest/Assets.zip"),
}));

vi.mock("@/utils/ipc", () => ({
  pathExists: vi.fn(async (path: string) => path.includes("Assets.zip")),
  syncHytaleAssets: vi.fn(async () => ({
    filesWritten: 1,
    commonOverlayFilesWritten: 0,
    commonOverlayPath: null,
  })),
  getHytaleAssetCacheRoot: vi.fn(async () => "C:/cache/hytale-assets"),
  checkHytaleAssetStaleness: vi.fn(async () => null),
}));

import { pathExists } from "@/utils/ipc";
import { resolveDefaultCommonAssetsPath } from "@/utils/hytaleDefaultPaths";
import {
  resolveCommonOverlayPathForSync,
  runHytaleAssetSync,
} from "@/utils/hytaleAssetSyncAction";

describe("resolveCommonOverlayPathForSync", () => {
  beforeEach(() => {
    vi.mocked(pathExists).mockImplementation(async (path: string) => path.includes("Assets.zip"));
  });

  it("prefers an explicit overlay path", async () => {
    await expect(
      resolveCommonOverlayPathForSync("C:/source", "C:/custom/Common"),
    ).resolves.toBe("C:/custom/Common");
  });

  it("falls back to installed Assets.zip when overlay path is empty", async () => {
    await expect(
      resolveCommonOverlayPathForSync("C:/source/latest", null),
    ).resolves.toBe("C:/Hytale/install/release/package/game/latest/Assets.zip");
  });

  it("falls back to source path when default Common path is missing", async () => {
    vi.mocked(resolveDefaultCommonAssetsPath).mockResolvedValueOnce("C:/missing.zip");
    vi.mocked(pathExists).mockResolvedValueOnce(false);
    await expect(
      resolveCommonOverlayPathForSync("C:/source/latest", ""),
    ).resolves.toBe("C:/source/latest");
  });
});

describe("runHytaleAssetSync", () => {
  it("syncs with auto-resolved Common overlay when enabled but unset", async () => {
    const outcome = await runHytaleAssetSync({
      sourcePath: "C:/source/latest",
      commonOverlayEnabled: true,
      commonOverlayPath: "",
    });
    expect(outcome.result.filesWritten).toBe(1);
  });
});
