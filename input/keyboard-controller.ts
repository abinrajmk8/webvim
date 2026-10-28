import type { EditorAdapterRegistry } from "../adapters/registry";
import type { KeyStroke } from "../core/keys";
import type { VimEngine } from "../core/vim-engine";

function toKeyStroke(event: KeyboardEvent): KeyStroke {
  return {
    key: event.key,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    meta: event.metaKey,
    shift: event.shiftKey,
  };
}

export class KeyboardController {
  private readonly engine: VimEngine;
  private readonly registry: EditorAdapterRegistry;
  private readonly target: Window;

  constructor(
    engine: VimEngine,
    registry: EditorAdapterRegistry,
    target: Window = window,
  ) {
    this.engine = engine;
    this.registry = registry;
    this.target = target;
  }

  start(): void {
    // Capture phase on window: runs before the editor's own listeners.
    this.target.addEventListener("keydown", this.onKeyDown, true);
  }

  stop(): void {
    this.target.removeEventListener("keydown", this.onKeyDown, true);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    // Ignore synthetic events (including our own fallback) and IME composition.
    if (!event.isTrusted || event.isComposing || event.keyCode === 229) return;

    try {
      const editor = this.registry.resolve(event.target);
      if (!editor) return;

      const result = this.engine.handleKey(toKeyStroke(event), editor);
      if (result.consume) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    } catch (error) {
      // Never break the host page; fall back to native behavior.
      console.error("[webvim] key handling failed", error);
    }
  };
}
