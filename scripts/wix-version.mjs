#!/usr/bin/env node
/**
 * Map app semver to WiX ProductVersion (major.minor.patch.build).
 * WiX cannot use textual prerelease tags (e.g. alpha.1); use the prerelease
 * number as the fourth field instead.
 *
 * Examples:
 *   0.1.8-alpha.1 -> 0.1.8.1
 *   0.1.8         -> 0.1.8.0
 */

/**
 * @param {string} version
 * @returns {string}
 */
export function semverToWixVersion(version) {
  const match = version.match(
    /^(\d+)\.(\d+)\.(\d+)(?:-(?:alpha|beta|rc)\.(\d+))?$/i,
  );
  if (!match) {
    throw new Error(
      `wix-version: cannot map "${version}" — expected MAJOR.MINOR.PATCH or MAJOR.MINOR.PATCH-alpha.N`,
    );
  }
  const major = match[1];
  const minor = match[2];
  const patch = match[3];
  const build = match[4] ?? "0";
  return `${major}.${minor}.${patch}.${build}`;
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  const version = process.argv[2];
  if (!version) {
    console.error("wix-version: pass semver (e.g. 0.1.8-alpha.1)");
    process.exit(1);
  }
  console.log(semverToWixVersion(version));
}
