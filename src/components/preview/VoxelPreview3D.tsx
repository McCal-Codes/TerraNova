import React from "react";
import { memo, useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { AdaptiveDpr, AdaptiveEvents, OrbitControls } from "@react-three/drei";
import { EffectComposer, SSAO } from "@react-three/postprocessing";
import { useShallow } from "zustand/react/shallow";
import { usePreviewStore } from "@/stores/previewStore";
import { useConfigStore } from "@/stores/configStore";
import { CameraPresets } from "./CameraPresets";
import { ShapePreview3D } from "./ShapePreview3D";
import { WorldPlayerMarker } from "./WorldPlayerMarker";
import { useShapePreviewSliceY } from "@/hooks/useShapePreviewSliceY";
import { FluidPlane } from "./FluidPlane";
import { MaterialLegend } from "./MaterialLegend";
import { EdgeOutlineEffect } from "./EdgeOutlineEffect";
import { HytaleSky, HytaleFog, GroundShadow } from "./SceneEnvironment";
import type { VoxelMaterial } from "@/utils/voxelExtractor";
import { useDraggableHudPosition } from "@/hooks/useDraggableHudPosition";
import { hudAbsoluteStyle } from "@/utils/hudPositionStyle";
import { PreviewSceneCameraFit } from "./PreviewSceneCameraFit";
import { Vector2, MathUtils } from "three";
import { VoxelMeshGroup } from "./VoxelMeshGroup";
import { buildCutawayClipPlane } from "@/utils/previewCutaway";
import { WebGLContextRecovery } from "./WebGLContextRecovery";
import { previewHudBadgeClass, previewHudPanelClass } from "./previewChromeStyles";

/* ── Canvas ref capture ──────────────────────────────────────────── */

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

/* ── Voxel Scene ─────────────────────────────────────────────────── */

const VoxelScene = memo(function VoxelScene({ wireframe }: { wireframe: boolean }) {
  const shapeSliceY = useShapePreviewSliceY();
  const showWaterPlane = usePreviewStore((s) => s.showWaterPlane);
  const showFog3D = usePreviewStore((s) => s.showFog3D);
  const showSky3D = usePreviewStore((s) => s.showSky3D);
  const voxelMeshData = usePreviewStore((s) => s.voxelMeshData);
  const cutawayEnabled = usePreviewStore((s) => s.cutawayEnabled);
  const cutawayLevel = usePreviewStore((s) => s.cutawayLevel);
  const rangeMin = usePreviewStore((s) => s.rangeMin);
  const rangeMax = usePreviewStore((s) => s.rangeMax);
  const voxelYMin = usePreviewStore((s) => s.voxelYMin);
  const voxelYMax = usePreviewStore((s) => s.voxelYMax);
  const voxelResolution = usePreviewStore((s) => s.voxelResolution);
  const voxelYSlices = usePreviewStore((s) => s.voxelYSlices);
  const enableShadows = useConfigStore((s) => s.enableShadows);
  const shadowMapSize = useConfigStore((s) => s.shadowMapSize);
  const atm = usePreviewStore((s) => s.atmosphereSettings);
  const tint = usePreviewStore((s) => s.tintColors);

  const clippingPlanes = useMemo(() => {
    if (!cutawayEnabled) return undefined;
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
  }, [cutawayEnabled, cutawayLevel, rangeMin, rangeMax, voxelYMin, voxelYMax, voxelResolution, voxelYSlices]);

  // Sun position derived from sunAngle (0=east horizon, 90=zenith, 180=west horizon)
  const sunAngleRad = MathUtils.degToRad(atm.sunAngle ?? 60);
  const sunRadius = 35;
  const sunX = Math.cos(sunAngleRad) * sunRadius;
  const sunY = Math.max(0.5, Math.sin(sunAngleRad) * sunRadius);
  const sunZ = -Math.sin(sunAngleRad * 0.4) * 10;
  // Dim the sun intensity as it approaches the horizon (sin < 0.15)
  const sunElevation = Math.sin(sunAngleRad);
  const sunIntensity = Math.max(0, Math.min(1, sunElevation * 6)) * 0.8;
  const ambientIntensity = Math.max(0.05, 0.4 - sunElevation * 0.25);

  return (
    <>
      {/* Atmosphere-driven lighting */}
      <hemisphereLight args={[atm.skyHorizon, "#8B7355", ambientIntensity]} />
      <directionalLight
        position={[sunX, sunY, sunZ]}
        intensity={sunIntensity}
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
      <directionalLight position={[-12, 15, -8]} intensity={0.2} color={atm.ambientColor} />

      {voxelMeshData && voxelMeshData.length > 0 && (
        <VoxelMeshGroup
          meshData={voxelMeshData}
          wireframe={wireframe}
          color1={tint.color1}
          color2={tint.color2}
          color3={tint.color3}
          clippingPlanes={clippingPlanes}
        />
      )}

      <OrbitControls enableDamping dampingFactor={0.1} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -25.02, 0]} receiveShadow renderOrder={-2}>
        <planeGeometry args={[52, 52]} />
        <meshStandardMaterial color="#2e2a24" roughness={1} metalness={0} />
      </mesh>
      <group position={[0, -25, 0]}>
        <gridHelper args={[50, 50, "#4a4438", "#312d28"]} />
      </group>
      <GroundShadow />
      <ShapePreview3D space="voxelScene" sliceWorldY={shapeSliceY} />
      <WorldPlayerMarker />
      {showWaterPlane && <FluidPlane />}
      {showFog3D && <HytaleFog />}
      {showSky3D && <HytaleSky />}
      <CameraPresets />

      <PostProcessing />
    </>
  );
});

/* ── Main export ──────────────────────────────────────────────────── */

export function VoxelPreview3D({ onCanvasRef }: { onCanvasRef?: (el: HTMLCanvasElement | null) => void }) {
  const {
    showVoxelWireframe,
    showMaterialLegend,
    isVoxelLoading,
    voxelEvalProgressRes,
    voxelDisplayedRes,
    voxelMeshData,
    voxelError,
    voxelPalette,
    surfaceVoxelCount,
  } = usePreviewStore(
    useShallow((s) => ({
      showVoxelWireframe: s.showVoxelWireframe,
      showMaterialLegend: s.showMaterialLegend,
      isVoxelLoading: s.isVoxelLoading,
      voxelEvalProgressRes: s.voxelEvalProgressRes,
      voxelDisplayedRes: s.voxelDisplayedRes,
      voxelMeshData: s.voxelMeshData,
      voxelError: s.voxelError,
      voxelPalette: s.voxelPalette,
      surfaceVoxelCount: s.surfaceVoxelCount,
    })),
  );
  const legendMaterials = useMemo(
    (): VoxelMaterial[] =>
      voxelPalette.map((entry) => ({
        name: entry.name,
        color: entry.color,
      })),
    [voxelPalette],
  );
  const { enableShadows, gpuPowerPreference, preferredGpuId, rendererPixelRatio } = useConfigStore(
    useShallow((s) => ({
      enableShadows: s.enableShadows,
      gpuPowerPreference: s.gpuPowerPreference,
      preferredGpuId: s.preferredGpuId,
      rendererPixelRatio: s.rendererPixelRatio,
    })),
  );
  const canvasDpr = rendererPixelRatio > 0 ? rendererPixelRatio : undefined;
  const [glRecoveryKey, setGlRecoveryKey] = React.useState(0);
  const {
    position: legendPos,
    onDragMouseDown: onLegendDragStart,
    resetPosition: resetLegendPosition,
  } = useDraggableHudPosition("tn-voxelMaterialLegendPos", { x: 0, y: 0 });

  return (
    <div className="relative w-full h-full">
      <Canvas
        key={`voxel3d-${glRecoveryKey}-${gpuPowerPreference}-${preferredGpuId || "auto"}`}
        camera={{ position: [35, 30, 35], fov: 45 }}
        dpr={canvasDpr}
        gl={{ preserveDrawingBuffer: true, powerPreference: gpuPowerPreference, alpha: false, localClippingEnabled: true }}
        shadows={enableShadows}
        style={{ background: "#141210" }}
      >
        {rendererPixelRatio === 0 && (
          <>
            <AdaptiveDpr pixelated />
            <AdaptiveEvents />
          </>
        )}
        <WebGLContextRecovery onRecover={() => setGlRecoveryKey((k) => k + 1)} />
        <color attach="background" args={["#141210"]} />
        <PreviewSceneCameraFit target={[0, -12, 0]} radius={30} resetKey={voxelMeshData?.length ?? 0} />
        <VoxelScene wireframe={showVoxelWireframe} />
        {onCanvasRef && <CanvasRefCapture onCanvas={onCanvasRef} />}
      </Canvas>

      {/* Loading indicator */}
      {isVoxelLoading && !voxelMeshData && (
        <div className={`absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2 py-1 text-xs text-tn-text-muted ${previewHudPanelClass}`}>
          <span className="inline-block w-3 h-3 border-2 border-tn-accent border-t-transparent rounded-full animate-spin" />
          Evaluating volume{voxelEvalProgressRes != null ? ` (${voxelEvalProgressRes}³)` : ""}…
        </div>
      )}
      {!isVoxelLoading && voxelEvalProgressRes != null && (
        <div className={`absolute top-2 left-2 z-10 px-2 py-1 text-[10px] text-tn-text-muted ${previewHudPanelClass}`}>
          {voxelDisplayedRes != null && voxelDisplayedRes < voxelEvalProgressRes
            ? `${voxelDisplayedRes}³ preview · refining to ${voxelEvalProgressRes}³…`
            : `Refining to ${voxelEvalProgressRes}³…`}
        </div>
      )}

      {/* Voxel count */}
      {surfaceVoxelCount != null && surfaceVoxelCount > 0 && (
        <div className={`absolute bottom-2 left-2 z-10 px-2 py-1 font-mono text-[10px] text-tn-text-muted ${previewHudBadgeClass}`}>
          {surfaceVoxelCount.toLocaleString()} surface voxels
        </div>
      )}

      {/* Error */}
      {voxelError && (
        <div className="absolute bottom-2 right-2 z-10 px-2 py-1 rounded border border-red-800/60 bg-red-950/95 text-[10px] text-red-300 shadow-sm">
          {voxelError}
        </div>
      )}

      {/* Material legend — bottom-right by default, draggable */}
      {showMaterialLegend && legendMaterials.length > 0 && voxelMeshData && (
        <div
          style={{
            ...hudAbsoluteStyle(legendPos, { x: "right", y: "bottom" }, { right: 12, bottom: 40 }),
            zIndex: 20,
            cursor: "grab",
            userSelect: "none",
          }}
          onMouseDown={onLegendDragStart}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              resetLegendPosition();
            }}
            className="absolute -top-1 -right-1 z-20 flex h-5 w-5 items-center justify-center rounded border border-black/35 bg-black/55 text-[10px] text-tn-text backdrop-blur-sm hover:bg-black/70"
            title="Reset legend position"
          >
            ↺
          </button>
          <MaterialLegend materials={legendMaterials} />
        </div>
      )}

    </div>
  );
}
