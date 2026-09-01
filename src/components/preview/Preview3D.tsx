import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { AdaptiveDpr, AdaptiveEvents, OrbitControls } from "@react-three/drei";
import { EffectComposer, SSAO } from "@react-three/postprocessing";
import { useShallow } from "zustand/react/shallow";
import { usePreviewStore } from "@/stores/previewStore";
import { useConfigStore } from "@/stores/configStore";
import { getColormap } from "@/utils/colormaps";
import { CameraPresets } from "./CameraPresets";
import { WaterPlane } from "./FluidPlane";
import { PositionMarkers3D } from "./PositionMarkers3D";
import { ShapePreview3D } from "./ShapePreview3D";
import { EdgeOutlineEffect } from "./EdgeOutlineEffect";
import { HytaleSky, HytaleFog, GroundShadow } from "./SceneEnvironment";
import { BufferAttribute, Vector2 } from "three";
import type { Mesh } from "three";
import { VoxelMeshGroup } from "./VoxelMeshGroup";
import {
  buildCutawayClipPlane,
  buildCutawayVolume,
  presetSupportsClipPlanePreview,
  type CutawayPreset,
} from "@/utils/previewCutaway";
import { reextractVoxelsWithCutaway } from "@/utils/finishVoxelFromVolume";
import { WebGLContextRecovery } from "./WebGLContextRecovery";
import { PreviewSceneCameraFit } from "./PreviewSceneCameraFit";
import { previewHudChipClass, previewHudPanelClass } from "./previewChromeStyles";

/** Delay before a cutaway change is settled into real capped geometry. */
const CUTAWAY_SETTLE_MS = 150;

function Heightfield({ wireframe }: { wireframe: boolean }) {
  const { values, minValue, maxValue, p02Value, p98Value, colormap, heightScale3D } = usePreviewStore(
    useShallow((s) => ({
      values: s.values,
      minValue: s.minValue,
      maxValue: s.maxValue,
      p02Value: s.p02Value,
      p98Value: s.p98Value,
      colormap: s.colormap,
      heightScale3D: s.heightScale3D,
    })),
  );
  const meshRef = useRef<Mesh>(null);

  const geometry = useMemo(() => {
    if (!values) return null;

    const cm = getColormap(colormap);
    const n = Math.round(Math.sqrt(values.length));
    const positions = new Float32Array(n * n * 3);
    const colors = new Float32Array(n * n * 3);
    // Use percentile-based range for outlier resistance
    const lo = p02Value ?? minValue;
    const hi = p98Value ?? maxValue;
    const range = hi - lo || 1;
    const isFlat = Math.abs(hi - lo) < 1e-8;
    const d = n > 1 ? n - 1 : 1; // divisor for vertex positions to span full [-25, 25]

    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        const i = z * n + x;
        const normalized = isFlat ? 0.5 : Math.max(0, Math.min(1, (values[i] - lo) / range));
        const height = normalized * heightScale3D;
        positions[i * 3] = (x / d - 0.5) * 50;
        positions[i * 3 + 1] = height;
        positions[i * 3 + 2] = (z / d - 0.5) * 50;

        const [r, g, b] = cm.rampVec(normalized);
        colors[i * 3] = r;
        colors[i * 3 + 1] = g;
        colors[i * 3 + 2] = b;
      }
    }

    const indices: number[] = [];
    for (let z = 0; z < n - 1; z++) {
      for (let x = 0; x < n - 1; x++) {
        const tl = z * n + x;
        const tr = tl + 1;
        const bl = (z + 1) * n + x;
        const br = bl + 1;
        indices.push(tl, bl, tr);
        indices.push(tr, bl, br);
      }
    }

    return { positions, colors, indices: new Uint32Array(indices) };
  }, [values, minValue, maxValue, p02Value, p98Value, colormap, heightScale3D]);

  useEffect(() => {
    if (!meshRef.current || !geometry) return;
    const geo = meshRef.current.geometry;
    geo.setAttribute("position", new BufferAttribute(geometry.positions, 3));
    geo.setAttribute("color", new BufferAttribute(geometry.colors, 3));
    geo.setIndex(new BufferAttribute(geometry.indices, 1));
    geo.computeVertexNormals();
  }, [geometry]);

  if (!geometry) return null;

  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      <bufferGeometry />
      <meshStandardMaterial vertexColors wireframe={wireframe} roughness={0.8} />
    </mesh>
  );
}

/** Registers the Three.js canvas element with the parent via callback ref */
function CanvasRefCapture({ onCanvas }: { onCanvas: (el: HTMLCanvasElement) => void }) {
  const { gl } = useThree();
  useEffect(() => {
    onCanvas(gl.domElement);
  }, [gl, onCanvas]);
  return null;
}

/* ── Edge outline effect wrapper ─────────────────────────────────── */

function EdgeOutline() {
  const { size } = useThree();
  const effect = useMemo(() => {
    return new EdgeOutlineEffect({
      resolution: new Vector2(size.width, size.height),
    });
  }, [size.width, size.height]);

  useEffect(() => () => effect.dispose(), [effect]);

  return <primitive object={effect} />;
}

/* ── Post-processing ─────────────────────────────────────────────── */

function SSAOEffect() {
  const ssaoSamples = useConfigStore((s) => s.ssaoSamples);
  return <SSAO samples={ssaoSamples} radius={0.5} intensity={1.5} luminanceInfluence={0.5} />;
}

function PostProcessing() {
  const { showSSAO, showEdgeOutline } = usePreviewStore(
    useShallow((s) => ({ showSSAO: s.showSSAO, showEdgeOutline: s.showEdgeOutline })),
  );

  if (showSSAO && showEdgeOutline) {
    return (
      <EffectComposer>
        <SSAOEffect />
        <EdgeOutline />
      </EffectComposer>
    );
  }
  if (showSSAO) {
    return (
      <EffectComposer>
        <SSAOEffect />
      </EffectComposer>
    );
  }
  if (showEdgeOutline) {
    return (
      <EffectComposer>
        <EdgeOutline />
      </EffectComposer>
    );
  }
  return null;
}

function VolumeScene({ wireframe }: { wireframe: boolean }) {
  const {
    voxelMeshData,
    cutawayEnabled,
    cutawayLevel,
    cutawayPreset,
    showVoidView,
    rangeMin,
    rangeMax,
    voxelYMin,
    voxelYMax,
    voxelResolution,
    voxelYSlices,
    tint,
  } = usePreviewStore(
    useShallow((s) => ({
      voxelMeshData: s.voxelMeshData,
      cutawayEnabled: s.cutawayEnabled,
      cutawayLevel: s.cutawayLevel,
      cutawayPreset: s.cutawayPreset,
      showVoidView: s.showVoidView,
      rangeMin: s.rangeMin,
      rangeMax: s.rangeMax,
      voxelYMin: s.voxelYMin,
      voxelYMax: s.voxelYMax,
      voxelResolution: s.voxelResolution,
      voxelYSlices: s.voxelYSlices,
      tint: s.tintColors,
    })),
  );

  const activePreset: CutawayPreset = cutawayEnabled ? cutawayPreset : "off";

  /**
   * Live GPU preview, "top" only.
   *
   * A corner cut is the intersection of three half-spaces, which needs
   * `clipIntersection: true` — and that makes three.js reinitialise materials every
   * frame for a large FPS cost. Corner relies on the re-extraction below instead,
   * which also caps the cut properly rather than leaving it hollow.
   */
  const clippingPlanes = useMemo(() => {
    if (!presetSupportsClipPlanePreview(activePreset)) return undefined;
    return [
      buildCutawayClipPlane(cutawayLevel, {
        rangeMin,
        rangeMax,
        voxelYMin,
        voxelYMax,
        resolution: voxelResolution,
        ySlices: voxelYSlices,
      }),
    ];
  }, [activePreset, cutawayLevel, rangeMin, rangeMax, voxelYMin, voxelYMax, voxelResolution, voxelYSlices]);

  /**
   * Settle the cut into real capped geometry once the user stops adjusting it.
   *
   * Debounced because re-extraction walks the whole volume; the clip plane covers the
   * dragging interval for "top", and "corner" simply updates a beat later. Guarded by
   * a signature ref so re-entering the same cut does not rebuild the mesh.
   */
  const lastCutSignature = useRef<string | null>(null);
  useEffect(() => {
    const dims = {
      resolution: voxelResolution,
      ySlices: voxelYSlices,
      voxelYMin,
      voxelYMax,
    };
    const cut = buildCutawayVolume(activePreset, cutawayLevel, dims);
    // showVoidView participates because it swaps the material palette, which is
    // resolved inside re-extraction.
    const signature = JSON.stringify({ cut, dims, showVoidView });
    if (signature === lastCutSignature.current) return;

    const timer = setTimeout(() => {
      lastCutSignature.current = signature;
      reextractVoxelsWithCutaway(cut);
    }, CUTAWAY_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [activePreset, cutawayLevel, voxelResolution, voxelYSlices, voxelYMin, voxelYMax, showVoidView]);

  if (!voxelMeshData?.length) return null;

  return (
    <group position={[0, -25, 0]}>
      <VoxelMeshGroup
        meshData={voxelMeshData}
        wireframe={wireframe}
        color1={tint.color1}
        color2={tint.color2}
        color3={tint.color3}
        clippingPlanes={clippingPlanes}
      />
    </group>
  );
}

function Preview3DInner({ onCanvasRef }: { onCanvasRef?: (el: HTMLCanvasElement | null) => void }) {
  const [wireframe, setWireframe] = useState(false);
  const [glRecoveryKey, setGlRecoveryKey] = useState(0);
  const {
    showWaterPlane,
    showFog3D,
    showSky3D,
    show3DVolumeView,
    isVoxelLoading,
    voxelEvalProgressRes,
    voxelDisplayedRes,
    voxelMeshData,
    atm,
    values,
  } = usePreviewStore(
    useShallow((s) => ({
      showWaterPlane: s.showWaterPlane,
      showFog3D: s.showFog3D,
      showSky3D: s.showSky3D,
      show3DVolumeView: s.show3DVolumeView,
      isVoxelLoading: s.isVoxelLoading,
      voxelEvalProgressRes: s.voxelEvalProgressRes,
      voxelDisplayedRes: s.voxelDisplayedRes,
      voxelMeshData: s.voxelMeshData,
      atm: s.atmosphereSettings,
      values: s.values,
    })),
  );
  const { enableShadows, shadowMapSize, gpuPowerPreference, preferredGpuId, rendererPixelRatio } = useConfigStore(
    useShallow((s) => ({
      enableShadows: s.enableShadows,
      shadowMapSize: s.shadowMapSize,
      gpuPowerPreference: s.gpuPowerPreference,
      preferredGpuId: s.preferredGpuId,
      rendererPixelRatio: s.rendererPixelRatio,
    })),
  );
  const canvasDpr = rendererPixelRatio > 0 ? rendererPixelRatio : undefined;

  return (
    <div className="relative w-full h-full">
      <Canvas
        key={`preview3d-${glRecoveryKey}-${gpuPowerPreference}-${preferredGpuId || "auto"}`}
        camera={{ position: [30, 25, 30], fov: 50 }}
        dpr={canvasDpr}
        gl={{
          preserveDrawingBuffer: true,
          powerPreference: gpuPowerPreference,
          localClippingEnabled: show3DVolumeView,
        }}
        shadows={enableShadows}
      >
        {rendererPixelRatio === 0 && (
          <>
            <AdaptiveDpr pixelated />
            <AdaptiveEvents />
          </>
        )}
        <PreviewSceneCameraFit
          target={[0, show3DVolumeView ? -12 : 0, 0]}
          radius={show3DVolumeView ? 30 : 28}
          resetKey={`${show3DVolumeView}-${voxelMeshData?.length ?? 0}-${values?.length ?? 0}`}
        />
        <WebGLContextRecovery onRecover={() => setGlRecoveryKey((k) => k + 1)} />
        {/* Hytale-style lighting */}
        <hemisphereLight args={[atm.skyHorizon, "#8B7355", 0.4]} />
        <directionalLight
          position={[15, 30, 10]}
          intensity={0.8}
          color={atm.sunColor}
          castShadow={enableShadows}
          shadow-mapSize-width={shadowMapSize}
          shadow-mapSize-height={shadowMapSize}
          shadow-camera-left={-35}
          shadow-camera-right={35}
          shadow-camera-top={35}
          shadow-camera-bottom={-35}
          shadow-camera-near={0.5}
          shadow-camera-far={100}
        />
        <directionalLight position={[-12, 15, -8]} intensity={0.2} color="#b0c4de" />

        {show3DVolumeView ? <VolumeScene wireframe={wireframe} /> : <Heightfield wireframe={wireframe} />}
        <OrbitControls enableDamping dampingFactor={0.1} />
        <gridHelper args={[50, 50, "#4a4438", "#312d28"]} />
        <GroundShadow />
        <PositionMarkers3D />
        <ShapePreview3D space="heightfield" />
        {showWaterPlane && <WaterPlane />}
        {showFog3D && <HytaleFog />}
        {showSky3D && <HytaleSky />}
        <CameraPresets />
        {onCanvasRef && <CanvasRefCapture onCanvas={onCanvasRef} />}

        <PostProcessing />
      </Canvas>

      {show3DVolumeView && (
        <div className={`absolute top-2 right-2 z-10 max-w-[220px] px-2 py-1 text-[10px] text-tn-text-muted ${previewHudPanelClass}`}>
          Underground volume view — surface heightfield cannot show cave voids.
          {isVoxelLoading && !voxelMeshData
            ? (voxelEvalProgressRes != null
              ? ` Evaluating volume (${voxelEvalProgressRes}³)…`
              : " Evaluating volume…")
            : voxelEvalProgressRes != null
              ? (voxelDisplayedRes != null && voxelDisplayedRes < voxelEvalProgressRes
                ? ` ${voxelDisplayedRes}³ preview · refining to ${voxelEvalProgressRes}³…`
                : ` Refining to ${voxelEvalProgressRes}³…`)
              : ""}
        </div>
      )}

      {/* Wireframe toggle */}
      <div className="absolute top-2 left-2 z-10">
        <button
          onClick={() => setWireframe((w) => !w)}
          className={`${previewHudChipClass} ${
            wireframe
              ? "border-tn-accent/50 bg-black/65 text-tn-accent"
              : ""
          }`}
        >
          {wireframe ? "Wireframe" : "Solid"}
        </button>
      </div>
    </div>
  );
}

export const Preview3D = memo(Preview3DInner);
