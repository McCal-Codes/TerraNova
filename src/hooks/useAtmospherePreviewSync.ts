import { useEffect, useRef } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { usePreviewStore } from "@/stores/previewStore";
import { useUIStore } from "@/stores/uiStore";
import {
  resolveEnvironmentAtmosphere,
  resolveWeatherAtmosphere,
  type JsonRecord,
} from "@/utils/atmosphere";

interface UseAtmospherePreviewSyncInput {
  editingContext: "Weather" | "Environment";
  rawJsonContent: JsonRecord | null;
  serverRoot: string | null;
  environmentName: string | null;
  previewHour: number;
}

export function useAtmospherePreviewSync({
  editingContext,
  rawJsonContent,
  serverRoot,
  environmentName,
  previewHour,
}: UseAtmospherePreviewSyncInput): void {
  const syncEnabled = useUIStore((state) => state.syncAtmospherePreview);
  const biomeEditing = useEditorStore((state) => state.editingContext === "Biome");
  const setAtmosphereSettings = usePreviewStore((state) => state.setAtmosphereSettings);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!syncEnabled || !rawJsonContent) return;
    if (biomeEditing) return;

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      void (async () => {
        if (editingContext === "Weather") {
          const settings = await resolveWeatherAtmosphere(rawJsonContent, previewHour);
          setAtmosphereSettings(settings);
          return;
        }

        if (editingContext === "Environment" && serverRoot && environmentName) {
          const result = await resolveEnvironmentAtmosphere({
            environmentName,
            serverRoot,
            hour: previewHour,
            localEnvironmentDoc: rawJsonContent,
          });
          setAtmosphereSettings(result.settings);
        }
      })();
    }, 150);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [
    biomeEditing,
    editingContext,
    environmentName,
    previewHour,
    rawJsonContent,
    serverRoot,
    setAtmosphereSettings,
    syncEnabled,
  ]);
}
