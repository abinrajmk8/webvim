export interface KeyStroke {
  readonly key: string;
  readonly ctrl: boolean;
  readonly alt: boolean;
  readonly meta: boolean;
  readonly shift: boolean;
}

const TEXT_MUTATING_NAMED_KEYS: ReadonlySet<string> = new Set([
  "Enter",
  "Backspace",
  "Delete",
  "Tab",
]);

/** True when no Ctrl/Alt/Meta is held, i.e. the key can match a plain Vim binding. */
export function isUnmodified(stroke: KeyStroke): boolean {
  return !stroke.ctrl && !stroke.alt && !stroke.meta;
}

/**
 * True for keys that would insert or delete text. Normal mode swallows these
 * when unbound. Ctrl/Meta chords (copy, paste, Ctrl+Enter, ...) are never
 * treated as text input. Ctrl+Alt is treated as AltGr, which types characters.
 */
export function isTextMutatingKey(stroke: KeyStroke): boolean {
  const isShortcutChord = stroke.meta || (stroke.ctrl && !stroke.alt);
  if (isShortcutChord) return false;
  const isPrintable = [...stroke.key].length === 1;
  return isPrintable || TEXT_MUTATING_NAMED_KEYS.has(stroke.key);
}
