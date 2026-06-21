import { SliderField } from "./SliderField";
import { TextField } from "./TextField";
import { DEFAULT_TINT_DENSITY, readTintDensity } from "./biomeTintUtils";

export interface TintDensityFieldProps {
  tintProvider: Record<string, unknown> | undefined;
  onChange: (density: Record<string, unknown>) => void;
  onBlur?: () => void;
}

export function TintDensityField({ tintProvider, onChange, onBlur }: TintDensityFieldProps) {
  const density = readTintDensity(tintProvider);
  const seed = typeof density.Seed === "string" ? density.Seed : String(DEFAULT_TINT_DENSITY.Seed);
  const scale = typeof density.Scale === "number" ? density.Scale : Number(DEFAULT_TINT_DENSITY.Scale);
  const octaves = typeof density.Octaves === "number" ? density.Octaves : Number(DEFAULT_TINT_DENSITY.Octaves);
  const persistence = typeof density.Persistence === "number"
    ? density.Persistence
    : Number(DEFAULT_TINT_DENSITY.Persistence);
  const lacunarity = typeof density.Lacunarity === "number"
    ? density.Lacunarity
    : Number(DEFAULT_TINT_DENSITY.Lacunarity);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] text-tn-text-muted leading-tight">
        SimplexNoise2D drives how tint bands blend across the biome surface.
      </p>
      <TextField
        label="Seed"
        value={seed}
        onChange={(v) => onChange({ ...density, Seed: v, Type: "SimplexNoise2D" })}
        onBlur={onBlur ?? (() => {})}
      />
      <SliderField
        label="Scale"
        value={scale}
        min={1}
        max={512}
        step={1}
        onChange={(v) => onChange({ ...density, Scale: v, Type: "SimplexNoise2D" })}
        onBlur={onBlur ?? (() => {})}
      />
      <SliderField
        label="Octaves"
        value={octaves}
        min={1}
        max={8}
        step={1}
        onChange={(v) => onChange({ ...density, Octaves: v, Type: "SimplexNoise2D" })}
        onBlur={onBlur ?? (() => {})}
      />
      <SliderField
        label="Persistence"
        value={persistence}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => onChange({ ...density, Persistence: v, Type: "SimplexNoise2D" })}
        onBlur={onBlur ?? (() => {})}
      />
      <SliderField
        label="Lacunarity"
        value={lacunarity}
        min={1}
        max={10}
        step={0.1}
        onChange={(v) => onChange({ ...density, Lacunarity: v, Type: "SimplexNoise2D" })}
        onBlur={onBlur ?? (() => {})}
      />
    </div>
  );
}
