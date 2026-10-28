import {
  EDITOR_BRIDGE_RESPONSE_EVENT,
  sendEditorBridgeRequest,
  type EditorBridgeRequest,
} from "../core/bridge-events";
import type {
  AdapterCapability,
  CursorMotion,
  EditorAdapter,
  WordMotion,
} from "../core/editor-adapter";
import type { VimMode } from "../core/modes";

const ADAPTER_CAPABILITIES: Readonly<
  Record<string, readonly AdapterCapability[]>
> = {
  monaco: [
    "horizontal-motion",
    "vertical-motion",
    "word-motion",
    "line-operations",
    "cursor-presentation",
  ],
  ace: [
    "horizontal-motion",
    "vertical-motion",
    "word-motion",
    "line-operations",
    "cursor-presentation",
  ],
  codemirror6: [
    "horizontal-motion",
    "vertical-motion",
    "word-motion",
    "line-operations",
  ],
};

export class PageApiAdapter implements EditorAdapter {
  readonly id: string;
  readonly root: HTMLElement;
  readonly capabilities: ReadonlySet<AdapterCapability>;

  constructor(id: string, root: HTMLElement) {
    this.id = id;
    this.root = root;

    const isAvailable = this.request("probe");
    this.capabilities = new Set(
      isAvailable ? (ADAPTER_CAPABILITIES[id] ?? []) : [],
    );
  }

  get supported(): boolean {
    return this.capabilities.size > 0;
  }

  moveCursor(motion: CursorMotion): void {
    this.request("move", motion);
  }

  moveByWord(motion: WordMotion): void {
    this.request("word", motion);
  }

  deleteCurrentLine(): string | null {
    this.request("delete-line");
    return null;
  }

  yankCurrentLine(): Promise<string | null> {
    const requestId = `${Date.now()}-${Math.random()}`;

    return new Promise((resolve) => {
      const onResponse = (event: Event): void => {
        const raw = (event as CustomEvent<string>).detail;
        if (typeof raw !== "string") return;

        try {
          const response = JSON.parse(raw) as {
            requestId?: string;
            result?: unknown;
          };
          if (response.requestId !== requestId) return;
          window.removeEventListener(EDITOR_BRIDGE_RESPONSE_EVENT, onResponse);
          resolve(typeof response.result === "string" ? response.result : null);
        } catch {
          // Ignore unrelated or malformed page events.
        }
      };

      window.addEventListener(EDITOR_BRIDGE_RESPONSE_EVENT, onResponse);
      if (!this.request("yank-line", undefined, undefined, requestId)) {
        window.removeEventListener(EDITOR_BRIDGE_RESPONSE_EVENT, onResponse);
        resolve(null);
      }
    });
  }

  setMode(mode: VimMode): void {
    this.request("set-mode", undefined, mode);
  }

  dispose(): void {
    this.request("dispose");
  }

  private request(
    operation: EditorBridgeRequest["operation"],
    motion?: CursorMotion | WordMotion,
    mode?: VimMode,
    requestId?: string,
  ): boolean {
    return sendEditorBridgeRequest(this.root, {
      adapterId: this.id,
      operation,
      motion,
      mode,
      requestId,
    });
  }
}
