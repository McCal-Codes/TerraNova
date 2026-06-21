import { useEffect, useMemo, useState } from "react";
import type { Node, Edge } from "@xyflow/react";
import type { BiomeRangeEntry } from "@/stores/slices/types";
import {
  buildBiomeSelectorMap,
  biomeSelectorMapToImageData,
  type BiomeSelectorMapResult,
} from "@/utils/biomeSelectorPreview";

export function useBiomeSelectorPreview(options: {
  nodes: Node[];
  edges: Edge[];
  ranges: BiomeRangeEntry[];
  defaultBiome: string;
  resolution: number;
  enabled: boolean;
  debounceMs?: number;
}): {
  map: BiomeSelectorMapResult | null;
  imageData: ImageData | null;
  loading: boolean;
} {
  const { nodes, edges, ranges, defaultBiome, resolution, enabled, debounceMs = 200 } = options;
  const [map, setMap] = useState<BiomeSelectorMapResult | null>(null);
  const [loading, setLoading] = useState(false);

  const fingerprint = useMemo(
    () =>
      JSON.stringify({
        n: nodes.length,
        e: edges.length,
        r: ranges,
        d: defaultBiome,
        res: resolution,
      }),
    [nodes, edges, ranges, defaultBiome, resolution],
  );

  useEffect(() => {
    if (!enabled || nodes.length === 0) {
      setMap(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      try {
        const next = buildBiomeSelectorMap(nodes, edges, ranges, {
          resolution,
          defaultBiome,
        });
        setMap(next);
      } catch {
        setMap(null);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [fingerprint, enabled, nodes, edges, ranges, defaultBiome, resolution, debounceMs]);

  const imageData = useMemo(() => {
    if (!map) return null;
    return biomeSelectorMapToImageData(map, ranges, defaultBiome);
  }, [map, ranges, defaultBiome]);

  return { map, imageData, loading };
}
