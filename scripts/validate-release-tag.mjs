#!/usr/bin/env node
/**
 * Validate Git tag names against GitHub + semver prerelease conventions.
 * Usage: node scripts/validate-release-tag.mjs v0.1.8-alpha.1
 */
const tag = process.argv[2];
if (!tag) {
  console.error("validate-release-tag: pass tag (e.g. v0.1.8-alpha.1)");
  process.exit(1);
}

// v-prefix required (GitHub recommendation)
if (!/^v\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(tag)) {
  console.error(
    `validate-release-tag: invalid tag "${tag}" — use vMAJOR.MINOR.PATCH or vMAJOR.MINOR.PATCH-alpha.N`,
  );
  process.exit(1);
}

const version = tag.slice(1);
const isPrerelease = /-(alpha|beta|rc)(\.|$)/i.test(version);

console.log(
  JSON.stringify({
    tag,
    version,
    isPrerelease,
    makeLatest: !isPrerelease,
  }),
);
