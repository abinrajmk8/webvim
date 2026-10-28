export type CursorMotion = "down" | "up";

/**
 * Port between the Vim engine and a concrete editor implementation.
 * Add new capabilities here as the engine grows.
 */
export interface EditorAdapter {
  readonly id: string;
  moveCursor(motion: CursorMotion): void;
}
