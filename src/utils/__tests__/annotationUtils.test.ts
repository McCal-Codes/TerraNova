import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import { NODE_HEIGHT, NODE_WIDTH } from "@/constants";
import {
  AUTO_FRAME_HEADER,
  AUTO_FRAME_PAD,
  AUTO_FRAME_PAD_LABEL,
  buildFrameAroundNodes,
  loosenNodesRelative,
  LOOSEN_SCALE_DEFAULT,
  nodesEligibleForFraming,
} from "../annotationUtils";
import { generateHytaleNodeEditorMetadata } from "../nodeEditorMetadata";
import { parseNodeEditorMetadata } from "../hytaleToInternal";

describe("buildFrameAroundNodes", () => {
  const graphNodes: Node[] = [
    {
      id: "n1",
      type: "Constant",
      position: { x: 100, y: 200 },
      data: { type: "Constant", fields: {} },
    },
    {
      id: "n2",
      type: "Sum",
      position: { x: 400, y: 260 },
      data: { type: "Sum", fields: {} },
    },
  ];

  it("wraps graph nodes with Hytale $Groups-compatible padding and header offset", () => {
    const frame = buildFrameAroundNodes(graphNodes, "Terrain");
    expect(frame).not.toBeNull();
    expect(frame?.type).toBe("frame");
    expect(frame?.data).toMatchObject({
      type: "frame",
      name: "Terrain",
      width: Math.round((400 + NODE_WIDTH) - 100 + AUTO_FRAME_PAD * 2),
      height: Math.round((260 + NODE_HEIGHT) - 200 + AUTO_FRAME_PAD * 2 + AUTO_FRAME_HEADER),
    });
    expect(frame?.position).toEqual({
      x: 100 - AUTO_FRAME_PAD,
      y: 200 - AUTO_FRAME_PAD - AUTO_FRAME_HEADER,
    });
    expect(frame?.zIndex).toBe(-1);
  });

  it("round-trips through Hytale $NodeEditorMetadata.$Groups", () => {
    const frame = buildFrameAroundNodes(graphNodes, "Materials");
    const metadata = generateHytaleNodeEditorMetadata([...graphNodes, frame!]);
    const groups = metadata.$Groups as Array<Record<string, unknown>>;
    expect(groups).toHaveLength(1);
    expect(groups[0]).toEqual({
      $Position: {
        $x: frame!.position.x,
        $y: frame!.position.y,
      },
      $width: (frame!.data as { width: number }).width,
      $height: (frame!.data as { height: number }).height,
      $name: "Materials",
    });

    const parsed = parseNodeEditorMetadata(metadata as Record<string, unknown>);
    expect(parsed.hytaleGroups[0]).toEqual({
      name: "Materials",
      x: frame!.position.x,
      y: frame!.position.y,
      width: (frame!.data as { width: number }).width,
      height: (frame!.data as { height: number }).height,
    });
  });
});

describe("loosenNodesRelative", () => {
  it("spreads selected nodes away from their center", () => {
    const nodes: Node[] = [
      { id: "a", type: "Constant", position: { x: 100, y: 100 }, data: {} },
      { id: "b", type: "Sum", position: { x: 300, y: 100 }, data: {} },
      { id: "c", type: "comment", position: { x: 0, y: 0 }, data: {} },
    ];

    const loosened = loosenNodesRelative(nodes, ["a", "b"], { scale: LOOSEN_SCALE_DEFAULT });
    const a = loosened.find((n) => n.id === "a")!;
    const b = loosened.find((n) => n.id === "b")!;
    const c = loosened.find((n) => n.id === "c")!;

    expect(a.position.x).toBeLessThan(100);
    expect(b.position.x).toBeGreaterThan(300);
    expect(c.position).toEqual({ x: 0, y: 0 });
  });
});

describe("buildFrameAroundNodes padding", () => {
  const graphNodes: Node[] = [
    { id: "n1", type: "Constant", position: { x: 0, y: 0 }, data: {} },
  ];

  it("supports a larger label-oriented padding preset", () => {
    const frame = buildFrameAroundNodes(graphNodes, "Terrain", { pad: AUTO_FRAME_PAD_LABEL });
    expect((frame?.data as { width: number }).width).toBe(NODE_WIDTH + AUTO_FRAME_PAD_LABEL * 2);
    expect(frame?.position.x).toBe(-AUTO_FRAME_PAD_LABEL);
  });
});

describe("nodesEligibleForFraming", () => {
  it("includes graph nodes but excludes annotations and collapsed groups", () => {
    const nodes: Node[] = [
      { id: "a", type: "Constant", position: { x: 0, y: 0 }, data: {} },
      { id: "b", type: "comment", position: { x: 0, y: 0 }, data: {} },
      { id: "c", type: "frame", position: { x: 0, y: 0 }, data: {} },
      { id: "d", type: "group", position: { x: 0, y: 0 }, data: {} },
    ];
    expect(nodesEligibleForFraming(nodes).map((n) => n.id)).toEqual(["a"]);
  });
});
