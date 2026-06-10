/** Collapsed-by-default tips — one help surface per wizard dialog (AGENTS.md pattern). */
export function PackWizardHelpCard() {
  return (
    <details className="rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2 text-xs">
      <summary className="cursor-pointer select-none text-[11px] font-medium text-sky-100/95">
        Pack wizard tips
      </summary>
      <ul className="mt-2 space-y-1.5 text-[11px] text-tn-text-muted list-disc pl-4">
        <li>
          <strong className="font-medium text-tn-text">Simple</strong> matches Hytale&apos;s launcher;
          switch to <strong className="font-medium text-tn-text">Advanced</strong> for atmosphere import,
          starter props, and reference biomes.
        </li>
        <li>
          <strong className="font-medium text-tn-text">Advanced → Biome</strong> lets you pick a surface
          block and an optional starter prefab — use Quick pick or Browse (category, then search) with a
          live 3D preview (sync Hytale assets first).
        </li>
        <li>
          Simple mode lists every bundled starter under templates/ (Forest Hills, Eldritch Spirelands, and more).
          Simple Hills is a lightweight generated biome; bundled picks copy full Hytale-style graphs.
        </li>
        <li>
          Export uses Pack Group + Name from <code className="text-[10px]">manifest.json</code> when you
          are ready to ship.
        </li>
      </ul>
    </details>
  );
}
