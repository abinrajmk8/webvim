import type { CursorMotion, WordMotion } from "./editor-adapter";

export const CURSOR_MOTIONS: Readonly<Record<string, CursorMotion>> = {
  h: "left",
  j: "down",
  k: "up",
  l: "right",
};

export const WORD_MOTIONS: Readonly<Record<string, WordMotion>> = {
  w: "forward",
  b: "backward",
};
