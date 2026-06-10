#!/usr/bin/env node
/**
 * Ensures docs/CHANGELOG.md has a non-empty Unreleased section.
 * Fails when Unreleased is missing or still the placeholder.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const changelogPath = resolve(root, "docs/CHANGELOG.md");
const pkgPath = resolve(root, "package.json");

const PLACEHOLDER = "_No changes yet._";

function fail(message) {
  console.error(`changelog:check — ${message}`);
  process.exit(1);
}

const text = readFileSync(changelogPath, "utf8");
const unreleasedMatch = text.match(/^## Unreleased\r?\n([\s\S]*?)(?=^## \[)/m);
if (!unreleasedMatch) {
  fail("missing ## Unreleased section in docs/CHANGELOG.md");
}

const body = unreleasedMatch[1].trim();
if (!body || body === PLACEHOLDER) {
  fail(
    "Unreleased section is empty — add bullets for user-facing changes before tagging an alpha build",
  );
}

if (body.includes(PLACEHOLDER)) {
  fail("remove the _No changes yet._ placeholder from Unreleased");
}

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const version = pkg.version;
const latestRelease = text.match(/^## \[([^\]]+)\]/m);
if (latestRelease && latestRelease[1] === version && body.length > 0) {
  console.warn(
    `changelog:check — note: package.json version (${version}) matches latest CHANGELOG header; promote Unreleased before release`,
  );
}

console.log("changelog:check — OK");
