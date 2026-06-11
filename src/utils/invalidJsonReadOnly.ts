import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import { useToastStore } from "@/stores/toastStore";

export const INVALID_JSON_SAVE_MESSAGE =
  "Cannot save: invalid JSON is open read-only. Fix the file and reopen it.";

export function isInvalidJsonReadOnlyActive(): boolean {
  const state = useEditorStore.getState();
  return state.editingContext === "InvalidJson" && state.invalidJsonFile !== null;
}

export function blockInvalidJsonWrite(): boolean {
  if (!isInvalidJsonReadOnlyActive()) return false;
  useProjectStore.getState().setLastError(INVALID_JSON_SAVE_MESSAGE);
  useToastStore.getState().addToast(INVALID_JSON_SAVE_MESSAGE, "warning");
  return true;
}
