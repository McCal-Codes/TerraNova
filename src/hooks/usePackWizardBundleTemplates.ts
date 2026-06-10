import { useEffect, useState } from "react";
import {
  listPackWizardBundleTemplates,
  type PackWizardBundleTemplate,
} from "@/utils/ipc";
import {
  BASIC_BIOME_TEMPLATE,
  REFERENCE_BIOME_TEMPLATES,
  bundleToWizardOption,
  type PackWizardTemplateOption,
} from "@/data/packWizardTemplates";
import { isTauriRuntime } from "@/utils/platform";

const FALLBACK_BUNDLES: PackWizardBundleTemplate[] = [
  {
    id: "void",
    displayName: "Void",
    description: "Flat void platform — minimal terrain for testing.",
    biomeRelativePath: "Biomes/VoidBiome.json",
    hasWorldStructure: true,
  },
  {
    id: "forest-hills",
    displayName: "Forest Hills",
    description: "Rolling hills with material bands, caves, and optional starter props.",
    biomeRelativePath: "Biomes/ForestHillsBiome.json",
    hasWorldStructure: true,
  },
  {
    id: "eldritch-spirelands",
    displayName: "Eldritch Spirelands",
    description: "Alien spire terrain with Voronoi ridges and monument props.",
    biomeRelativePath: "Biomes/EldritchSpirelandsBiome.json",
    hasWorldStructure: true,
  },
  {
    id: "shattered-archipelago",
    displayName: "Shattered Archipelago",
    description: "Island archipelago with sea caves and scattered prop placements.",
    biomeRelativePath: "Biomes/ShatteredArchipelagoBiome.json",
    hasWorldStructure: true,
  },
  {
    id: "tropical-pirate-islands",
    displayName: "Tropical Pirate Islands",
    description: "Large Hytale-style tropical export — complex graphs; best for study or remix.",
    biomeRelativePath: "Biomes/TropicalPirateIslandsBiome.json",
    hasWorldStructure: true,
  },
];

export function usePackWizardBundleTemplates(): {
  biomeTemplates: PackWizardTemplateOption[];
  advancedBiomeTemplates: PackWizardTemplateOption[];
  worldStructureTemplates: PackWizardTemplateOption[];
  loading: boolean;
  error: string | null;
} {
  const [bundles, setBundles] = useState<PackWizardBundleTemplate[]>(FALLBACK_BUNDLES);
  const [loading, setLoading] = useState(isTauriRuntime());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauriRuntime()) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    void listPackWizardBundleTemplates()
      .then((list) => {
        if (!active) return;
        if (list.length > 0) setBundles(list);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const bundleOptions = bundles.map(bundleToWizardOption);
  const biomeTemplates = [BASIC_BIOME_TEMPLATE, ...bundleOptions];
  const worldStructureTemplates = [
    BASIC_BIOME_TEMPLATE,
    ...bundleOptions.filter((t) => t.templateFolder),
  ];

  const advancedBiomeTemplates = [...biomeTemplates, ...REFERENCE_BIOME_TEMPLATES];

  return { biomeTemplates, advancedBiomeTemplates, worldStructureTemplates, loading, error };
}
