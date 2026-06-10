import { describe, expect, it } from "vitest";
import {
  describeEnvironmentProvider,
  isEmptyEnvironmentProvider,
  usesServerDefaultEnvironment,
} from "../environmentProvider";

describe("environmentProvider", () => {
  it("detects empty object as server default", () => {
    expect(isEmptyEnvironmentProvider({})).toBe(true);
    expect(usesServerDefaultEnvironment({})).toBe(true);
    expect(describeEnvironmentProvider({})).toBe("uses server default");
  });

  it("treats Type Default as server default", () => {
    expect(usesServerDefaultEnvironment({ Type: "Default" })).toBe(true);
    expect(describeEnvironmentProvider({ Type: "Default" })).toBe("uses server default");
  });

  it("describes constant environment names", () => {
    expect(describeEnvironmentProvider({
      Type: "Constant",
      Environment: "Env_Zone1_Forests",
    })).toBe("Env_Zone1_Forests");
  });

  it("does not treat typed providers as empty", () => {
    expect(isEmptyEnvironmentProvider({ Type: "Constant", Environment: "Env_Zone1" })).toBe(false);
  });
});
