import type { CursorMotion, WordMotion } from "./editor-adapter";

export const GOOGLE_DOCS_ATTACH_MESSAGE = "webvim:google-docs:attach";
export const GOOGLE_DOCS_DETACH_MESSAGE = "webvim:google-docs:detach";
export const GOOGLE_DOCS_MOVE_MESSAGE = "webvim:google-docs:move";
export const GOOGLE_DOCS_DETACHED_MESSAGE = "webvim:google-docs:detached";

export type GoogleDocsMotion = CursorMotion | WordMotion;

export interface GoogleDocsDebuggerResponse {
  readonly ok: boolean;
  readonly error?: string;
}
