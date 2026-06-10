import { describe, it, expect } from "vitest";
import { summarizeJsonDiff } from "../jsonDiffSummary";

describe("summarizeJsonDiff", () => {
  it("reports equal documents", () => {
    const doc = { Type: "Constant", Value: 1 };
    const result = summarizeJsonDiff(doc, { ...doc });
    expect(result.equal).toBe(true);
    expect(result.onlyInInternal).toEqual([]);
    expect(result.onlyInHytale).toEqual([]);
  });

  it("lists top-level key differences", () => {
    const result = summarizeJsonDiff({ a: 1, b: 2 }, { a: 1, c: 3 });
    expect(result.equal).toBe(false);
    expect(result.onlyInInternal).toEqual(["b"]);
    expect(result.onlyInHytale).toEqual(["c"]);
  });
});
