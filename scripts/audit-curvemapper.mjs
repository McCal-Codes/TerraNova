#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

function walkJsonFiles(root) {
  const out = [];
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.json')) out.push(p);
    }
  }
  walk(root);
  return out;
}

function auditRoot(label, root) {
  const stats = {
    files: 0,
    cm: 0,
    curveTypes: {},
    inputTypes: {},
    parentTypes: {},
    baseheightDistance: 0,
    inlineCurve: 0,
    separateCurve: 0,
    badInputKey: 0,
  };

  function bump(map, key) {
    map[key] = (map[key] ?? 0) + 1;
  }

  function walk(o, parentType = null) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) {
      for (const item of o) walk(item, parentType);
      return;
    }
    const t = o.Type;
    if (t === 'CurveMapper') {
      stats.cm += 1;
      if (parentType) bump(stats.parentTypes, parentType);

      const c = o.Curve;
      if (c && typeof c === 'object' && !Array.isArray(c)) {
        stats.inlineCurve += 1;
        bump(stats.curveTypes, c.Type ?? '?');
      } else if (c) stats.separateCurve += 1;

      if ('Input' in o && !('Inputs' in o)) {
        stats.badInputKey += 1;
        const inp = o.Input;
        if (inp && typeof inp === 'object') {
          bump(stats.inputTypes, inp.Type ?? '?');
          if (inp.Type === 'BaseHeight' && inp.Distance) stats.baseheightDistance += 1;
        }
      } else if (Array.isArray(o.Inputs)) {
        for (const inp of o.Inputs) {
          if (inp && typeof inp === 'object') {
            bump(stats.inputTypes, inp.Type ?? '?');
            if (inp.Type === 'BaseHeight' && inp.Distance) stats.baseheightDistance += 1;
          }
        }
      }
    }
    for (const v of Object.values(o)) walk(v, t);
  }

  for (const fp of walkJsonFiles(root)) {
    try {
      walk(JSON.parse(readFileSync(fp, 'utf8')));
      stats.files += 1;
    } catch {
      /* skip */
    }
  }
  return { label, stats };
}

const roots = [
  ['release', 'templates/hytale-release'],
  ['references', 'templates/references'],
  ['tropical-pirate', 'templates/tropical-pirate-islands'],
  [
    'mccal-autumn',
    'C:/Users/wolft/AppData/Roaming/Hytale/UserData/Saves/Worldgen V1/mods/McCal.Autmn Forest',
  ],
  [
    'dev-mccal',
    'C:/Users/wolft/AppData/Roaming/Hytale/UserData/Saves/Worldgen V1/mods/DevMcCal.TestingTerranova',
  ],
];

for (const [label, root] of roots) {
  const { stats } = auditRoot(label, root);
  console.log(`=== ${label} ===`);
  console.log(`  json files: ${stats.files}, CurveMappers: ${stats.cm}`);
  console.log(`  inline curves: ${stats.inlineCurve}, separate: ${stats.separateCurve}`);
  console.log(`  BaseHeight+Distance: ${stats.baseheightDistance}/${stats.cm}`);
  console.log(`  bad Input key: ${stats.badInputKey}`);
  console.log(`  curve types:`, stats.curveTypes);
  console.log(`  input types:`, stats.inputTypes);
  console.log(`  parent types:`, stats.parentTypes);
  console.log();
}
