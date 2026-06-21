import { readFileSync, existsSync } from "node:fs";
import { hytaleToInternalBiome } from "../src/utils/hytaleToInternal.ts";
import { jsonToGraph } from "../src/utils/jsonToGraph.ts";
import { collectBiomeSectionNodeIds } from "../src/utils/sectionAnnotationRouting.ts";
import { computePositionCoverage, applySectionHytalePositions } from "../src/utils/applyHytaleImportLayout.ts";

const path = "C:/Users/wolft/Downloads/FireFox Downloads/Autumn.json";
if (!existsSync(path)) {
  console.error("missing", path);
  process.exit(1);
}

const raw = JSON.parse(readFileSync(path, "utf8"));
const { wrapper, metadata } = hytaleToInternalBiome(raw);
const terrain = wrapper.Terrain?.Density;
const { nodes, edges } = jsonToGraph(terrain, 0, 0, "autumn");
const sectionIds = collectBiomeSectionNodeIds(wrapper).Terrain;
const graphNodes = nodes.filter((n) => n.type !== "comment" && n.type !== "frame");
const coverage = computePositionCoverage(graphNodes, metadata.nodePositions, sectionIds);

let idMatch = 0;
for (const n of graphNodes) {
  const id = n.id;
  if (metadata.nodePositions[id]) idMatch++;
}

console.log({ graphNodes: graphNodes.length, sectionIds: sectionIds.size, coverage, idMatch });
const applied = applySectionHytalePositions(nodes, metadata.nodePositions, sectionIds);
console.log({ usedHytaleLayout: applied.usedHytaleLayout, offset: applied.offset });

const sample = ["Min.Density-4cc6c797-4864-48c8-8ffe-6bd07c14c3a3", "Max.Density-da6f3501-84a8-4966-8fed-170b34b66f4d"];
for (const id of sample) {
  const n = applied.nodes.find((x) => x.id === id);
  console.log(id, { hytale: metadata.nodePositions[id], canvas: n?.position });
}
