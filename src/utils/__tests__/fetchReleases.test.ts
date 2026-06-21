import { describe, expect, it } from "vitest";
import { parseReleaseBody } from "@/utils/fetchReleases";

const GITHUB_ALPHA3_BODY = `Third **McCal-Codes** closed-alpha build. **Install:** [Releases](https://github.com/McCal-Codes/TerraNova/releases) — tag \`v0.1.8-alpha.3\`.
**Updates:** Users on \`v0.1.8-alpha.2\` receive this build via the in-app updater.

### Highlights

- **Pre-release node layer** — Cube, Axis, and Angle density nodes with **PRE** badge
- **Smarter property sliders** — Drag the field label to scrub values

### Pre-release nodes

- \`Cube\`, \`Axis\`, and \`Angle\` hidden from palette on release channel
`;

const GITHUB_ALPHA1_BODY = `# TerraNova Alpha Release

## Overview

The first public Alpha build under McCal-Codes is now available for Windows, macOS, and Linux.

> [!WARNING]
> This is an Alpha release. Expect bugs, incomplete features, missing functionality, and occasional instability.

## Highlights

### Onboarding

- Four-step first-run onboarding wizard
- Integrated Hytale asset synchronization

### Create Pack Workflow

- Improved pack creation process
- Prefab browser with category navigation

## Testing Focus Areas

- [ ] First-time onboarding
- [ ] Asset synchronization
`;

describe("parseReleaseBody", () => {
  it("splits GitHub ### sections and skips preamble", () => {
    const sections = parseReleaseBody(GITHUB_ALPHA3_BODY);
    expect(sections.map((s) => s.title)).toEqual(["Highlights", "Pre-release nodes"]);
    expect(sections[0].items[0].label).toBe("Pre-release node layer");
    expect(sections[0].items[0].description).toContain("PRE badge");
    expect(sections[1].items[0].label).toContain("Cube");
  });

  it("expands ## Highlights with ### subsections and skips prose/blockquotes", () => {
    const sections = parseReleaseBody(GITHUB_ALPHA1_BODY);
    expect(sections.map((s) => s.title)).toEqual([
      "Onboarding",
      "Create Pack Workflow",
      "Testing Focus Areas",
    ]);
    expect(sections.some((s) => s.items.some((i) => i.label.includes("#")))).toBe(false);
    expect(sections.some((s) => s.items.some((i) => i.label.includes("WARNING")))).toBe(false);
    expect(sections[0].items[0].label).toBe("Four-step first-run onboarding wizard");
    expect(sections[2].items[0].label).toBe("First-time onboarding");
  });
});
