import type { Binding } from "./commands";
import type { VimMode } from "./modes";

const moveDown: Binding = {
  execute: ({ editor }) => editor.moveCursor("down"),
  consume: true,
};

const moveUp: Binding = {
  execute: ({ editor }) => editor.moveCursor("up"),
  consume: true,
};

const enterInsert: Binding = {
  execute: ({ modes }) => modes.set("insert"),
  consume: true,
};

// Not consumed, so the editor can still close widgets (e.g. suggestions) on Esc.
const enterNormal: Binding = {
  execute: ({ modes }) => modes.set("normal"),
  consume: false,
};

export const KEYMAPS: Readonly<Record<VimMode, ReadonlyMap<string, Binding>>> =
  {
    normal: new Map<string, Binding>([
      ["j", moveDown],
      ["k", moveUp],
      ["i", enterInsert],
    ]),
    insert: new Map<string, Binding>([["Escape", enterNormal]]),
  };
