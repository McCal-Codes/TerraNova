import { describe, it, expect } from "vitest";
import {
  filterDevLabCases,
  getDevLabCase,
  getDevLabCases,
  getDevLabCategories,
  validateDevLabRegistry,
  galleryCaseIdOf,
} from "../devLabCaseRegistry";
import { computeMetrics, runDevLabCase, serialiseResult } from "../devLabRunner";
import {
  aggregateStatus,
  isDevLabCategory,
  isSafeCacheRelativePath,
  type DevLabCase,
} from "../devLabTypes";

const baseCase: DevLabCase = {
  id: "test:example",
  title: "Example",
  description: "",
  category: "Density",
  tags: ["unit"],
  source: { kind: "synthetic", setupId: "example" },
  preview: { mode: "2d" },
  expected: { summary: "Evaluates cleanly." },
};

const node = (id: string, type: string) => ({ id, position: { x: 0, y: 0 }, data: { type, fields: {} } });

describe("registry integrity", () => {
  it("has no problems", () => {
    expect(validateDevLabRegistry()).toEqual([]);
  });

  it("adapts existing gallery cases rather than shipping an empty registry", () => {
    const cases = getDevLabCases();
    expect(cases.length).toBeGreaterThan(0);
    expect(cases.some((c) => c.id.startsWith("gallery:"))).toBe(true);
  });

  it("gives every case a unique id", () => {
    const ids = getDevLabCases().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses only known categories", () => {
    for (const c of getDevLabCases()) expect(isDevLabCategory(c.category), c.id).toBe(true);
  });

  it("maps adapted cases back to their gallery id", () => {
    const adapted = getDevLabCases().find((c) => c.id.startsWith("gallery:"))!;
    expect(galleryCaseIdOf(adapted)).toBe(adapted.id.slice("gallery:".length));
    expect(galleryCaseIdOf({ ...baseCase, id: "hand:one" })).toBeNull();
  });

  it("reports duplicates, bad categories and unsafe paths", () => {
    const problems = validateDevLabRegistry([
      baseCase,
      baseCase, // duplicate id
      { ...baseCase, id: "bad-cat", category: "Nope" as never },
      {
        ...baseCase,
        id: "bad-path",
        source: { kind: "hytale-cache", relativePath: "../../etc/passwd" },
      },
      { ...baseCase, id: "no-summary", expected: { summary: "  " } },
    ]);
    const messages = problems.map((p) => p.message).join("|");
    expect(messages).toContain("duplicate case id");
    expect(messages).toContain("unknown category");
    expect(messages).toContain("unsafe");
    expect(messages).toContain("summary");
  });

  it("looks up and filters", () => {
    const first = getDevLabCases()[0];
    expect(getDevLabCase(first.id)?.id).toBe(first.id);
    expect(getDevLabCategories().length).toBeGreaterThan(0);
    expect(filterDevLabCases(getDevLabCases(), { search: "zzz-no-match" })).toHaveLength(0);
    expect(filterDevLabCases([baseCase], { search: "exam" })).toHaveLength(1);
    expect(filterDevLabCases([baseCase], { category: "Materials" })).toHaveLength(0);
    expect(filterDevLabCases([baseCase], { category: "all" })).toHaveLength(1);
  });
});

describe("cache path safety", () => {
  it("rejects anything that could escape the managed cache", () => {
    expect(isSafeCacheRelativePath("Biomes/Plains1/Plains1_River.json")).toBe(true);
    expect(isSafeCacheRelativePath("../secrets")).toBe(false);
    expect(isSafeCacheRelativePath("Biomes/../../etc/passwd")).toBe(false);
    expect(isSafeCacheRelativePath("Biomes\\..\\..\\secrets")).toBe(false);
    expect(isSafeCacheRelativePath("/etc/passwd")).toBe(false);
    expect(isSafeCacheRelativePath("\\\\server\\share")).toBe(false);
    expect(isSafeCacheRelativePath("C:\\Windows")).toBe(false);
    expect(isSafeCacheRelativePath("")).toBe(false);
  });

  it("tolerates a redundant separator, which is untidy but not an escape", () => {
    expect(isSafeCacheRelativePath("a//b")).toBe(true);
  });
});

describe("metrics", () => {
  it("summarises a field", () => {
    const m = computeMetrics({ values: [-1, 0, 1, 2] });
    expect(m.minDensity).toBe(-1);
    expect(m.maxDensity).toBe(2);
    expect(m.meanDensity).toBeCloseTo(0.5);
    // Strictly greater than zero counts as solid, matching the runtime rule.
    expect(m.solidRatio).toBeCloseTo(0.5);
  });

  it("ignores non-finite values when averaging", () => {
    const m = computeMetrics({ values: [1, NaN, 3] });
    expect(m.meanDensity).toBeCloseTo(2);
  });
});

describe("runner", () => {
  const run = (over: Partial<Parameters<typeof runDevLabCase>[1]> = {}, c: DevLabCase = baseCase) =>
    runDevLabCase(c, {
      nodes: [node("a", "Constant")],
      edges: [],
      sample: { values: [0.5, -0.5] },
      durationMs: 12,
      ...over,
    });

  it("passes a clean case", () => {
    const result = run();
    expect(result.status).toBe("passed");
    expect(result.metrics.durationMs).toBe(12);
  });

  it("fails on non-finite densities", () => {
    const result = run({ sample: { values: [0, NaN] } });
    expect(result.status).toBe("failed");
    expect(result.diagnostics.some((d) => d.code === "non-finite")).toBe(true);
  });

  it("fails on an evaluation error", () => {
    const result = run({ evaluationError: "worker died" });
    expect(result.status).toBe("failed");
  });

  it("fails when a required node type is absent", () => {
    const result = run({}, { ...baseCase, expected: { summary: "x", requiredNodeTypes: ["Graph"] } });
    expect(result.status).toBe("failed");
    expect(result.diagnostics.some((d) => d.code === "missing-required-node")).toBe(true);
  });

  it("reports an unsupported node type without calling it a failure", () => {
    const result = run({ nodes: [node("a", "TotallyNotARealNodeType")] });
    expect(result.status).toBe("unsupported");
    expect(result.unsupportedNodeTypes).toContain("TotallyNotARealNodeType");
  });

  it("warns rather than fails when a metric leaves its band", () => {
    const result = run({}, { ...baseCase, expected: { summary: "x", ranges: { solidRatio: { min: 0.9 } } } });
    expect(result.status).toBe("warning");
    expect(result.diagnostics.some((d) => d.code === "out-of-range")).toBe(true);
  });

  it("treats an empty sample as a failure", () => {
    expect(run({ sample: { values: [] } }).status).toBe("failed");
    expect(run({ sample: null }).status).toBe("failed");
  });

  it("serialises deterministically", () => {
    expect(serialiseResult(run())).toBe(serialiseResult(run()));
  });

  // `startedAt` is a wall-clock timestamp. Two runs either side of a millisecond
  // boundary used to produce different strings, which made the test above flaky
  // and made real report diffs useless.
  it("excludes wall-clock fields from the stable serialisation", () => {
    const json = serialiseResult(run());
    expect(json).not.toContain("startedAt");
    expect(json).not.toContain("durationMs");
  });

  // Regression: the previous implementation passed an array as JSON.stringify's
  // replacer, which applies the allowlist at every nesting level — it emptied
  // every diagnostic and stripped metrics down to one field.
  it("keeps nested content when serialising", () => {
    const parsed = JSON.parse(serialiseResult(run({ sample: { values: [0, NaN] } }))) as {
      metrics: Record<string, unknown>;
      diagnostics: Record<string, unknown>[];
    };

    expect(Object.keys(parsed.metrics)).toEqual(
      expect.arrayContaining(["minDensity", "maxDensity", "meanDensity", "solidRatio"]),
    );
    expect(parsed.diagnostics.length).toBeGreaterThan(0);
    for (const diagnostic of parsed.diagnostics) {
      expect(Object.keys(diagnostic)).toEqual(
        expect.arrayContaining(["severity", "code", "message"]),
      );
    }
  });

  it("sorts keys at every level, not just the top", () => {
    const parsed = JSON.parse(serialiseResult(run())) as Record<string, unknown>;
    const topKeys = Object.keys(parsed);
    expect(topKeys).toEqual([...topKeys].sort());
    const metricKeys = Object.keys(parsed.metrics as Record<string, unknown>);
    expect(metricKeys).toEqual([...metricKeys].sort());
  });
});

describe("aggregateStatus", () => {
  it("lets the worst status win", () => {
    expect(aggregateStatus(["passed", "failed"])).toBe("failed");
    expect(aggregateStatus(["passed", "unsupported"])).toBe("unsupported");
    expect(aggregateStatus(["passed", "warning"])).toBe("warning");
    expect(aggregateStatus(["passed"])).toBe("passed");
    expect(aggregateStatus([])).toBe("not-run");
  });
});
