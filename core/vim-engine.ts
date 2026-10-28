import type { EditorAdapter } from "./editor-adapter";
import { isTextMutatingKey, isUnmodified } from "./keys";
import type { KeyStroke } from "./keys";
import { KEYMAPS } from "./keymaps";
import type { ModeManager } from "./modes";

export interface KeyResult {
  /** True when the host should preventDefault and stop propagation. */
  readonly consume: boolean;
}

const PASS_THROUGH: KeyResult = { consume: false };
const CONSUMED: KeyResult = { consume: true };

export class VimEngine {
  private readonly modes: ModeManager;

  constructor(modes: ModeManager) {
    this.modes = modes;
  }

  handleKey(stroke: KeyStroke, editor: EditorAdapter): KeyResult {
    const mode = this.modes.mode;

    if (isUnmodified(stroke) || stroke.key === "Escape") {
      const binding = KEYMAPS[mode].get(stroke.key);
      if (binding) {
        binding.execute({ editor, modes: this.modes });
        return binding.consume ? CONSUMED : PASS_THROUGH;
      }
    }

    // Normal mode must never insert text.
    if (mode === "normal" && isTextMutatingKey(stroke)) {
      return CONSUMED;
    }

    return PASS_THROUGH;
  }
}
