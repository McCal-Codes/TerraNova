import { useState } from "react";
import { MaterialField } from "./MaterialField";
import {
  DEFAULT_MATERIAL_DELIMITER,
  readFieldFunctionMaterialSolid,
  summarizeMaterialNode,
  writeFieldFunctionMaterialSolid,
} from "@/utils/weightedAssignmentSummary";

interface MaterialFieldFunctionBandsFieldProps {
  materials?: unknown[];
  delimiterRanges?: Array<Record<string, unknown>>;
  delimiters?: Array<Record<string, unknown>>;
  onChangeMaterials?: (next: unknown[]) => void;
  onChangeDelimiterRanges?: (next: Array<Record<string, unknown>>) => void;
  onChangeDelimiters?: (next: Array<Record<string, unknown>>) => void;
  onBlur: () => void;
}

function readRange(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function MaterialFieldFunctionBandsField({
  materials,
  delimiterRanges,
  delimiters,
  onChangeMaterials,
  onChangeDelimiterRanges,
  onChangeDelimiters,
  onBlur,
}: MaterialFieldFunctionBandsFieldProps) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const useInternal = Array.isArray(materials) && Array.isArray(delimiterRanges);
  const bandCount = useInternal
    ? Math.max(materials.length, delimiterRanges.length)
    : (delimiters?.length ?? 0);

  const readBandMaterial = (index: number): unknown => {
    if (useInternal) return materials[index];
    return delimiters?.[index]?.Material;
  };

  const readBandFrom = (index: number): number => {
    if (useInternal) return readRange(delimiterRanges?.[index]?.From, index === 0 ? 0 : 0);
    return readRange(delimiters?.[index]?.From, 0);
  };

  const readBandTo = (index: number): number => {
    if (useInternal) return readRange(delimiterRanges?.[index]?.To, (index + 1) * 25);
    return readRange(delimiters?.[index]?.To, (index + 1) * 25);
  };

  const updateBand = (index: number, patch: { From?: number; To?: number; Material?: unknown }) => {
    if (useInternal && onChangeMaterials && onChangeDelimiterRanges) {
      if (patch.Material != null) {
        onChangeMaterials(materials.map((m, i) => (i === index ? patch.Material : m)));
      }
      if (patch.From != null || patch.To != null) {
        onChangeDelimiterRanges(
          delimiterRanges.map((r, i) => (
            i === index
              ? {
                ...r,
                ...(patch.From != null ? { From: patch.From } : {}),
                ...(patch.To != null ? { To: patch.To } : {}),
              }
              : r
          )),
        );
      }
      return;
    }

    if (!delimiters || !onChangeDelimiters) return;
    onChangeDelimiters(
      delimiters.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    );
  };

  const addBand = () => {
    const lastTo = bandCount > 0 ? readBandTo(bandCount - 1) : 0;
    if (useInternal && onChangeMaterials && onChangeDelimiterRanges) {
      onChangeMaterials([
        ...materials,
        structuredClone(DEFAULT_MATERIAL_DELIMITER.Material),
      ]);
      onChangeDelimiterRanges([
        ...delimiterRanges,
        { From: lastTo, To: lastTo + 25 },
      ]);
    } else if (delimiters && onChangeDelimiters) {
      onChangeDelimiters([
        ...delimiters,
        {
          From: lastTo,
          To: lastTo + 25,
          Material: structuredClone(DEFAULT_MATERIAL_DELIMITER.Material),
        },
      ]);
    }
    onBlur();
  };

  const removeBand = (index: number) => {
    if (bandCount <= 1) return;
    if (useInternal && onChangeMaterials && onChangeDelimiterRanges) {
      onChangeMaterials(materials.filter((_, i) => i !== index));
      onChangeDelimiterRanges(delimiterRanges.filter((_, i) => i !== index));
    } else if (delimiters && onChangeDelimiters) {
      onChangeDelimiters(delimiters.filter((_, i) => i !== index));
    }
    onBlur();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-tn-text-muted">
          Material bands
        </span>
        <button
          type="button"
          onClick={addBand}
          className="text-[10px] text-tn-accent hover:text-tn-accent/80"
        >
          + Add band
        </button>
      </div>

      <p className="text-[10px] text-tn-text-muted leading-snug">
        Each band maps a field range (From inclusive, To exclusive) to a material when the noise
        value falls in that range.
      </p>

      {bandCount === 0 && (
        <p className="text-[11px] text-tn-text-muted">No bands — add a material band.</p>
      )}

      {Array.from({ length: bandCount }, (_, index) => {
        const material = readBandMaterial(index);
        const from = readBandFrom(index);
        const to = readBandTo(index);
        const solid = readFieldFunctionMaterialSolid(material);
        const summary = summarizeMaterialNode(material);
        const isOpen = expanded[index] ?? bandCount === 1;

        return (
          <div
            key={index}
            className="rounded border border-tn-border bg-tn-bg/40 overflow-hidden"
          >
            <div className="flex items-start gap-2 p-2">
              <button
                type="button"
                onClick={() => setExpanded((prev) => ({ ...prev, [index]: !prev[index] }))}
                className="text-[10px] text-tn-text-muted mt-1 shrink-0 w-3"
                aria-expanded={isOpen}
              >
                {isOpen ? "▾" : "▸"}
              </button>

              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-medium text-tn-text">Band {index + 1}</span>
                  <div className="flex items-center gap-1">
                    <label className="text-[10px] text-tn-text-muted">From</label>
                    <input
                      type="number"
                      step="any"
                      value={from}
                      onChange={(e) => updateBand(index, { From: parseFloat(e.target.value) })}
                      onBlur={onBlur}
                      className="w-16 px-1.5 py-0.5 text-xs bg-tn-bg border border-tn-border rounded text-right font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-[10px] text-tn-text-muted">To</label>
                    <input
                      type="number"
                      step="any"
                      value={to}
                      onChange={(e) => updateBand(index, { To: parseFloat(e.target.value) })}
                      onBlur={onBlur}
                      className="w-16 px-1.5 py-0.5 text-xs bg-tn-bg border border-tn-border rounded text-right font-mono"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-tn-text-muted truncate" title={summary}>
                  {summary}
                </p>
              </div>

              {bandCount > 1 && (
                <button
                  type="button"
                  onClick={() => removeBand(index)}
                  className="text-[10px] text-red-400 hover:text-red-300 shrink-0"
                >
                  Remove
                </button>
              )}
            </div>

            {isOpen && (
              <div className="border-t border-tn-border px-2 pb-2 pt-1.5 ml-5">
                <MaterialField
                  label="Block"
                  value={solid}
                  onChange={(nextSolid) => {
                    updateBand(index, {
                      Material: writeFieldFunctionMaterialSolid(material, nextSolid),
                    });
                  }}
                  onBlur={onBlur}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
