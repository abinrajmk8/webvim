import type { CursorMotion, WordMotion } from "./editor-adapter";
import type { VimMode } from "./modes";

export const EDITOR_BRIDGE_EVENT = "webvim:editor-bridge";
export const EDITOR_BRIDGE_RESPONSE_EVENT = "webvim:editor-bridge-response";

export type EditorBridgeOperation =
  | "probe"
  | "move"
  | "word"
  | "delete-line"
  | "yank-line"
  | "set-mode"
  | "dispose";

export interface EditorBridgeRequest {
  readonly adapterId: string;
  readonly operation: EditorBridgeOperation;
  readonly motion?: CursorMotion | WordMotion;
  readonly mode?: VimMode;
  readonly requestId?: string;
}

/**
 * This bridge only passes editor commands and their results between the
 * isolated content script and the page world. Never send extension settings.
 */
export function sendEditorBridgeRequest(
  target: HTMLElement,
  request: EditorBridgeRequest,
): boolean {
  const event = new CustomEvent<string>(EDITOR_BRIDGE_EVENT, {
      bubbles: true,
      cancelable: true,
      composed: true,
      detail: JSON.stringify(request),
    });
  return !target.dispatchEvent(event);
}
