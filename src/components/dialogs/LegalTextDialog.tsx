import { ModalShell } from "@/components/ui/ModalShell";

interface LegalTextDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  body: string;
}

export function LegalTextDialog({ open, onClose, title, body }: LegalTextDialogProps) {
  return (
    <ModalShell open={open} onClose={onClose} title={title} widthClass="w-[720px] max-w-[95vw]">
      <pre className="max-h-[min(70vh,560px)] overflow-auto whitespace-pre-wrap break-words rounded border border-tn-border bg-tn-bg px-4 py-3 text-xs leading-relaxed text-tn-text font-mono">
        {body}
      </pre>
    </ModalShell>
  );
}
