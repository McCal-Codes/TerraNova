# 2D Preview & Topographic Maps

**Difficulty:** Beginner

This guide connects TerraNova’s **2D preview** to ideas from classical **topographic mapping** — especially how cartographers turn three-dimensional terrain into readable flat maps. The parallels help you read the preview; they do not mean TerraNova is a survey-grade mapping product.

> **Source:** Concepts summarized from the U.S. Geological Survey (USGS) public-domain booklet [*Topographic Mapping*](https://www.usgs.gov/media/images/changing-landscape-topographic-mapping) (public domain). TerraNova interprets **density fields** from your graph, not USGS quadrangle data.

---

## What is a topographic map?

Whether on paper or on screen, a map catalogs how things are arranged on the Earth’s surface. A **topographic map** is distinguished by showing **shape and elevation** of the land — traditionally with **contour lines**: curves along which elevation is constant. That lets a flat sheet represent hills, valleys, and plains.

Topographic maps also name natural features (mountains, lakes, rivers) and cultural ones (roads, boundaries, buildings). Engineers, planners, hikers, and scientists use them because they show both **location** and **relief** in one view.

**TerraNova parallel:** The 2D preview is a **plan view** (looking down) of a scalar field sampled from your density graph. Where USGS maps show **elevation in feet or meters**, the heatmap shows **density values** (or derived terrain height after thresholding). The *reading skills* — contours, shading, scale, profiles — transfer even though the physical quantity differs.

---

## Contour lines and interval

On a USGS map, **contour lines** connect points of equal elevation. The **contour interval** is the vertical separation between adjacent lines (for example 10 ft on a 1:24,000 quadrangle). Closely spaced contours mean steep slope; wide spacing means gentle terrain. **Index contours** (heavier lines, usually every fifth interval) carry elevation labels; thinner **intermediate** lines sit between them. See [REI: How to Read a Topo Map](https://www.rei.com/learn/expert-advice/topo-maps-how-to-use.html) for field-reading habits that transfer to this preview.

National Map Accuracy Standards (historically) required that most tested points on 7.5-minute, 1:24,000-scale maps meet tight horizontal and vertical tolerances — cartography was built for measurement, not just illustration.

**In TerraNova:**

| Control | Role |
|---------|------|
| **USGS topo style** | Parchment base, brown contour ink, green woodland and blue below-surface washes, index contour labels. |
| **Density contours** | Iso-lines of equal density (like elevation contours on a topo sheet). |
| **Contour interval** | Spacing between those lines — smaller interval → more detail, busier map. |
| **Terrain view** | Emphasizes the **surface boundary** (density crossing zero), closer to “where solid meets air” than a hypsometric tint. With **Topo** on, terrain mode keeps the USGS parchment map and draws a bold **d = 0** index contour instead of the flat green/air fill. |

Enable **USGS topo style** and **Density contours** from the preview toolbar chips (**Topo**, **Contours**) or expand **Preview settings** (toolbar **Settings** button or the edge chevron in split view), then tune **Contour interval** until ridges and basins read clearly without clutter. **Topo** and **Terrain** can be on together; turn **Topo** off if you prefer the classic binary solid/air threshold view.

---

## Relief, hill shade, and color

Printed topo maps use **brown** contour ink and often **green** woodland overlays. **Relief shading** (hill shade) simulates sun angle so valleys and ridges pop without drawing every contour.

**In TerraNova:**

| Control | Role |
|---------|------|
| **Hill shade** | Synthetic relief lighting on the heatmap — helps you see form before enabling contours. |
| **Colormap** | Hypsometric-style tinting: color encodes magnitude (like elevation bands on some maps). |
| **Range min / max** | Display window for values — analogous to choosing which elevations are emphasized on a map legend. |

A practical workflow: turn on **Hill shade** first for landform, add **contours** for precise levels, switch **colormap** when you need to compare runs or highlight outliers.

---

## Scale, resolution, and detail

USGS 7.5-minute quadrangles at **1:24,000** show fine detail (schools, fences on early sheets) because map scale controls how much ground each inch covers. Larger scale → more ground per pixel → less detail.

**In TerraNova:**

| Control | Role |
|---------|------|
| **Resolution** | Grid size of the preview sample (e.g. 512²). Higher → sharper features, slower eval. |
| **Y level (slice)** | Horizontal **slice** through the volume at one height — like reading contours on one elevation band, or a single flight line in aerial survey. |

If the preview looks blocky, raise **Resolution**; if eval is slow, lower it or use a coarser pass while iterating.

---

## Profiles and cross-sections

Surveyors verify maps in the field; cartographers also use **stereoscopic aerial pairs** to recover 3D terrain. A **profile** (elevation along a line) is the standard way to check cliffs, terraces, and drainage.

**In TerraNova:**

| Control | Role |
|---------|------|
| **Cross-section plot** | Density (or height) along a line you draw on the map — a **topographic profile** of your field. |
| **Statistics panel** | Distribution of values in the current view — useful for spotting clipping, flat regions, or bad normalization. |

Draw a cross-section across a ridge you care about; compare the profile shape to what you see in **3D** or **Voxel** preview.

**Profile modes** (preview settings → **Cross-section plot**):

| Mode | Axis | Best for |
|------|------|----------|
| **Plan profile** | Distance along line vs density at the current **Y level** | Surface ridges, drainage at one slice |
| **Section profile** | Distance vs **world Y** (vertical wall) | Cave voids, ceilings, and floors through the volume |

Enable **Section profile**, Shift+drag a line on the map, and read blue air bands plus the bold **d = 0** boundary — the cave-reading equivalent of a quarry wall section on a topo sheet. See [Cave Preview](./../preview/cave-preview.md) for voxel cutaway and 3D underground view.

---

## Reading caves on a topo slice

Caves are **air where density &lt; 0** at the sampled **Y level**. On a horizontal slice through a tunnel band:

1. Turn **Topo** on (default) and enable **Contours** + **Terrain**.
2. Lower **Y level** to the cave depth you care about (for example 40–55 on a `BaseHeight` ≈ 64 graph).
3. Read **blue hydrography wash** (negative density) as void space; the bold **d = 0** contour traces solid/air boundaries on the plan map.
4. Compare a surface slice (high **Y level**) with an underground slice to see the tunnel footprint shrink or grow.

With **Topo** on, **Terrain** emphasizes the zero contour on the heatmap — not the flat green/air fill from **Threshold view** (use threshold fill only when **Topo** is off).

For full void geometry use **Voxel** mode with **Cutaway**, or **3D → Underground view** — the heightfield cannot show interior voids.

---

## From aerial photos to digital data

Historically, USGS topo production moved from **plane table surveying** to **photogrammetry** (measuring from aerial photos), then to **digitized line work** and GIS layers. Modern workflows mix imagery, field control points, and computer compilation.

TerraNova’s pipeline is different — **procedural density** from your node graph — but the **preview stack** mirrors cartographic habits:

1. **Sample the field** (evaluate graph at grid points — like rasterizing a map sheet).
2. **Visualize** (color, shade, contours).
3. **Analyze** (profiles, stats, export PNG for notes or reports).

---

## Quick reference: preview controls → map concept

| TerraNova 2D control | Topographic idea |
|----------------------|------------------|
| USGS topo style | Printed quadrangle sheet (parchment, brown contours, land-cover color) |
| Heatmap base | Elevation tint / raster surface |
| Hill shade | Relief shading |
| Density contours | Contour lines |
| Contour interval | Contour interval (vertical spacing) |
| Terrain view | Surface / class boundary emphasis |
| Y level at cave depth | Plan view of tunnel network (topo slice) |
| Y level | Horizontal slice at one elevation |
| Cross-section (plan) | Topographic profile at fixed Y |
| Cross-section (section) | Vertical wall profile through caves |
| Resolution | Map scale / cell size |
| Range min & max | Vertical display limits |
| Export PNG | Map sheet snapshot |

---

## What this preview is *not*

- Not a USGS map product and not tied to NAPP aerial photography or National Map Accuracy Standards.
- Not guaranteed to match in-game terrain pixel-for-pixel (see [Expert Terrain Techniques](./terrain-types-expert.md) for preview vs runtime).
- **Density** is the engine’s signed field; only after **Terrain view** or game export does it behave like “ground height” in the world.

Use the 2D preview to **shape and debug** your graph with cartographic habits — contours, shade, profiles — then validate in **3D**, **Voxel**, or **Bridge World** when you need spatial fidelity.

---

## Further reading

- [Cave Preview](../preview/cave-preview.md) — voxel cutaway, 3D underground view, density coverage.
- [Terrain Math Explained](./terrain-math-explained.md) — what density means in TerraNova.
- [Understanding Basic Terrain Generation](../understanding-basic-terrain-generation.md) — noise, height, and combinators.
- USGS: [The Changing Landscape of Topographic Mapping](https://www.usgs.gov/media/images/changing-landscape-topographic-mapping) (public domain).
