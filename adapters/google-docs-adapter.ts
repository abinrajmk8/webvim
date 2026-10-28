import type {
  AdapterCapability,
  CursorMotion,
  EditorAdapter,
  WordMotion,
} from "../core/editor-adapter";
import { GOOGLE_DOCS_MOVE_MESSAGE } from "../core/google-docs-bridge";
import type { GoogleDocsMotion } from "../core/google-docs-bridge";
import type { EditorAdapterProvider } from "./registry";

export const DOCS_EVENT_FRAME_SELECTOR = "iframe.docs-texteventtarget-iframe";

const GOOGLE_DOCS_CAPABILITIES: ReadonlySet<AdapterCapability> = new Set([
  "horizontal-motion",
  "vertical-motion",
  "word-motion",
  "owns-escape",
  // Deliberately omit cursor-presentation: the event iframe is only an input
  // target. The adapter receives no live caret coordinates or style hook from
  // Docs, so an overlay could not stay reliably aligned with the rendered caret.
]);

export class GoogleDocsAdapter implements EditorAdapter {
  readonly id = "google-docs";
  readonly capabilities = GOOGLE_DOCS_CAPABILITIES;

  constructor(readonly root: HTMLElement) {}

  moveCursor(motion: CursorMotion): void {
    this.sendMotion(motion);
  }

  moveByWord(motion: WordMotion): void {
    this.sendMotion(motion);
  }

  dispose(): void {
    // Chrome debugger attachment is owned by the Docs session, not this adapter.
  }

  private sendMotion(motion: GoogleDocsMotion): void {
    try {
      void browser.runtime
        .sendMessage({ type: GOOGLE_DOCS_MOVE_MESSAGE, motion })
        .catch((error: unknown) => {
          console.warn("[webvim] could not send Google Docs movement", error);
        });
    } catch (error) {
      console.warn("[webvim] could not send Google Docs movement", error);
    }
  }
}

export function createGoogleDocsProvider(
  documentBody: HTMLElement,
): EditorAdapterProvider {
  return {
    id: "google-docs",

    findRoot(path): HTMLElement | null {
      for (const target of path) {
        const candidate = target as Node | null;
        // The target belongs to the event iframe's realm; avoid instanceof checks.
        if (
          candidate?.nodeType === 1 &&
          candidate.ownerDocument === documentBody.ownerDocument
        ) {
          return documentBody;
        }
      }
      return null;
    },

    create(root): GoogleDocsAdapter {
      return new GoogleDocsAdapter(root);
    },
  };
}
