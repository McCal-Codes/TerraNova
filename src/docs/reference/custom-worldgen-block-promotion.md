# Custom Worldgen Block Promotion Path

This is the decision guide for promoting a `Worldgen References` template block into a first-class schema node.

## Keep It As A Template (default)

Stay template-first when composition is clear and performance is acceptable.

Do **not** promote yet if:

- the block is mainly stylistic,
- field semantics are still changing,
- there is no measurable parity or performance gain.

## Promote Only If All Are True

- **Adoption:** used repeatedly across shipped/internal packs.
- **UX value:** replacing expansion with one node materially simplifies editing.
- **Runtime value:** evaluator-level node is measurably faster or more stable.
- **Parity need:** composition cannot reliably match expected Hytale behavior.
- **Stability:** field contract has been stable for at least one release cycle.

## Required Before Promotion

- schema contract (fields, defaults, handles, export mapping),
- migration mapping from `_snippetMeta.snippetId`,
- round-trip import/export tests,
- 2D/3D/voxel parity tests on Desert/Skyreach-style references,
- compatibility + rollback notes.

## Migration Sequence

1. Ship first-class node behind a feature flag; keep template insertion available.
2. Add one-way migration utility from known template expansions.
3. Run parity + performance gates.
4. Make first-class node default only after gates pass.
5. Keep templates for one release with migration hints, then deprecate.

