import { useRef, type ReactNode } from "react";
import { CanvasLayoutPicker } from "./CanvasLayoutPicker";

/** Relative workspace shell with draggable floating layout picker. */
export function EditorWorkspace({
  children,
  className = "flex-1 min-h-0 relative",
}: {
  children: ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className={className}>
      {children}
      <CanvasLayoutPicker containerRef={containerRef} />
    </div>
  );
}
