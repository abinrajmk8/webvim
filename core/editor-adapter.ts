import type { VimMode } from "./modes";

export type CursorMotion = "left" | "down" | "up" | "right";
export type WordMotion = "forward" | "backward";
export type AdapterCapability =
  | "horizontal-motion"
  | "vertical-motion"
  | "word-motion"
  | "line-operations"
  | "cursor-presentation"
  | "owns-escape";

export interface EditorAdapter {
  readonly id: string;
  /** The editable root used for focus tracking and adapter cleanup. */
  readonly root: HTMLElement;
  readonly capabilities: ReadonlySet<AdapterCapability>;

  moveCursor(motion: CursorMotion): void;
  moveByWord?(motion: WordMotion): void;
  deleteCurrentLine?(): string | null;
  yankCurrentLine?(): string | null | Promise<string | null>;
  setMode?(mode: VimMode): void;
  dispose(): void;
}
