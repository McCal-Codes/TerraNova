import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const docsModules = import.meta.glob("../../docs/**/*.md", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

export const HOME_LEARN_SLUGS = [
  { slug: "walkthroughs/quickstart", label: "Build your first pack" },
  { slug: "walkthroughs/create-a-world", label: "Create a world" },
  { slug: "walkthroughs/terrain-and-caves", label: "Terrain and caves" },
  { slug: "getting-started", label: "Getting started index" },
] as const;

export type HomeLearnSlug = (typeof HOME_LEARN_SLUGS)[number]["slug"];

function moduleKeyForSlug(slug: string): string | null {
  const normalized = slug.endsWith(".md") ? slug : `${slug}.md`;
  const key = `../../docs/${normalized}`;
  return key in docsModules ? key : null;
}

interface HomeLearnDialogProps {
  open: boolean;
  onClose: () => void;
  initialSlug?: HomeLearnSlug;
}

export function HomeLearnDialog({
  open,
  onClose,
  initialSlug = "walkthroughs/quickstart",
}: HomeLearnDialogProps) {
  const [slug, setSlug] = useState<HomeLearnSlug>(initialSlug);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setSlug(initialSlug);
  }, [open, initialSlug]);

  const loadDoc = useCallback(async (docSlug: string) => {
    const key = moduleKeyForSlug(docSlug);
    if (!key) {
      setError(`Document not found: ${docSlug}`);
      setContent("");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const text = await docsModules[key]!();
      setContent(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setContent("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadDoc(slug);
  }, [open, slug, loadDoc]);

  const title = useMemo(
    () => HOME_LEARN_SLUGS.find((e) => e.slug === slug)?.label ?? "Learn",
    [slug],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-learn-title"
        className="w-full max-w-3xl max-h-[85vh] rounded-lg border border-tn-border bg-tn-panel shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-3 border-b border-tn-border shrink-0 flex items-center justify-between gap-3">
          <h2 id="home-learn-title" className="text-base font-semibold text-tn-text">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-tn-text-muted hover:text-tn-text px-2 py-1"
          >
            Close
          </button>
        </header>

        <div className="flex flex-1 min-h-0">
          <nav className="w-44 shrink-0 border-r border-tn-border p-2 space-y-0.5 overflow-y-auto">
            {HOME_LEARN_SLUGS.map((entry) => (
              <button
                key={entry.slug}
                type="button"
                onClick={() => setSlug(entry.slug)}
                className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors ${
                  slug === entry.slug
                    ? "bg-tn-accent/15 text-tn-accent"
                    : "text-tn-text-muted hover:bg-tn-surface hover:text-tn-text"
                }`}
              >
                {entry.label}
              </button>
            ))}
          </nav>

          <div className="flex-1 min-w-0 overflow-y-auto px-5 py-4 prose prose-invert prose-sm max-w-none text-tn-text">
            {loading && <p className="text-sm text-tn-text-muted">Loading…</p>}
            {error && <p className="text-sm text-amber-400/90">{error}</p>}
            {!loading && !error && content && (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
