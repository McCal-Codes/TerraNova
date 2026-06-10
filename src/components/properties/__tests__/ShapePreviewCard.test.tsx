import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShapePreviewCard } from "../ShapePreviewCard";

describe("ShapePreviewCard", () => {
  it("renders label for PCN node", () => {
    render(
      <ShapePreviewCard
        nodeId="pcn-1"
        nodeType="PositionsCellNoise"
        fields={{ Scale: 50, Seed: "test" }}
        nodes={[
          {
            id: "pcn-1",
            type: "Density",
            position: { x: 0, y: 0 },
            data: { type: "PositionsCellNoise", fields: { Scale: 50, Seed: "test" } },
          },
        ]}
        edges={[]}
      />,
    );
    expect(screen.getByText("Shape preview")).toBeInTheDocument();
  });
});
