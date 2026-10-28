import type { CursorMotion, EditorAdapter } from "../core/editor-adapter";
import type { EditorAdapterProvider } from "./registry";

/** The minimal slice of Monaco's API this adapter depends on. */
interface MonacoEditorLike {
  getContainerDomNode(): HTMLElement;
  trigger(source: string, handlerId: string, payload: unknown): void;
}

interface MonacoGlobalLike {
  editor?: {
    getEditors?: () => MonacoEditorLike[];
  };
}

/**
 * Monaco's keyboard input element: a textarea (classic) or the
 * native edit context element (newer Chromium builds of Monaco).
 */
const INPUT_SELECTOR = "textarea.inputarea, .native-edit-context";

const COMMAND_IDS: Readonly<Record<CursorMotion, string>> = {
  down: "cursorDown",
  up: "cursorUp",
};

const FALLBACK_KEYS: Readonly<
  Record<CursorMotion, { key: string; keyCode: number }>
> = {
  down: { key: "ArrowDown", keyCode: 40 },
  up: { key: "ArrowUp", keyCode: 38 },
};

function getMonacoEditors(): MonacoEditorLike[] {
  const monaco = (window as unknown as { monaco?: MonacoGlobalLike }).monaco;
  return monaco?.editor?.getEditors?.() ?? [];
}

class MonacoEditorAdapter implements EditorAdapter {
  readonly id = "monaco";
  private readonly input: Element;
  private readonly editor: MonacoEditorLike | null;

  constructor(input: Element, editor: MonacoEditorLike | null) {
    this.input = input;
    this.editor = editor;
  }

  moveCursor(motion: CursorMotion): void {
    if (this.editor) {
      // Native Monaco command: keeps sticky column, folding, wrapping, highlighting.
      this.editor.trigger("webvim", COMMAND_IDS[motion], {});
      return;
    }
    this.dispatchArrowKey(motion);
  }

  /** Fallback when `window.monaco` is not exposed by the page. */
  private dispatchArrowKey(motion: CursorMotion): void {
    const { key, keyCode } = FALLBACK_KEYS[motion];
    const init = {
      key,
      code: key,
      keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true,
      composed: true,
    };
    this.input.dispatchEvent(new KeyboardEvent("keydown", init));
  }
}

export interface MonacoProviderOptions {
  /** Hostnames (and their subdomains) where this provider is active. */
  readonly hosts: readonly string[];
}

export function createMonacoProvider(
  options: MonacoProviderOptions,
): EditorAdapterProvider {
  return {
    id: "monaco",

    supportsPage(url: URL): boolean {
      return options.hosts.some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
      );
    },

    resolve(target: EventTarget | null): EditorAdapter | null {
      if (!(target instanceof Element)) return null;
      if (!target.matches(INPUT_SELECTOR)) return null;

      const editor =
        getMonacoEditors().find((candidate) =>
          candidate.getContainerDomNode().contains(target),
        ) ?? null;

      return new MonacoEditorAdapter(target, editor);
    },
  };
}
