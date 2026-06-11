#!/usr/bin/env node
/**
 * Emit GitHub Release markdown for a semver from docs/CHANGELOG.md.
 * Usage: node scripts/release-notes.mjs 0.1.8-alpha.1
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2];
if (!version) {
  console.error("release-notes: pass version (e.g. 0.1.8-alpha.1)");
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const changelogPath = resolve(root, "docs/CHANGELOG.md");
const text = readFileSync(changelogPath, "utf8");

const header = `## [${version}]`;
const start = text.indexOf(header);
if (start === -1) {
  console.error(`release-notes: no ${header} section in docs/CHANGELOG.md`);
  process.exit(1);
}

const afterHeader = text.indexOf("\n", start) + 1;
const nextSection = text.indexOf("\n## ", afterHeader);
const section =
  nextSection === -1 ? text.slice(afterHeader) : text.slice(afterHeader, nextSection);

const body = section.trim();
if (!body) {
  console.error(`release-notes: empty body for ${header}`);
  process.exit(1);
}

const isPrerelease = /-(alpha|beta|rc)\./i.test(version);
const installNote = isPrerelease
  ? "\n\n> **Closed alpha:** download the installer for your platform below, or update in-app from `v0.1.8-alpha.1`+ (Settings → General → Check for updates; auto-check runs ~3s after launch)."
  : "";

process.stdout.write(`${body}${installNote}\n`);
