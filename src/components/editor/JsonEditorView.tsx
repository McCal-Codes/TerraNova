import { useEffect, useRef } from "react";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import { linter } from "@codemirror/lint";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import { safeJsonParse } from "@/utils/safeLocalStorage";

interface JsonEditorViewProps {
  /** Optional override content. When omitted, reads from rawJsonContent in editor store. */
  content?: Record<string, unknown> | null;
  /** Optional raw text. Used for invalid JSON so the original bytes are not reserialized. */
  rawText?: string | null;
  /** Prevent editing and dirty-state writes. */
  readOnly?: boolean;
  /** Called when the user modifies the text. Receives the raw string. */
  onChange?: (text: string) => void;
}

export function JsonEditorView({ content, rawText, readOnly = false, onChange }: JsonEditorViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const rawJsonContent = useEditorStore((s) => s.rawJsonContent);

  const jsonObj = content ?? rawJsonContent;

  // Serialize once for comparison
  const jsonText = rawText ?? (jsonObj ? JSON.stringify(jsonObj, null, 2) : "");
  const hasContent = rawText !== undefined && rawText !== null ? true : Boolean(jsonObj);

  // Track what the editor was initialized with
  const lastExternalText = useRef(jsonText);
  const lastReadOnly = useRef(readOnly);

  const setRawJsonContent = useEditorStore((s) => s.setRawJsonContent);

  // Track onChange in a ref so we don't recreate the editor when it changes
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleChangeRef = useRef((text: string) => {
    if (onChangeRef.current) {
      onChangeRef.current(text);
      return;
    }
    // When used as primary editor (RawJson context), parse and update store
    const parsed = safeJsonParse<Record<string, unknown> | null>(text, null);
    if (parsed) {
      setRawJsonContent(parsed);
      lastExternalText.current = JSON.stringify(parsed, null, 2);
    } else {
      // Don't update store with invalid JSON — CodeMirror's linter shows the error
    }
  });

  useEffect(() => {
    if (!hasContent) return;

    // Only recreate if the external content actually changed
    if (lastExternalText.current === jsonText && lastReadOnly.current === readOnly && viewRef.current) return;
    lastExternalText.current = jsonText;
    lastReadOnly.current = readOnly;

    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: jsonText,
      extensions: [
        basicSetup,
        json(),
        linter(jsonParseLinter()),
        oneDark,
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            if (readOnly) return;
            useProjectStore.getState().setDirty(true);
            handleChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          "&": { height: "100%", fontSize: "13px" },
          ".cm-scroller": { overflow: "auto" },
        }),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [jsonText, hasContent, readOnly]);

  if (!hasContent) {
    return (
      <div className="flex items-center justify-center h-full text-tn-text-muted text-sm">
        No content to display.
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden bg-tn-bg" ref={containerRef} />
  );
}
