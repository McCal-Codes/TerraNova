import type { ReactNode } from "react";

export function BiomeMapperSectionCard({
  title,
  accent = false,
  description,
  headerRight,
  children,
  className = "",
}: {
  title: string;
  accent?: boolean;
  description?: string;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`min-w-0 rounded-lg border p-3 ${
        accent ? "border-tn-accent/30 bg-tn-accent/5" : "border-tn-border bg-tn-bg"
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`text-[10px] font-medium uppercase tracking-wider ${
            accent ? "text-tn-accent" : "text-tn-text-muted"
          }`}
        >
          {title}
        </span>
        {headerRight}
      </div>
      {description && (
        <p className="mt-1 text-[10px] leading-relaxed text-tn-text-muted">{description}</p>
      )}
      <div className="mt-2 min-w-0">{children}</div>
    </div>
  );
}
