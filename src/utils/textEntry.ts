/**
 * Whether keyboard focus is somewhere the user is typing.
 *
 * Undo means two different things depending on this: inside a text field it is
 * the browser's text undo, everywhere else it is the graph's. The keyboard
 * shortcut and the Edit menu must agree, so both ask here rather than each
 * carrying their own copy of the check.
 */
export function isTextEntryFocused(target: EventTarget | null = document.activeElement): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable === true;
}
