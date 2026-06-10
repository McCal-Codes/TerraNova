/** Shared preview guidance banner (slice uniform / CurveMapper target hints). */
export function PreviewSliceHintBanner({
  children,
  variant = "default",
  className = "",
}: {
  children: string;
  variant?: "default" | "topo";
  className?: string;
}) {
  const base =
    variant === "topo"
      ? "rounded-md border border-[#7a9eb8]/40 bg-[#faf6eb]/97 px-3 py-1.5 text-[10px] leading-snug text-[#4a3728] shadow-sm"
      : "rounded-md border border-sky-500/25 bg-sky-950/35 px-2.5 py-1.5 text-[10px] leading-snug text-sky-100/90 shadow-md backdrop-blur-sm";

  return (
    <div className={`${base} ${className}`.trim()} role="status">
      {children}
    </div>
  );
}
