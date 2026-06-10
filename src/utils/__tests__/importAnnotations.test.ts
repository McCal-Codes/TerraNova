import { describe, it, expect } from "vitest";
import type { Node } from "@xyflow/react";
import { parseNodeEditorMetadata } from "../hytaleToInternal";
import {
  buildAnnotationNodesFromImportMetadata,
  buildAutoFrameNodes,
  hasImportAnnotations,
  fitAnnotationNodesToGraph,
  mergeImportGraph,
  propCommentToFrameTitle,
  resolveAutoFrameSectionTitle,
} from "../importAnnotations";
import { layerCanvasNodes } from "../annotationUtils";
import type { ImportMetadata } from "../hytaleToInternal";

describe("parseNodeEditorMetadata", () => {
  it("reads $Text and $Width from Hytale comment metadata", () => {
    const parsed = parseNodeEditorMetadata({
      $Comments: [
        {
          $Text: "Shape the ridge here",
          $Position: { $x: 56, $y: 78 },
          $Width: 240,
          $Height: 96,
        },
      ],
      $Groups: [
        {
          $name: "Terrain Notes",
          $Position: { $x: 90, $y: 120 },
          $width: 420,
          $height: 260,
        },
      ],
    });

    expect(parsed.hytaleComments).toHaveLength(1);
    expect(parsed.hytaleComments[0].text).toBe("Shape the ridge here");
    expect(parsed.hytaleComments[0].width).toBe(240);
    expect(parsed.hytaleComments[0].height).toBe(96);
    expect(parsed.hytaleGroups[0].name).toBe("Terrain Notes");
  });

  it("falls back to lowercase $text for legacy files", () => {
    const parsed = parseNodeEditorMetadata({
      $Comments: [{ $text: "legacy note", $Position: { $x: 1, $y: 2 } }],
    });
    expect(parsed.hytaleComments[0].text).toBe("legacy note");
  });
});

describe("buildAnnotationNodesFromImportMetadata", () => {
  const metadata: ImportMetadata = {
    comments: {},
    nodeIds: {},
    nodePositions: {},
    nodeEditorMetadata: { $Comments: [], $Groups: [] },
    hytaleComments: [
      { text: "Note", x: 10, y: 20, width: 200, height: 80 },
    ],
    hytaleGroups: [
      { name: "Group A", x: 30, y: 40, width: 400, height: 300 },
    ],
  };

  it("creates comment and frame nodes with expected shapes", () => {
    const nodes = buildAnnotationNodesFromImportMetadata(metadata);
    expect(nodes).toHaveLength(2);

    const comment = nodes.find((n) => n.type === "comment");
    const frame = nodes.find((n) => n.type === "frame");

    expect(comment?.position).toEqual({ x: 10, y: 20 });
    expect(comment?.data).toMatchObject({
      type: "comment",
      text: "Note",
      width: 200,
      height: 80,
    });

    expect(frame?.position).toEqual({ x: 30, y: 40 });
    expect(frame?.data).toMatchObject({
      type: "frame",
      name: "Group A",
      width: 400,
      height: 300,
    });
    expect(frame?.zIndex).toBe(-1);
    expect(comment?.zIndex).toBe(1);
  });

  it("returns empty array when metadata is null", () => {
    expect(buildAnnotationNodesFromImportMetadata(null)).toEqual([]);
  });

  it("ignores parsed comments when the file had no $NodeEditorMetadata block", () => {
    expect(buildAnnotationNodesFromImportMetadata({
      comments: {},
      nodeIds: {},
      nodePositions: {},
      hytaleComments: [{ text: "orphan", x: 0, y: 0, width: 1, height: 1 }],
      hytaleGroups: [],
    })).toEqual([]);
  });
});

describe("hasImportAnnotations", () => {
  it("detects comments or groups only when $NodeEditorMetadata was present", () => {
    expect(hasImportAnnotations({
      comments: {},
      nodeIds: {},
      nodePositions: {},
      nodeEditorMetadata: { $Comments: [], $Groups: [] },
      hytaleComments: [{ text: "x", x: 0, y: 0, width: 1, height: 1 }],
      hytaleGroups: [],
    })).toBe(true);
    expect(hasImportAnnotations({
      comments: {},
      nodeIds: {},
      nodePositions: {},
      hytaleComments: [{ text: "x", x: 0, y: 0, width: 1, height: 1 }],
      hytaleGroups: [],
    })).toBe(false);
    expect(hasImportAnnotations(null)).toBe(false);
  });
});

describe("fitAnnotationNodesToGraph", () => {
  it("shifts small annotations near the layouted graph without upscaling", () => {
    const graphNode: Node = {
      id: "n1",
      type: "Constant",
      position: { x: 100, y: 200 },
      data: { type: "Constant", fields: {} },
    };
    const annotation: Node = {
      id: "comment-1",
      type: "comment",
      position: { x: -2000, y: -24000 },
      data: { type: "comment", text: "Far away", width: 200, height: 80 },
    };

    const [fitted] = fitAnnotationNodesToGraph([graphNode], [annotation]);
    expect(fitted.position.x).toBe(148);
    expect(fitted.position.y).toBe(248);
    expect(fitted.data).toMatchObject({ width: 200, height: 80 });
  });

  it("shrinks oversized Hytale frames to wrap the layouted graph", () => {
    const graphNode: Node = {
      id: "n1",
      type: "Constant",
      position: { x: 0, y: 0 },
      data: { type: "Constant", fields: {} },
    };
    const frame: Node = {
      id: "frame-1",
      type: "frame",
      position: { x: -1644, y: -24301 },
      data: { type: "frame", name: "Terrain", width: 6836, height: 8446 },
    };

    const [fitted] = fitAnnotationNodesToGraph([graphNode], [frame]);
    const data = fitted.data as { width: number; height: number };
    expect(data.width).toBeLessThan(400);
    expect(data.height).toBeLessThan(300);
    expect(fitted.position.x).toBeGreaterThanOrEqual(48);
    expect(fitted.position.y).toBeGreaterThanOrEqual(48);
  });
});

describe("layerCanvasNodes", () => {
  it("orders frames before graph nodes and comments after", () => {
    const graph: Node = { id: "n1", type: "Constant", position: { x: 0, y: 0 }, data: {} };
    const frame: Node = { id: "f1", type: "frame", position: { x: 0, y: 0 }, data: {} };
    const comment: Node = { id: "c1", type: "comment", position: { x: 0, y: 0 }, data: {} };

    const layered = layerCanvasNodes([graph], [frame, comment]);
    expect(layered.map((n) => n.id)).toEqual(["f1", "n1", "c1"]);
    expect(layered[0].zIndex).toBe(-1);
    expect(layered[2].zIndex).toBe(1);
  });
});

describe("auto frame helpers", () => {
  it("shortens prop layer comments for frame titles", () => {
    expect(propCommentToFrameTitle(
      "Prop layer AutumnForest_Bones_PrefabDirect: Bone prefab layer.",
    )).toBe("AutumnForest_Bones_PrefabDirect");
    expect(resolveAutoFrameSectionTitle("Terrain")).toBe("Terrain");
    expect(resolveAutoFrameSectionTitle("Props[2]", "Prop layer Foo: bar")).toBe("Foo");
  });

  it("wraps a layouted section in a sized frame when no Hytale metadata exists", () => {
    const graphNode: Node = {
      id: "n1",
      type: "Constant",
      position: { x: 100, y: 120 },
      data: { type: "Constant", fields: {} },
    };
    const [frame] = buildAutoFrameNodes([graphNode], { sectionKey: "Terrain" });
    expect(frame?.type).toBe("frame");
    expect(frame?.data).toMatchObject({ name: "Terrain" });
    expect((frame?.data as { width: number }).width).toBeGreaterThan(200);
  });
});

describe("mergeImportGraph", () => {
  it("appends annotations after layout without passing them to layout", async () => {
    const graphNode: Node = {
      id: "n1",
      type: "Constant",
      position: { x: 0, y: 0 },
      data: { type: "Constant", fields: {} },
    };
    const metadata: ImportMetadata = {
      comments: {},
      nodeIds: {},
      nodePositions: {},
      nodeEditorMetadata: { $Comments: [{}], $Groups: [] },
      hytaleComments: [{ text: "Hi", x: 5, y: 6, width: 100, height: 50 }],
      hytaleGroups: [],
    };

    const layoutFn = async (nodes: Node[]) => {
      expect(nodes).toHaveLength(1);
      return [{ ...nodes[0], position: { x: 99, y: 99 } }];
    };

    const merged = await mergeImportGraph([graphNode], [], metadata, layoutFn);
    expect(merged).toHaveLength(2);
    expect(merged[0].type).toBe("Constant");
    expect(merged[0].position).toEqual({ x: 99, y: 99 });
    expect(merged[1].type).toBe("comment");
    expect(merged[1].position).toEqual({ x: 147, y: 147 });
    expect(merged[1].zIndex).toBe(1);
  });

  it("creates an auto frame when the file has no canvas metadata", async () => {
    const graphNode: Node = {
      id: "n1",
      type: "Constant",
      position: { x: 0, y: 0 },
      data: { type: "Constant", fields: {} },
    };

    const merged = await mergeImportGraph(
      [graphNode],
      [],
      null,
      async (nodes) => nodes,
      { sectionKey: "MaterialProvider" },
    );

    expect(merged).toHaveLength(2);
    expect(merged[0].type).toBe("frame");
    expect(merged[0].data).toMatchObject({ name: "Materials" });
    expect(merged[1].type).toBe("Constant");
  });
});
