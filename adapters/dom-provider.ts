import {
  ContentEditableAdapter,
  TextControlAdapter,
  contentEditableRoot,
  inputTypeIsSupported,
} from "./dom-text-adapter";
import type { EditorAdapterProvider } from "./registry";

const EDITOR_OWNED_INPUT =
  ".inputarea, .native-edit-context, .ace_text-input, .CodeMirror textarea, .CodeMirror-code";

export function createTextControlProvider(): EditorAdapterProvider {
  return {
    id: "html-text-control",

    findRoot(path): HTMLElement | null {
      for (const target of path) {
        if (!(target instanceof HTMLElement)) continue;
        if (target.closest(EDITOR_OWNED_INPUT)) continue;

        if (target instanceof HTMLTextAreaElement) {
          if (!target.disabled && !target.readOnly && isVisible(target)) {
            return target;
          }
        } else if (
          target instanceof HTMLInputElement &&
          inputTypeIsSupported(target) &&
          !target.disabled &&
          !target.readOnly &&
          isVisible(target)
        ) {
          return target;
        }
      }
      return null;
    },

    create(root): TextControlAdapter {
      return new TextControlAdapter(
        root as HTMLInputElement | HTMLTextAreaElement,
      );
    },
  };
}

export function createContentEditableProvider(): EditorAdapterProvider {
  return {
    id: "contenteditable",

    findRoot(path): HTMLElement | null {
      for (const target of path) {
        if (!(target instanceof HTMLElement)) continue;
        if (target.closest(EDITOR_OWNED_INPUT)) continue;
        if (target.closest(".cm-editor")) continue;
        const root = contentEditableRoot(target);
        if (root && isVisible(root)) return root;
      }
      return null;
    },

    create(root): ContentEditableAdapter {
      return new ContentEditableAdapter(root);
    },
  };
}

function isVisible(element: HTMLElement): boolean {
  return element.getClientRects().length > 0;
}
