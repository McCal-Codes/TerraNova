import { describe, it, expect } from "vitest";
import { createServer } from "node:net";
import {
  computeDependencyFingerprint,
  checkNode,
  hytaleChannelPath,
  isPortFree,
  isPortServing,
  nodeMajor,
  parseLauncherArgs,
  shouldInstall,
} from "../lib/devEnv.mjs";

/**
 * The launcher's decision logic, exercised without spawning a dev server.
 *
 * The behaviours worth pinning are the ones that previously went wrong: starting
 * a second Vite on an occupied port, and reinstalling dependencies on every start.
 */

describe("parseLauncherArgs", () => {
  it("defaults to the desktop build", () => {
    expect(parseLauncherArgs([])).toMatchObject({ mode: "desktop", lab: false, sync: null, install: false });
  });

  it("parses --web, --lab and --install", () => {
    expect(parseLauncherArgs(["--web"]).mode).toBe("web");
    expect(parseLauncherArgs(["--lab"]).lab).toBe(true);
    expect(parseLauncherArgs(["--install"]).install).toBe(true);
  });

  it("parses --sync in both spellings", () => {
    expect(parseLauncherArgs(["--sync", "release"]).sync).toBe("release");
    expect(parseLauncherArgs(["--sync=pre-release"]).sync).toBe("pre-release");
  });

  it("rejects an invalid --sync channel instead of guessing", () => {
    const parsed = parseLauncherArgs(["--sync", "nightly"]);
    expect(parsed.sync).toBeNull();
    expect(parsed.unknown.join(" ")).toContain("--sync");
  });

  it("lets a later mode flag override an earlier one", () => {
    // Wrappers can supply a default that the user overrides on the command line.
    expect(parseLauncherArgs(["--web", "--desktop"]).mode).toBe("desktop");
    expect(parseLauncherArgs(["--desktop", "--web"]).mode).toBe("web");
  });

  it("collects unrecognised arguments rather than throwing", () => {
    expect(parseLauncherArgs(["--wat"]).unknown).toContain("--wat");
  });
});

describe("node version gate", () => {
  it("extracts the major version", () => {
    expect(nodeMajor("v22.11.0")).toBe(22);
    expect(nodeMajor("18.0.0")).toBe(18);
  });

  it("fails an unsupported Node and offers a remedy", () => {
    const check = checkNode("v16.20.0");
    expect(check.status).toBe("fail");
    expect(check.remedy).toBeTruthy();
  });

  it("passes a supported Node", () => {
    expect(checkNode("v22.0.0").status).toBe("pass");
  });
});

describe("dependency freshness", () => {
  const base = {
    lockfile: "lock-a",
    packageJson: "pkg-a",
    nodeVersion: "v22.0.0",
    pnpmVersion: "10.0.0",
  };

  it("is stable for identical inputs", () => {
    expect(computeDependencyFingerprint(base)).toBe(computeDependencyFingerprint({ ...base }));
  });

  it("changes when any input changes", () => {
    const original = computeDependencyFingerprint(base);
    for (const key of ["lockfile", "packageJson", "nodeVersion", "pnpmVersion"] as const) {
      expect(computeDependencyFingerprint({ ...base, [key]: "different" }), key).not.toBe(original);
    }
  });

  it("does not confuse field boundaries", () => {
    // Naive concatenation would collide these two.
    expect(computeDependencyFingerprint({ ...base, lockfile: "a", packageJson: "bc" })).not.toBe(
      computeDependencyFingerprint({ ...base, lockfile: "ab", packageJson: "c" }),
    );
  });

  it("skips installing when everything matches", () => {
    const decision = shouldInstall({
      nodeModulesExists: true,
      storedFingerprint: "same",
      currentFingerprint: "same",
      forceInstall: false,
    });
    expect(decision.install).toBe(false);
  });

  it("installs when node_modules is missing", () => {
    expect(
      shouldInstall({ nodeModulesExists: false, storedFingerprint: "same", currentFingerprint: "same", forceInstall: false }).install,
    ).toBe(true);
  });

  it("installs when the fingerprint changed", () => {
    expect(
      shouldInstall({ nodeModulesExists: true, storedFingerprint: "old", currentFingerprint: "new", forceInstall: false }).install,
    ).toBe(true);
  });

  it("installs when no fingerprint was ever recorded", () => {
    expect(
      shouldInstall({ nodeModulesExists: true, storedFingerprint: null, currentFingerprint: "new", forceInstall: false }).install,
    ).toBe(true);
  });

  it("installs on --install even when current", () => {
    const decision = shouldInstall({
      nodeModulesExists: true,
      storedFingerprint: "same",
      currentFingerprint: "same",
      forceInstall: true,
    });
    expect(decision.install).toBe(true);
    expect(decision.reason).toContain("--install");
  });
});

describe("port probes", () => {
  it("reports a free port as free and not serving", async () => {
    // Port 0 is not probeable; use a high port unlikely to be held.
    const port = 45231;
    expect(await isPortFree(port)).toBe(true);
    expect(await isPortServing(port)).toBe(false);
  });

  it("detects an occupied port, which is what prevents a duplicate Vite", async () => {
    const port = 45232;
    const server = createServer();
    await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
    try {
      expect(await isPortFree(port)).toBe(false);
      expect(await isPortServing(port)).toBe(true);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });
});

describe("hytaleChannelPath", () => {
  it("keeps release and pre-release separate on every platform", () => {
    for (const platform of ["darwin", "win32", "linux"] as const) {
      const env = { HOME: "/home/u", USERPROFILE: "C:\\Users\\u", APPDATA: "C:\\Users\\u\\AppData\\Roaming" };
      const release = hytaleChannelPath("release", platform, env);
      const pre = hytaleChannelPath("pre-release", platform, env);
      expect(release, platform).not.toBe(pre);
      expect(release, platform).toContain("release");
      expect(pre, platform).toContain("pre-release");
    }
  });
});
