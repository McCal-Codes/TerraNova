import type { NoiseRangeConfig } from "@/stores/slices/types";
import { SliderField } from "@/components/properties/SliderField";
import type { ProjectBiomeEntry } from "@/utils/propSources/listProjectBiomes";

export function BiomeRangeTransitionSettings({
  config,
  onChange,
  onBlur,
}: {
  config: NoiseRangeConfig;
  onChange: (field: keyof NoiseRangeConfig, value: string | number) => void;
  onBlur: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] leading-relaxed text-tn-text-muted">
        Transition blending applies to terrain density only — materials and props switch at biome boundaries.
      </p>
      <SliderField
        label="DefaultTransitionDistance"
        value={config.DefaultTransitionDistance}
        min={0}
        max={128}
        step={1}
        onChange={(v) => onChange("DefaultTransitionDistance", v)}
        onBlur={onBlur}
      />
      <SliderField
        label="MaxBiomeEdgeDistance"
        value={config.MaxBiomeEdgeDistance}
        min={0}
        max={128}
        step={1}
        onChange={(v) => onChange("MaxBiomeEdgeDistance", v)}
        onBlur={onBlur}
      />
    </div>
  );
}

export function BiomeDefaultBiomeInput({
  value,
  projectBiomes,
  onChange,
  onBlur,
  compact = false,
}: {
  value: string;
  projectBiomes: ProjectBiomeEntry[];
  onChange: (value: string) => void;
  onBlur: () => void;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider text-tn-text-muted">Fallback biome</label>
        <input
          type="text"
          list={projectBiomes.length > 0 ? "biome-mapper-default-options" : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder="DefaultBiome"
          className="w-full rounded border border-tn-border bg-tn-bg px-2 py-1 text-sm text-tn-text outline-none focus:border-tn-accent"
        />
        {projectBiomes.length > 0 && (
          <datalist id="biome-mapper-default-options">
            {projectBiomes.map((b) => (
              <option key={b.path} value={b.name} />
            ))}
          </datalist>
        )}
      </div>
    );
  }

  return (
    <>
      <label className="text-xs text-tn-text-muted">DefaultBiome</label>
      <input
        type="text"
        list={projectBiomes.length > 0 ? "biome-mapper-default-options" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder="Fallback when noise is outside all ranges"
        className="w-full rounded border border-tn-border bg-tn-bg px-2 py-1 text-sm text-tn-text outline-none focus:border-tn-accent"
      />
      {projectBiomes.length > 0 && (
        <datalist id="biome-mapper-default-options">
          {projectBiomes.map((b) => (
            <option key={b.path} value={b.name} />
          ))}
        </datalist>
      )}
      <p className="text-[10px] leading-relaxed text-tn-text-muted">
        Used for any selector noise value not covered by a range below.
      </p>
    </>
  );
}
