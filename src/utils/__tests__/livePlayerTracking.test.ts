import { describe, expect, it } from "vitest";
import {
  chunkCoordsFromBlock,
  livePlayerFromDiscovery,
  livePlayerFromInfo,
  livePlayerPositionSourceLabel,
} from "@/utils/livePlayerTracking";
import type { BridgeDiscovery, PlayerInfo } from "@/utils/ipc";

describe("livePlayerTracking", () => {
  it("maps discovery coords", () => {
    const d: BridgeDiscovery = {
      portOpen: true,
      saveName: "Test",
      playerX: 407.2,
      playerY: 65,
      playerZ: 88.1,
      playerPositionSource: "server_log",
    };
    const live = livePlayerFromDiscovery(d);
    expect(live).toEqual({
      x: 407.2,
      y: 65,
      z: 88.1,
      source: "server_log",
      worldLabel: undefined,
    });
  });

  it("returns null when discovery lacks coords", () => {
    expect(livePlayerFromDiscovery({ portOpen: false, saveName: "X" })).toBeNull();
  });

  it("maps player info", () => {
    const info: PlayerInfo = {
      name: "McCal",
      uuid: "u",
      x: 1,
      z: 2,
      positionSource: "per_world",
    };
    expect(livePlayerFromInfo(info)?.source).toBe("per_world");
  });

  it("chunk coords from block", () => {
    expect(chunkCoordsFromBlock(407, 88)).toEqual({ cx: 12, cz: 2 });
  });

  it("labels position sources", () => {
    expect(livePlayerPositionSourceLabel("per_world")).toContain("PerWorldData");
    expect(livePlayerPositionSourceLabel("server_log")).toContain("log");
  });
});
