import type { EditorAdapter } from "./editor-adapter";
import { CommandParser } from "./commands";
import { isTextMutatingKey, isUnmodified } from "./keys";
import type { KeyStroke } from "./keys";
import { CURSOR_MOTIONS, WORD_MOTIONS } from "./keymaps";
import type { ModeManager } from "./modes";

export interface KeyResult {
  /** True when the host should preventDefault and stop propagation. */
  readonly consume: boolean;
}

const PASS_THROUGH: KeyResult = { consume: false };
const CONSUMED: KeyResult = { consume: true };

export class VimEngine {
  private readonly modes: ModeManager;
  private readonly commands = new CommandParser();
  private registerValue = "";
  private readonly unsubscribe: () => void;

  constructor(modes: ModeManager) {
    this.modes = modes;
    this.unsubscribe = modes.subscribe(() => {
      this.commands.reset();
    });
  }

  get mode(): ModeManager["mode"] {
    return this.modes.mode;
  }

  get register(): string {
    return this.registerValue;
  }

  handleKey(stroke: KeyStroke, editor: EditorAdapter | null): KeyResult {
    if (!editor) return PASS_THROUGH;

    const mode = this.modes.mode;

    if (stroke.key === "Escape") {
      this.commands.reset();
      if (mode !== "normal") {
        this.modes.set("normal");
        this.applyMode(editor, "normal");
      }
      // Keep Escape available to close host editor widgets.
      return PASS_THROUGH;
    }

    if (mode === "insert") return PASS_THROUGH;
    if (!isUnmodified(stroke)) {
      this.commands.reset();
      return PASS_THROUGH;
    }

    const command = this.commands.feed(stroke.key);
    if (command.status === "pending") return CONSUMED;
    if (command.status === "command") {
      this.runLineOperator(command.operator, editor);
      return CONSUMED;
    }

    if (stroke.key === "i") {
      this.modes.set("insert");
      this.applyMode(editor, "insert");
      return CONSUMED;
    }

    const cursorMotion = CURSOR_MOTIONS[stroke.key];
    if (cursorMotion) {
      const capability =
        cursorMotion === "left" || cursorMotion === "right"
          ? "horizontal-motion"
          : "vertical-motion";
      if (editor.capabilities.has(capability)) editor.moveCursor(cursorMotion);
      return CONSUMED;
    }

    const wordMotion = WORD_MOTIONS[stroke.key];
    if (wordMotion) {
      if (
        editor.capabilities.has("word-motion") &&
        editor.moveByWord
      ) {
        editor.moveByWord(wordMotion);
      }
      return CONSUMED;
    }

    // Normal mode must never insert text.
    if (mode === "normal" && isTextMutatingKey(stroke)) {
      return CONSUMED;
    }

    return PASS_THROUGH;
  }

  dispose(): void {
    this.commands.reset();
    this.unsubscribe();
  }

  private runLineOperator(operator: "delete" | "yank", editor: EditorAdapter): void {
    if (!editor.capabilities.has("line-operations")) return;

    if (operator === "delete") {
      editor.deleteCurrentLine?.();
      return;
    }

    const line = editor.yankCurrentLine?.();
    if (line === null || line === undefined) return;
    void Promise.resolve(line)
      .then((value) => {
        if (value !== null) this.registerValue = value;
      })
      .catch((error: unknown) => {
        console.error("[webvim] could not yank line", error);
      });
  }

  private applyMode(editor: EditorAdapter, mode: "normal" | "insert"): void {
    if (editor.capabilities.has("cursor-presentation")) {
      editor.setMode?.(mode);
    }
  }
}
