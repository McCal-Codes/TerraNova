import { appNestedCardClass } from "@/components/ui/surfaceStyles";
import type { ReleaseSection } from "@/utils/fetchReleases";

interface ReleaseNotesListProps {
  sections: ReleaseSection[];
  /** When false, always show section headings even for a single section. */
  hideSingleSectionTitle?: boolean;
}

export function ReleaseNotesList({
  sections,
  hideSingleSectionTitle = false,
}: ReleaseNotesListProps) {
  const showSectionTitles = !hideSingleSectionTitle || sections.length > 1;

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <section key={section.title}>
          {showSectionTitles && (
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-tn-text-muted mb-2">
              {section.title}
            </h3>
          )}
          <ul className="space-y-2">
            {section.items.map((item, i) => (
              <li
                key={`${section.title}-${i}`}
                className={`${appNestedCardClass} px-3 py-2.5`}
              >
                <p className="text-sm font-medium text-tn-text leading-snug">{item.label}</p>
                {item.description && (
                  <p className="text-xs text-tn-text-muted leading-relaxed mt-1">
                    {item.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
