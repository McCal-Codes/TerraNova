// @refresh reset
import { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useNonPassiveWheel } from "@/hooks/useNonPassiveWheel";
import { usePreviewStore } from "@/stores/previewStore";
import {
  HYTALE_MAP_COLOR_FALLBACK,
  computeHytaleShade,
  normalisedToBlockHeights,
  parseMapColor,
} from "@/utils/hytaleMapStyle";
import { useEditorStore } from "@/stores/editorStore";
import {
  detectHydrographyContext,
  hydrographySliceParams,
} from "@/utils/hydrographyContext";
import { getColormap } from "@/utils/colormaps";
import { resolve2dPreviewResolutionForZoom } from "@/utils/previewResolution";
import { screenToWorld } from "@/utils/canvasTransform";
import { useSmoothCanvasTransform } from "@/hooks/useSmoothCanvasTransform";
import { previewHudBadgeClass } from "@/components/preview/previewChromeStyles";
import { generateContours, getContourLevels } from "@/utils/contourLines";
import {
  drawCellBoundaries,
  drawSdfZeroContour,
  drawShapeMeshPoints,
  drawWallDistanceTint,
} from "@/utils/shapePreview/drawShapeOverlays";
import { TopoMapHud } from "@/components/preview/TopoMapHud";
import {
  USGS_INDEX_CONTOUR_BROWN,
  applyUsgsLandCoverWash,
  applyUsgsPaperGrain,
  applyUsgsParchmentVignette,
  drawUsgsContourLabels,
  drawUsgsContours,
  drawUsgsHydrographyHatch,
  drawUsgsMarginTicks,
  drawUsgsNeatline,
  drawUsgsSpotElevations,
  drawUsgsSteepSlopeHachures,
  findUsgsSpotElevations,
  getUsgsContourLevels,
  sampleUsgsHypsometricTint,
  shadeUsgsReliefPixel,
} from "@/utils/topoMapStyle";

type Heatmap2DProps = {
  exportRootRef?: (el: HTMLDivElement | null) => void;
  sliceHint?: string | null;
};

const Heatmap2DInner = forwardRef<HTMLCanvasElement, Heatmap2DProps>(function Heatmap2D({ exportRootRef, sliceHint = null }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapFrameRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<HTMLDivElement>(null);
  const [mapFrameSize, setMapFrameSize] = useState({ w: 0, h: 0 });
  const {
    values,
    minValue,
    maxValue,
    p02Value,
    p98Value,
    rangeMin,
    rangeMax,
    colormap,
    canvasTransform,
    resolution,
    isLoading,
    showContours,
    contourInterval,
    showCrossSection,
    crossSectionLine,
    showPositionOverlay,
    positionOverlayPoints,
    positionOverlayColor,
    positionOverlaySize,
    showHillShade,
    yLevel,
    mapStyle,
    showThresholdView,
    showShapePreview,
    showCellBoundaries,
    showWallDistance,
    showMeshSamples,
    showSdfSurface,
    cellShapeGrid,
    sdfZeroSegments,
    shapePreviewMeshPoints,
  } = usePreviewStore(
    useShallow((s) => ({
      values: s.values,
      minValue: s.minValue,
      maxValue: s.maxValue,
      p02Value: s.p02Value,
      p98Value: s.p98Value,
      rangeMin: s.rangeMin,
      rangeMax: s.rangeMax,
      colormap: s.colormap,
      canvasTransform: s.canvasTransform,
      resolution: s.resolution,
      isLoading: s.isLoading,
      showContours: s.showContours,
      contourInterval: s.contourInterval,
      showCrossSection: s.showCrossSection,
      crossSectionLine: s.crossSectionLine,
      showPositionOverlay: s.showPositionOverlay,
      positionOverlayPoints: s.positionOverlayPoints,
      positionOverlayColor: s.positionOverlayColor,
      positionOverlaySize: s.positionOverlaySize,
      showHillShade: s.showHillShade,
      yLevel: s.yLevel,
      mapStyle: s.mapStyle,
      showThresholdView: s.showThresholdView,
      showShapePreview: s.showShapePreview,
      showCellBoundaries: s.showCellBoundaries,
      showWallDistance: s.showWallDistance,
      showMeshSamples: s.showMeshSamples,
      showSdfSurface: s.showSdfSurface,
      cellShapeGrid: s.cellShapeGrid,
      sdfZeroSegments: s.sdfZeroSegments,
      shapePreviewMeshPoints: s.shapePreviewMeshPoints,
    })),
  );
  // Most of this component predates the third style and still asks "is this the
  // topo map?". Deriving the old boolean keeps those reads honest; only the base
  // image below needs to know about "hytale".
  const usgsTopoStyle = mapStyle === "usgs";
  const hytaleStyle = mapStyle === "hytale";

  const setCanvasTransform = usePreviewStore((s) => s.setCanvasTransform);
  const {
    layerRef: transformLayerRef,
    applyTransform,
    flushTransform,
    getTransform,
  } = useSmoothCanvasTransform(canvasTransform, setCanvasTransform);
  const resetCanvasTransform = usePreviewStore((s) => s.resetCanvasTransform);
  const setRange = usePreviewStore((s) => s.setRange);
  const setCrossSectionLine = usePreviewStore((s) => s.setCrossSectionLine);
  const biomeMapColor = useEditorStore((s) => s.biomeConfig?.MapColor);
  const materialConfig = useEditorStore((s) => s.materialConfig);
  const contentFields = useEditorStore((s) => s.contentFields);

  const evalResolution = useMemo(
    () => resolve2dPreviewResolutionForZoom(resolution, canvasTransform.scale),
    [resolution, canvasTransform.scale],
  );
  const hydroContext = useMemo(
    () => detectHydrographyContext(materialConfig, contentFields),
    [materialConfig, contentFields],
  );
  const hydroSlice = useMemo(
    () => hydrographySliceParams(hydroContext, yLevel),
    [hydroContext, yLevel],
  );
  const [hoverInfo, setHoverInfo] = useState<{ x: number; z: number; value: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    exportRootRef?.(containerRef.current);
    return () => exportRootRef?.(null);
  }, [exportRootRef, values]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setMapFrameSize({
        w: Math.max(64, w),
        h: Math.max(64, h),
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const dragRef = useRef<{ startX: number; startY: number; startOX: number; startOY: number } | null>(null);
  const crossLineRef = useRef<{ startX: number; startZ: number } | null>(null);

  // Merge refs: internal + forwarded
  const setRefs = useCallback(
    (el: HTMLCanvasElement | null) => {
      (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLCanvasElement | null>).current = el;
    },
    [ref],
  );

  // ── Draw base heatmap (with optional hill-shading) ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !values) return;

    // Use actual grid size from values — may differ from resolution during progressive coarse passes
    const n = Math.round(Math.sqrt(values.length));
    canvas.width = n;
    canvas.height = n;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cm = getColormap(colormap);
    const imageData = ctx.createImageData(n, n);
    // Use percentile-based range for outlier resistance
    const lo = p02Value ?? minValue;
    const hi = p98Value ?? maxValue;
    const isFlat = Math.abs(hi - lo) < 1e-8;
    const range = hi - lo || 1;

    // Pre-compute normalized height grid for hill-shading
    let normalized: Float32Array | null = null;
    if (showHillShade && !isFlat) {
      normalized = new Float32Array(values.length);
      for (let i = 0; i < values.length; i++) {
        normalized[i] = Math.max(0, Math.min(1, (values[i] - lo) / range));
      }
    }

    // Hytale colours the whole biome with its MapColor and lets the relief
    // shading do the rest, so there is one base colour for the entire image.
    const hytaleBase = hytaleStyle
      ? parseMapColor(biomeMapColor) ?? HYTALE_MAP_COLOR_FALLBACK
      : HYTALE_MAP_COLOR_FALLBACK;
    const hytaleHeights =
      hytaleStyle && normalized ? normalisedToBlockHeights(normalized) : null;

    // Hill-shade light direction (NW sun, cartographic standard)
    const azimuth = 315 * Math.PI / 180;
    const altitude = 45 * Math.PI / 180;
    const lx = Math.cos(altitude) * Math.sin(azimuth);
    const ly = Math.sin(altitude);
    const lz = Math.cos(altitude) * Math.cos(azimuth);
    const reliefScale = usgsTopoStyle ? 2.8 : 2.0;
    const ambient = usgsTopoStyle ? 0.58 : 0.3;
    const diffuse = usgsTopoStyle ? 0.42 : 0.7;

    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const i = row * n + col;
        const norm = isFlat ? 0.5 : Math.max(0, Math.min(1, (values[i] - lo) / range));
        const [r, g, b] = hytaleStyle
          ? hytaleBase
          : usgsTopoStyle
            ? sampleUsgsHypsometricTint(norm)
            : cm.ramp(norm);
        const pixel = i * 4;

        if (hytaleStyle) {
          // The ported shading replaces the generic hillshade entirely — its
          // light direction, dy and ambient/diffuse split are the game's.
          const shade = hytaleHeights ? computeHytaleShade(hytaleHeights, n, col, row) : 1;
          imageData.data[pixel] = Math.min(255, r * shade);
          imageData.data[pixel + 1] = Math.min(255, g * shade);
          imageData.data[pixel + 2] = Math.min(255, b * shade);
        } else if (normalized && showHillShade) {
          // Central differences with proper one-sided fallback at boundaries
          const colL = col > 0 ? col - 1 : col;
          const colR = col < n - 1 ? col + 1 : col;
          const rowU = row > 0 ? row - 1 : row;
          const rowD = row < n - 1 ? row + 1 : row;

          // Adjust divisor for edge cells (one-sided vs two-sided difference)
          const dxDiv = colR - colL || 1;
          const dzDiv = rowD - rowU || 1;

          const dx = (normalized[row * n + colR] - normalized[row * n + colL]) / dxDiv * reliefScale;
          const dz = (normalized[rowD * n + col] - normalized[rowU * n + col]) / dzDiv * reliefScale;

          // Surface normal from gradient: (-dx, 1, -dz) then normalize
          const nx = -dx;
          const ny = 1;
          const nz = -dz;
          const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
          const nnx = nx / len;
          const nny = ny / len;
          const nnz = nz / len;

          const dot = nnx * lx + nny * ly + nnz * lz;
          const hillshade = ambient + diffuse * Math.max(0, dot);
          const slopeMag = Math.sqrt(dx * dx + dz * dz);

          if (usgsTopoStyle) {
            const [sr, sg, sb] = shadeUsgsReliefPixel([r, g, b], hillshade, slopeMag);
            imageData.data[pixel] = sr;
            imageData.data[pixel + 1] = sg;
            imageData.data[pixel + 2] = sb;
          } else {
            imageData.data[pixel] = Math.min(255, r * hillshade);
            imageData.data[pixel + 1] = Math.min(255, g * hillshade);
            imageData.data[pixel + 2] = Math.min(255, b * hillshade);
          }
        } else {
          imageData.data[pixel] = r;
          imageData.data[pixel + 1] = g;
          imageData.data[pixel + 2] = b;
        }
        imageData.data[pixel + 3] = 255;
      }
    }

    if (usgsTopoStyle) {
      applyUsgsLandCoverWash(imageData.data, values, lo, hi, hydroSlice);
      applyUsgsParchmentVignette(imageData.data, n);
      applyUsgsPaperGrain(imageData.data, n);
    }

    ctx.putImageData(imageData, 0, 0);
  }, [values, minValue, maxValue, p02Value, p98Value, colormap, showHillShade, usgsTopoStyle, hytaleStyle, biomeMapColor, hydroSlice]);

  // ── Memoize contour data separately from drawing ──
  const contourData = useMemo(() => {
    if (!showContours || !values) return [];
    const n = Math.round(Math.sqrt(values.length));
    const contourMin = usgsTopoStyle ? (p02Value ?? minValue) : minValue;
    const contourMax = usgsTopoStyle ? (p98Value ?? maxValue) : maxValue;
    const levels = usgsTopoStyle
      ? getUsgsContourLevels(contourMin, contourMax, contourInterval)
      : getContourLevels(minValue, maxValue, contourInterval);
    return generateContours(values, n, levels);
  }, [values, showContours, contourInterval, minValue, maxValue, p02Value, p98Value, usgsTopoStyle]);

  const spotElevations = useMemo(() => {
    if (!usgsTopoStyle || !values) return [];
    const n = Math.round(Math.sqrt(values.length));
    if (n < 8) return [];
    return findUsgsSpotElevations(values, n);
  }, [values, usgsTopoStyle]);

  // ── Shared overlay helpers ──
  const getOverlayContext = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return null;
    const wrapperEl = overlay.parentElement;
    if (!wrapperEl) return null;
    const displaySize = wrapperEl.clientWidth;
    if (displaySize === 0) return null;
    return { overlay, displaySize };
  }, []);

  const makeGridToScreen = useCallback((displaySize: number, n: number, scale: number, offsetX: number, offsetY: number) => {
    const cx = displaySize / 2;
    const cy = displaySize / 2;
    return (gx: number, gz: number) => {
      const normX = gx / n;
      const normZ = gz / n;
      const sx = (normX * displaySize - cx) * scale + cx + offsetX;
      const sy = (normZ * displaySize - cy) * scale + cy + offsetY;
      return { sx, sy };
    };
  }, []);

  // ── Draw overlay (grid + contours + position dots + cross-section) ──
  useEffect(() => {
    const info = getOverlayContext();
    if (!info || !values) return;
    const { overlay, displaySize } = info;

    const dpr = window.devicePixelRatio || 1;
    overlay.width = displaySize * dpr;
    overlay.height = displaySize * dpr;

    const ctx = overlay.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, displaySize, displaySize);

    const n = Math.round(Math.sqrt(values.length));
    const gridToScreen = makeGridToScreen(displaySize, n, 1, 0, 0);

    // ── World-coordinate gridlines ──
    const worldRange = rangeMax - rangeMin;
    // Grid spacing in canvas space — visual zoom comes from the transform layer.
    const pixelsPerBlock = displaySize / worldRange;
    let gridSpacing = 8;
    if (pixelsPerBlock * 8 < 16) gridSpacing = 64;
    else if (pixelsPerBlock * 8 < 32) gridSpacing = 32;
    else if (pixelsPerBlock * 8 < 64) gridSpacing = 16;

    ctx.strokeStyle = usgsTopoStyle ? "rgba(92, 64, 30, 0.1)" : "rgba(255,255,255,0.08)";
    ctx.lineWidth = usgsTopoStyle ? 0.4 : 0.5;

    const gridStart = Math.ceil(rangeMin / gridSpacing) * gridSpacing;
    for (let w = gridStart; w <= rangeMax; w += gridSpacing) {
      const g = ((w - rangeMin) / worldRange) * n;
      const { sx } = gridToScreen(g, 0);
      const { sy: sy0 } = gridToScreen(0, 0);
      const { sy: sy1 } = gridToScreen(0, n);
      ctx.beginPath();
      ctx.moveTo(sx, sy0);
      ctx.lineTo(sx, sy1);
      ctx.stroke();

      const { sy } = gridToScreen(0, g);
      const { sx: sx0 } = gridToScreen(0, 0);
      const { sx: sx1 } = gridToScreen(n, 0);
      ctx.beginPath();
      ctx.moveTo(sx0, sy);
      ctx.lineTo(sx1, sy);
      ctx.stroke();
    }

    // ── Terrain view: emphasize density = 0 surface (compatible with USGS topo) ──
    if (showThresholdView) {
      const zeroContours = generateContours(values, n, [0]);
      ctx.strokeStyle = usgsTopoStyle ? USGS_INDEX_CONTOUR_BROWN : "#ffffff";
      ctx.lineWidth = usgsTopoStyle ? 2 : 1.5;
      for (const contour of zeroContours) {
        for (const seg of contour.segments) {
          const p1 = gridToScreen(seg.x1, seg.z1);
          const p2 = gridToScreen(seg.x2, seg.z2);
          ctx.beginPath();
          ctx.moveTo(p1.sx, p1.sy);
          ctx.lineTo(p2.sx, p2.sy);
          ctx.stroke();
        }
      }
    }

    const contourLo = usgsTopoStyle ? (p02Value ?? minValue) : minValue;
    const contourHi = usgsTopoStyle ? (p98Value ?? maxValue) : maxValue;

    if (usgsTopoStyle) {
      drawUsgsHydrographyHatch(ctx, values, n, gridToScreen, hydroSlice);
      drawUsgsSteepSlopeHachures(ctx, values, n, gridToScreen, contourLo, contourHi);
    }

    // ── Contour lines (uses pre-computed contourData) ──
    if (showContours && contourData.length > 0) {
      if (usgsTopoStyle) {
        drawUsgsContours(ctx, contourData, gridToScreen, contourInterval);
        drawUsgsContourLabels(ctx, contourData, gridToScreen, contourInterval, n);
      } else {
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 0.8;
        for (const contour of contourData) {
          for (const seg of contour.segments) {
            const p1 = gridToScreen(seg.x1, seg.z1);
            const p2 = gridToScreen(seg.x2, seg.z2);
            ctx.beginPath();
            ctx.moveTo(p1.sx, p1.sy);
            ctx.lineTo(p2.sx, p2.sy);
            ctx.stroke();
          }
        }
      }
    }

    if (usgsTopoStyle && spotElevations.length > 0) {
      drawUsgsSpotElevations(ctx, spotElevations, gridToScreen);
    }

    if (usgsTopoStyle) {
      drawUsgsNeatline(ctx, displaySize);
      drawUsgsMarginTicks(
        ctx,
        displaySize,
        rangeMin,
        rangeMax,
        gridSpacing,
        gridToScreen,
        n,
        10,
        true,
      );
    }

    // ── Shape preview overlays ──
    if (showShapePreview && values) {
      if (cellShapeGrid && cellShapeGrid.resolution === n) {
        drawWallDistanceTint(ctx, cellShapeGrid, gridToScreen, showWallDistance);
        drawCellBoundaries(ctx, cellShapeGrid, gridToScreen, showCellBoundaries);
      }
      drawSdfZeroContour(ctx, sdfZeroSegments, gridToScreen, showSdfSurface);
      drawShapeMeshPoints(
        ctx,
        shapePreviewMeshPoints,
        rangeMin,
        rangeMax,
        n,
        gridToScreen,
        showMeshSamples,
      );
    }

    // ── Position overlay dots ──
    if (showPositionOverlay && positionOverlayPoints.length > 0) {
      ctx.fillStyle = positionOverlayColor;

      for (const pt of positionOverlayPoints) {
        const gx = ((pt.x - rangeMin) / worldRange) * n;
        const gz = ((pt.z - rangeMin) / worldRange) * n;
        const { sx, sy } = gridToScreen(gx, gz);

        ctx.globalAlpha = 0.3 + 0.7 * pt.weight;
        ctx.beginPath();
        ctx.arc(sx, sy, positionOverlaySize, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(displaySize - 72, displaySize - 22, 68, 18);
      ctx.fillStyle = positionOverlayColor;
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${positionOverlayPoints.length} pts`, displaySize - 8, displaySize - 8);
      ctx.textAlign = "start";
    }

    // ── Cross-section line ──
    if (showCrossSection && crossSectionLine) {
      const worldToGrid = (wx: number, wz: number) => ({
        gx: ((wx - rangeMin) / worldRange) * n,
        gz: ((wz - rangeMin) / worldRange) * n,
      });
      const g1 = worldToGrid(crossSectionLine.start.x, crossSectionLine.start.z);
      const g2 = worldToGrid(crossSectionLine.end.x, crossSectionLine.end.z);
      const p1 = gridToScreen(g1.gx, g1.gz);
      const p2 = gridToScreen(g2.gx, g2.gz);

      ctx.strokeStyle = usgsTopoStyle ? "#2d6a4f" : "#22c55e";
      ctx.lineWidth = usgsTopoStyle ? 1.75 : 2;
      ctx.setLineDash(usgsTopoStyle ? [8, 4] : [6, 3]);
      ctx.beginPath();
      ctx.moveTo(p1.sx, p1.sy);
      ctx.lineTo(p2.sx, p2.sy);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = usgsTopoStyle ? "#2d6a4f" : "#22c55e";
      ctx.beginPath();
      ctx.arc(p1.sx, p1.sy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p2.sx, p2.sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, [values, contourData, spotElevations, hydroSlice, showContours, contourInterval, usgsTopoStyle, showThresholdView, rangeMin, rangeMax, minValue, maxValue, p02Value, p98Value, yLevel, showCrossSection, crossSectionLine, showShapePreview, showCellBoundaries, showWallDistance, showMeshSamples, showSdfSurface, cellShapeGrid, sdfZeroSegments, shapePreviewMeshPoints, showPositionOverlay, positionOverlayPoints, positionOverlayColor, positionOverlaySize, getOverlayContext, makeGridToScreen]);

  // ── Get display rect for interactions ──
  const getInteractionRect = useCallback((): DOMRect | null => {
    const overlay = overlayRef.current;
    return overlay?.parentElement?.getBoundingClientRect() ?? null;
  }, []);

  // ── Mouse interactions ──
  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!values) return;
      const rect = getInteractionRect();
      if (!rect) return;

      // Pan
      if (dragRef.current && !e.shiftKey) {
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        applyTransform({
          ...getTransform(),
          offsetX: dragRef.current.startOX + dx,
          offsetY: dragRef.current.startOY + dy,
        });
        return;
      }

      // Cross-section drawing
      if (crossLineRef.current && e.shiftKey) {
        const world = screenToWorld(
          e.clientX - rect.left, e.clientY - rect.top,
          getTransform(), rect.width, rangeMin, rangeMax,
        );
        setCrossSectionLine({
          start: { x: crossLineRef.current.startX, z: crossLineRef.current.startZ },
          end: { x: world.x, z: world.z },
        });
        return;
      }

      // Hover readout
      const world = screenToWorld(
        e.clientX - rect.left, e.clientY - rect.top,
        getTransform(), rect.width, rangeMin, rangeMax,
      );

      // Use actual grid size from values array — may differ from resolution
      // during progressive coarse passes (e.g. 16×16 while resolution is 128)
      const n = Math.round(Math.sqrt(values.length));
      const worldRange = rangeMax - rangeMin;
      const col = Math.floor(((world.x - rangeMin) / worldRange) * n);
      const row = Math.floor(((world.z - rangeMin) / worldRange) * n);
      if (col < 0 || col >= n || row < 0 || row >= n) {
        setHoverInfo(null);
        return;
      }
      const idx = row * n + col;
      const val = values[idx];
      if (val === undefined) { setHoverInfo(null); return; }
      setHoverInfo({
        x: Math.round(world.x),
        z: Math.round(world.z),
        value: val,
      });
    },
    [values, rangeMin, rangeMax, getTransform, applyTransform, setCrossSectionLine, getInteractionRect],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = getInteractionRect();
      if (!rect) return;
      const liveTransform = getTransform();

      // Shift+click starts cross-section line
      if (e.shiftKey && showCrossSection) {
        const world = screenToWorld(
          e.clientX - rect.left, e.clientY - rect.top,
          liveTransform, rect.width, rangeMin, rangeMax,
        );
        crossLineRef.current = { startX: world.x, startZ: world.z };
        return;
      }

      // Normal click starts pan — use document-level listeners so drag
      // releases correctly even when the cursor leaves the heatmap container
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startOX: liveTransform.offsetX,
        startOY: liveTransform.offsetY,
      };
      setIsPanning(true);

      const handleDocMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = ev.clientX - dragRef.current.startX;
        const dy = ev.clientY - dragRef.current.startY;
        applyTransform({
          ...getTransform(),
          offsetX: dragRef.current.startOX + dx,
          offsetY: dragRef.current.startOY + dy,
        });
      };
      const handleDocMouseUp = () => {
        dragRef.current = null;
        crossLineRef.current = null;
        setIsPanning(false);
        flushTransform();
        document.removeEventListener("mousemove", handleDocMouseMove);
        document.removeEventListener("mouseup", handleDocMouseUp);
      };
      document.addEventListener("mousemove", handleDocMouseMove);
      document.addEventListener("mouseup", handleDocMouseUp);
    },
    [getTransform, rangeMin, rangeMax, showCrossSection, getInteractionRect, applyTransform, flushTransform],
  );

  const onMouseUp = useCallback(() => {
    dragRef.current = null;
    crossLineRef.current = null;
    setIsPanning(false);
    flushTransform();
  }, [flushTransform]);

  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const rect = getInteractionRect();
      if (!rect) return;
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      const current = getTransform();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;

      // Ctrl/Cmd + wheel: zoom the sampled world range (re-triggers density eval).
      if (e.ctrlKey || e.metaKey) {
        const world = screenToWorld(
          mouseX, mouseY, current, rect.width, rangeMin, rangeMax,
        );
        const span = (rangeMax - rangeMin) * factor;
        const minSpan = 16;
        const maxSpan = 512;
        const clampedSpan = Math.max(minSpan, Math.min(maxSpan, span));
        const center = (world.x + world.z) / 2;
        setRange(center - clampedSpan / 2, center + clampedSpan / 2);
        return;
      }

      const newScale = Math.max(0.25, Math.min(20, current.scale * factor));

      // Zoom centered on cursor
      const ox = mouseX - cx - current.offsetX;
      const oy = mouseY - cy - current.offsetY;
      const ratio = newScale / current.scale;

      applyTransform({
        scale: newScale,
        offsetX: current.offsetX - (ox * (ratio - 1)),
        offsetY: current.offsetY - (oy * (ratio - 1)),
      });
    },
    [rangeMin, rangeMax, applyTransform, setRange, getInteractionRect, getTransform],
  );

  useNonPassiveWheel(interactionRef, onWheel, Boolean(values));

  const onDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.shiftKey && showCrossSection) {
        setCrossSectionLine(null);
        return;
      }
      resetCanvasTransform();
    },
    [showCrossSection, setCrossSectionLine, resetCanvasTransform],
  );

  const onMouseLeave = useCallback(() => {
    setHoverInfo(null);
    if (!dragRef.current) {
      crossLineRef.current = null;
    }
  }, []);

  const cm = getColormap(colormap);

  if (!values) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-tn-text-muted">
        No preview data
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-tn-heatmap-root
      className={`relative flex items-center justify-center h-full min-h-0 w-full p-0.5 overflow-visible ${usgsTopoStyle ? "bg-[#f5f0e1]" : ""}`}
    >
      <div
        ref={mapFrameRef}
        className="relative shrink-0 overflow-visible"
        style={{
          width: mapFrameSize.w > 0 ? mapFrameSize.w : "100%",
          height: mapFrameSize.h > 0 ? mapFrameSize.h : "100%",
          maxWidth: "100%",
          maxHeight: "100%",
        }}
      >
        {/* Transformed map layer — GPU pan/zoom; overlays skip transform math per frame */}
        <div
          ref={transformLayerRef}
          className="absolute inset-0 w-full h-full"
          style={{ transformOrigin: "center center", willChange: "transform" }}
        >
          <canvas
            ref={setRefs}
            data-tn-heatmap-base
            className={`absolute inset-0 w-full h-full border ${usgsTopoStyle ? "border-[#c4b89a]" : "border-tn-border"}`}
            style={{ imageRendering: canvasTransform.scale > 2 ? "auto" : "pixelated" }}
          />
          <canvas
            ref={overlayRef}
            data-tn-heatmap-overlay
            className="absolute inset-0 w-full h-full"
            style={{ pointerEvents: "none" }}
          />
        </div>
        {/* Interaction layer */}
        <div
          ref={interactionRef}
          className="absolute inset-0"
          role="application"
          aria-label={
            usgsTopoStyle
              ? "Topographic density map. Drag to pan, scroll to zoom detail, Ctrl+scroll to change world range, Shift-drag for cross-section."
              : "Density heatmap preview. Drag to pan, scroll to zoom detail, Ctrl+scroll to change world range, Shift-drag for cross-section."
          }
          style={{ cursor: isPanning ? "grabbing" : "crosshair" }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          onDoubleClick={onDoubleClick}
        />

        {usgsTopoStyle && (
          <TopoMapHud
            contourInterval={contourInterval}
            rangeMin={rangeMin}
            rangeMax={rangeMax}
            yLevel={yLevel}
            p02={p02Value ?? minValue}
            p98={p98Value ?? maxValue}
            zoom={canvasTransform.scale}
            evalResolution={evalResolution}
            mapSize={Math.min(mapFrameSize.w, mapFrameSize.h) || 0}
            canvasScale={canvasTransform.scale}
            hoverInfo={hoverInfo}
            showHydrography={hydroContext.enabled}
            waterSurfaceY={hydroContext.waterSurfaceY}
            sliceHint={sliceHint}
          />
        )}
      </div>

      {!usgsTopoStyle && hoverInfo && (
        <div className={`absolute bottom-3 left-3 px-2 py-1 font-mono text-[10px] text-tn-text ${previewHudBadgeClass}`}>
          d: {hoverInfo.value.toFixed(4)} &middot; x {hoverInfo.x}, z {hoverInfo.z}
        </div>
      )}

      {!usgsTopoStyle && (
        <div className={`absolute top-3 right-3 flex flex-col gap-0.5 font-mono text-[10px] text-tn-text-muted ${previewHudBadgeClass} px-2 py-1`}>
          <span>min: {minValue.toFixed(3)}</span>
          <span>max: {maxValue.toFixed(3)}</span>
        </div>
      )}

      {!usgsTopoStyle && (
        <div className="absolute bottom-3 right-3 flex items-end gap-1">
          <span className="font-mono text-[9px] text-tn-text-muted">low</span>
          <div className="h-2 w-24 rounded-sm" style={{ background: cm.cssGradient }} />
          <span className="font-mono text-[9px] text-tn-text-muted">high</span>
        </div>
      )}

      {!usgsTopoStyle && (canvasTransform.scale !== 1 || evalResolution !== resolution) && (
        <div className={`absolute top-3 left-3 ${previewHudBadgeClass}`}>
          {canvasTransform.scale.toFixed(1)}× · {evalResolution}²
          {isLoading && !values && <span className="ml-1 text-tn-accent">…</span>}
        </div>
      )}
    </div>
  );
});

export const Heatmap2D = memo(Heatmap2DInner);
Heatmap2D.displayName = "Heatmap2D";
export default Heatmap2D;
