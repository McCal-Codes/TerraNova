import { useEffect, useMemo, useState } from "react";
import { readAssetFile } from "@/utils/ipc";
import { asRecord, type JsonRecord } from "@/utils/atmosphere";

const weatherDocCache = new Map<string, JsonRecord>();

export function clearWeatherDocCache(): void {
  weatherDocCache.clear();
}

export function useWeatherDocCache(
  weatherPathIndex: Record<string, string>,
  weatherIds: string[],
  lookupRevision: number,
): Record<string, JsonRecord | null> {
  const [docs, setDocs] = useState<Record<string, JsonRecord | null>>({});

  const idsKey = useMemo(
    () => [...new Set(weatherIds.map((id) => id.toLowerCase()).filter(Boolean))].sort().join("|"),
    [weatherIds],
  );

  useEffect(() => {
    let active = true;
    const uniqueIds = [...new Set(weatherIds.map((id) => id.trim()).filter(Boolean))];

    void (async () => {
      const next: Record<string, JsonRecord | null> = {};
      for (const weatherId of uniqueIds) {
        const key = weatherId.toLowerCase();
        const path = weatherPathIndex[key];
        if (!path) {
          next[key] = null;
          continue;
        }
        if (weatherDocCache.has(path)) {
          next[key] = weatherDocCache.get(path) ?? null;
          continue;
        }
        try {
          const raw = await readAssetFile(path);
          const doc = asRecord(raw);
          if (doc) weatherDocCache.set(path, doc);
          next[key] = doc;
        } catch {
          next[key] = null;
        }
      }
      if (active) setDocs(next);
    })();

    return () => {
      active = false;
    };
  }, [idsKey, lookupRevision, weatherIds, weatherPathIndex]);

  return docs;
}
