import { readFileSync } from "fs";

function collectNodeIds(asset) {
  const ids = new Set();
  function walk(obj) {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      obj.forEach(walk);
      return;
    }
    const rec = obj;
    if (typeof rec.$NodeId === "string") ids.add(rec.$NodeId);
    for (const v of Object.values(rec)) walk(v);
  }
  walk(asset);
  return ids;
}

function parseMeta(wrapper) {
  const raw = wrapper.$NodeEditorMetadata;
  if (!raw) return { groups: [], positions: {} };
  const groups = (raw.$Groups ?? []).map((g) => ({
    name: g.$name ?? "",
    x: g.$Position?.$x ?? 0,
    y: g.$Position?.$y ?? 0,
    width: g.$width ?? 0,
    height: g.$height ?? 0,
  }));
  const positions = {};
  for (const [id, data] of Object.entries(raw.$Nodes ?? {})) {
    const p = data.$Position;
    if (p) positions[id] = { x: p.$x ?? 0, y: p.$y ?? 0 };
  }
  return { groups, positions };
}

function inGroup(pos, g) {
  return pos.x >= g.x && pos.x <= g.x + g.width && pos.y >= g.y && pos.y <= g.y + g.height;
}

function currentNameRoute(name, sectionKeys) {
  const norm = name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const aliases = {
    Terrain: ["terrain"],
    MaterialProvider: ["materials", "material", "solidity"],
    EnvironmentProvider: ["environment", "weather", "atmosphere", "env"],
    TintProvider: ["tint", "color"],
  };
  for (const [section, keys] of Object.entries(aliases)) {
    if (!sectionKeys.includes(section)) continue;
    if (keys.some((k) => norm === k || norm.includes(k))) return section;
  }
  return null;
}

const SPATIAL_ROUTE_MIN_HITS = 2;

function spatialRoute(group, sectionNodeIds, positions) {
  let best = null;
  let bestCount = 0;
  const counts = [];
  for (const [section, ids] of Object.entries(sectionNodeIds)) {
    let count = 0;
    for (const id of ids) {
      const pos = positions[id];
      if (pos && inGroup(pos, group)) count++;
    }
    counts.push({ section, count });
    if (count > bestCount) {
      bestCount = count;
      best = section;
    }
  }
  return { section: best, count: bestCount, counts };
}

function hybridRoute(group, sectionNodeIds, positions, sectionKeys) {
  const byName = currentNameRoute(group.name, sectionKeys);
  const spat = spatialRoute(group, sectionNodeIds, positions);
  if (spat.count >= SPATIAL_ROUTE_MIN_HITS && spat.section) {
    const tied = spat.counts.filter((c) => c.count === spat.count);
    if (tied.length === 1) return spat.section;
    if (byName && tied.some((t) => t.section === byName)) return byName;
    return spat.section;
  }
  if (byName) return byName;
  if (spat.count > 0 && spat.section) return spat.section;
  return sectionKeys[0] ?? "Terrain";
}

function analyzeBiome(path, label) {
  const wrapper = JSON.parse(readFileSync(path, "utf8"));
  const sectionKeys = [];
  const sectionNodeIds = {};

  if (wrapper.Terrain?.Density?.Type) {
    sectionKeys.push("Terrain");
    sectionNodeIds.Terrain = collectNodeIds(wrapper.Terrain.Density);
  }
  if (wrapper.MaterialProvider?.Type) {
    sectionKeys.push("MaterialProvider");
    sectionNodeIds.MaterialProvider = collectNodeIds(wrapper.MaterialProvider);
  }
  if (Array.isArray(wrapper.Props)) {
    wrapper.Props.forEach((prop, i) => {
      const key = `Props[${i}]`;
      sectionKeys.push(key);
      sectionNodeIds[key] = collectNodeIds(prop);
    });
  }
  if (wrapper.EnvironmentProvider?.Type) {
    sectionKeys.push("EnvironmentProvider");
    sectionNodeIds.EnvironmentProvider = collectNodeIds(wrapper.EnvironmentProvider);
  }
  if (wrapper.TintProvider?.Type) {
    sectionKeys.push("TintProvider");
    sectionNodeIds.TintProvider = collectNodeIds(wrapper.TintProvider);
  }

  const { groups, positions } = parseMeta(wrapper);
  const fallback = sectionKeys[0] ?? "Terrain";

  let agree = 0;
  let spatialHits = 0;
  let spatialMiss = 0;
  const fixes = [];
  const disagreements = [];

  for (const group of groups) {
    const byName = currentNameRoute(group.name, sectionKeys) ?? fallback;
    const spat = spatialRoute(group, sectionNodeIds, positions);
    const byHybrid = hybridRoute(group, sectionNodeIds, positions, sectionKeys);
    const bySpatial = spat.count > 0 ? spat.section : fallback;

    if (spat.count > 0) spatialHits++;
    else spatialMiss++;

    if (byName === byHybrid) {
      agree++;
    } else {
      disagreements.push({
        name: group.name,
        byName,
        byHybrid,
        hits: spat.count,
      });
      if (byName === fallback && byHybrid !== fallback) {
        fixes.push({ name: group.name, from: byName, to: byHybrid, hits: spat.count });
      }
    }
  }

  console.log(`\n=== ${label} ===`);
  console.log(
    "Sections:",
    sectionKeys.map((k) => `${k}:${sectionNodeIds[k].size}`).join(", "),
  );
  console.log(`Groups: ${groups.length}, $Nodes positions: ${Object.keys(positions).length}`);
  console.log(`Name-only matches hybrid routing: ${agree}/${groups.length}`);
  console.log(`Spatial hits: ${spatialHits}, no hits: ${spatialMiss}`);
  console.log(`Would fix fallback misroutes: ${fixes.length}`);
  fixes.slice(0, 12).forEach((f) => console.log(`  fix: "${f.name}" ${f.from} -> ${f.to} (${f.hits} nodes)`));
  if (disagreements.length > 0) {
    console.log("Sample disagreements:");
    disagreements.slice(0, 8).forEach((d) =>
      console.log(`  "${d.name}": name=${d.byName} hybrid=${d.byHybrid} hits=${d.hits}`),
    );
  }
}

analyzeBiome(
  "templates/tropical-pirate-islands/Server/HytaleGenerator/Biomes/TropicalPirateIslandsBiome.json",
  "Tropical Pirate Islands",
);
analyzeBiome("templates/references/TheUnderworld.json", "The Underworld");
analyzeBiome("templates/references/Salt_Flats.json", "Salt Flats");
