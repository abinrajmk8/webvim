import type { EditorAdapter } from "./editor-adapter";
import type { ModeManager } from "./modes";

export interface CommandContext {
  readonly editor: EditorAdapter;
  readonly modes: ModeManager;
}

export interface Binding {
  readonly execute: (context: CommandContext) => void;
  /** When false, the key event still reaches the editor/page after execution. */
  readonly consume: boolean;
}
