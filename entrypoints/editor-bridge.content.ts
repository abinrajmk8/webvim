import {
  EDITOR_BRIDGE_EVENT,
  EDITOR_BRIDGE_RESPONSE_EVENT,
  type EditorBridgeRequest,
} from "../core/bridge-events";
import type { CursorMotion, WordMotion } from "../core/editor-adapter";
import type { VimMode } from "../core/modes";

interface MonacoEditorLike {
  getContainerDomNode(): HTMLElement;
  trigger(source: string, handlerId: string, payload: unknown): void;
  getPosition(): { lineNumber: number; column: number } | null;
  getModel(): MonacoModelLike | null;
  executeEdits(source: string, edits: readonly unknown[]): boolean;
  setPosition(position: { lineNumber: number; column: number }): void;
  getOption(option: unknown): unknown;
  updateOptions(options: Record<string, unknown>): void;
}

interface MonacoModelLike {
  getLineCount(): number;
  getLineContent(lineNumber: number): string;
  getLineMaxColumn(lineNumber: number): number;
}

interface MonacoGlobalLike {
  editor?: {
    getEditors?: () => MonacoEditorLike[];
    EditorOption?: { cursorStyle?: unknown };
  };
}

interface AceEditorLike {
  getCursorPosition(): { row: number; column: number };
  getSession(): AceSessionLike;
  navigateLeft(): void;
  navigateRight(): void;
  navigateUp(): void;
  navigateDown(): void;
  navigateWordLeft?(): void;
  navigateWordRight?(): void;
  moveCursorTo(row: number, column: number): void;
  getOption(name: string): unknown;
  setOption(name: string, value: unknown): void;
}

interface AceSessionLike {
  getLength(): number;
  getLine(row: number): string;
  remove(range: unknown): void;
}

interface AceGlobalLike {
  edit(element: HTMLElement): AceEditorLike;
  require?(name: string): { Range?: new (...args: number[]) => unknown };
}

interface CodeMirrorLineLike {
  from: number;
  to: number;
  number: number;
  text: string;
}

interface CodeMirrorStateLike {
  doc: {
    length: number;
    toString(): string;
    lineAt(position: number): CodeMirrorLineLike;
    line(number: number): CodeMirrorLineLike;
  };
  selection: { main: { head: number } };
}

interface CodeMirrorViewLike {
  state: CodeMirrorStateLike;
  dispatch(spec: Record<string, unknown>): void;
}

interface CodeMirrorGlobalLike {
  EditorView?: {
    findFromDOM(dom: HTMLElement): CodeMirrorViewLike | null;
  };
}

const BRIDGE_FLAG = Symbol.for("webvim.editor-bridge");
const MONACO_WORD_COMMANDS: Readonly<Record<WordMotion, string>> = {
  forward: "cursorWordEndRight",
  backward: "cursorWordStartLeft",
};
const ACE_CURSOR_STYLE = "cursorStyle";
const monacoCursorStyles = new WeakMap<object, unknown>();
const aceCursorStyles = new WeakMap<object, unknown>();
const codeMirrorColumns = new WeakMap<object, number>();

function getMonaco(): MonacoGlobalLike | null {
  return (window as unknown as { monaco?: MonacoGlobalLike }).monaco ?? null;
}

function getAce(): AceGlobalLike | null {
  return (window as unknown as { ace?: AceGlobalLike }).ace ?? null;
}

function getCodeMirror(): CodeMirrorGlobalLike | null {
  return (window as unknown as { CodeMirror?: CodeMirrorGlobalLike })
    .CodeMirror ?? null;
}

function findMonaco(target: Element): MonacoEditorLike | null {
  return (
    getMonaco()?.editor?.getEditors?.().find((editor) =>
      editor.getContainerDomNode().contains(target),
    ) ?? null
  );
}

function findAce(target: Element): AceEditorLike | null {
  const root = target.closest<HTMLElement>(".ace_editor");
  const ace = getAce();
  if (!root || !ace) return null;
  try {
    return ace.edit(root);
  } catch {
    return null;
  }
}

function findCodeMirror6(target: Element): CodeMirrorViewLike | null {
  const root = target.closest<HTMLElement>(".cm-editor");
  const EditorView = getCodeMirror()?.EditorView;
  return root && EditorView ? EditorView.findFromDOM(root) : null;
}

function withMonacoLine(
  editor: MonacoEditorLike,
  operation: "delete-line" | "yank-line",
): string | null {
  const model = editor.getModel();
  const position = editor.getPosition();
  if (!model || !position) return null;

  const lineNumber = position.lineNumber;
  const text = model.getLineContent(lineNumber);
  if (operation === "yank-line") return text;

  let range: Record<string, number>;
  let nextPosition: { lineNumber: number; column: number };
  if (lineNumber < model.getLineCount()) {
    range = {
      startLineNumber: lineNumber,
      startColumn: 1,
      endLineNumber: lineNumber + 1,
      endColumn: 1,
    };
    nextPosition = { lineNumber, column: 1 };
  } else if (lineNumber > 1) {
    range = {
      startLineNumber: lineNumber - 1,
      startColumn: model.getLineMaxColumn(lineNumber - 1),
      endLineNumber: lineNumber,
      endColumn: model.getLineMaxColumn(lineNumber),
    };
    nextPosition = {
      lineNumber: lineNumber - 1,
      column: model.getLineMaxColumn(lineNumber - 1),
    };
  } else {
    range = {
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: model.getLineMaxColumn(1),
    };
    nextPosition = { lineNumber: 1, column: 1 };
  }

  editor.executeEdits("webvim", [{ range, text: "" }]);
  editor.setPosition(nextPosition);
  return text;
}

function withAceLine(
  editor: AceEditorLike,
  operation: "delete-line" | "yank-line",
): string | null {
  const session = editor.getSession();
  const position = editor.getCursorPosition();
  const row = position.row;
  const text = session.getLine(row);
  if (operation === "yank-line") return text;

  const Range = getAce()?.require?.("ace/range").Range;
  if (!Range) return null;

  const lastRow = session.getLength() - 1;
  if (row < lastRow) {
    session.remove(new Range(row, 0, row + 1, 0));
    editor.moveCursorTo(row, 0);
  } else if (row > 0) {
    session.remove(new Range(row - 1, session.getLine(row - 1).length, row, text.length));
    editor.moveCursorTo(row - 1, session.getLine(row - 1).length);
  } else {
    session.remove(new Range(0, 0, 0, text.length));
    editor.moveCursorTo(0, 0);
  }
  return text;
}

function codeMirrorMove(
  view: CodeMirrorViewLike,
  motion: CursorMotion | WordMotion,
  word = false,
): void {
  const state = view.state;
  const position = state.selection.main.head;
  const line = state.doc.lineAt(position);
  let next = position;

  if (word) {
    const text = state.doc.toString();
    next = motion === "forward" ? nextWord(text, position) : previousWord(text, position);
  } else if (motion === "left") {
    next = Math.max(line.from, position - 1);
    codeMirrorColumns.delete(view as object);
  } else if (motion === "right") {
    next = Math.min(line.to, position + 1);
    codeMirrorColumns.delete(view as object);
  } else {
    const column = codeMirrorColumns.get(view as object) ?? position - line.from;
    const targetNumber = motion === "up" ? line.number - 1 : line.number + 1;
    if (targetNumber >= 1 && targetNumber <= state.doc.lineAt(state.doc.length).number) {
      codeMirrorColumns.set(view as object, column);
      const targetLine = state.doc.line(targetNumber);
      next = Math.min(targetLine.from + column, targetLine.to);
    }
  }

  view.dispatch({ selection: { anchor: next }, scrollIntoView: true });
}

function withCodeMirrorLine(
  view: CodeMirrorViewLike,
  operation: "delete-line" | "yank-line",
): string {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  if (operation === "yank-line") return line.text;

  const lastLine = view.state.doc.lineAt(view.state.doc.length);
  let from = line.from;
  let to = line.to;
  let next = line.from;
  if (line.number < lastLine.number) {
    to = line.to + 1;
  } else if (line.number > 1) {
    const previous = view.state.doc.line(line.number - 1);
    from = previous.to;
    next = previous.to;
  }

  view.dispatch({
    changes: { from, to, insert: "" },
    selection: { anchor: next },
    userEvent: "delete",
    scrollIntoView: true,
  });
  return line.text;
}

function nextWord(text: string, position: number): number {
  let next = Math.min(position, text.length);
  while (next < text.length && isWord(text[next])) next += 1;
  while (next < text.length && !isWord(text[next])) next += 1;
  return next;
}

function previousWord(text: string, position: number): number {
  let previous = Math.max(0, position - 1);
  while (previous > 0 && !isWord(text[previous])) previous -= 1;
  while (previous > 0 && isWord(text[previous - 1])) previous -= 1;
  return previous;
}

function isWord(character: string | undefined): boolean {
  return character !== undefined && /[\p{L}\p{N}_]/u.test(character);
}

function applyMonacoMode(editor: MonacoEditorLike, mode: VimMode): void {
  const cursorStyleOption = getMonaco()?.editor?.EditorOption?.cursorStyle;
  if (cursorStyleOption === undefined) return;

  if (!monacoCursorStyles.has(editor as object)) {
    monacoCursorStyles.set(
      editor as object,
      editor.getOption(cursorStyleOption),
    );
  }
  editor.updateOptions({ cursorStyle: mode === "normal" ? "block" : "line" });
}

function restoreMonacoMode(editor: MonacoEditorLike): void {
  const cursorStyleOption = getMonaco()?.editor?.EditorOption?.cursorStyle;
  if (cursorStyleOption === undefined || !monacoCursorStyles.has(editor as object)) {
    return;
  }
  editor.updateOptions({ cursorStyle: monacoCursorStyles.get(editor as object) });
  monacoCursorStyles.delete(editor as object);
}

function applyAceMode(editor: AceEditorLike, mode: VimMode): void {
  if (!aceCursorStyles.has(editor as object)) {
    aceCursorStyles.set(editor as object, editor.getOption(ACE_CURSOR_STYLE));
  }
  editor.setOption(ACE_CURSOR_STYLE, mode === "normal" ? "wide" : "slim");
}

function restoreAceMode(editor: AceEditorLike): void {
  if (!aceCursorStyles.has(editor as object)) return;
  editor.setOption(ACE_CURSOR_STYLE, aceCursorStyles.get(editor as object));
  aceCursorStyles.delete(editor as object);
}

function handleBridgeEvent(event: Event): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const raw = (event as CustomEvent<string>).detail;
  if (typeof raw !== "string") return;

  let request: EditorBridgeRequest;
  try {
    request = JSON.parse(raw) as EditorBridgeRequest;
  } catch {
    return;
  }

  try {
    if (request.adapterId === "monaco") {
      const editor = findMonaco(target);
      if (!editor) return;
      event.preventDefault();
      switch (request.operation) {
        case "move":
          editor.trigger("webvim", MONACO_COMMANDS[request.motion as CursorMotion], {});
          break;
        case "word":
          editor.trigger("webvim", MONACO_WORD_COMMANDS[request.motion as WordMotion], {});
          break;
        case "delete-line":
          withMonacoLine(editor, request.operation);
          break;
        case "yank-line":
          sendBridgeResponse(
            request.requestId,
            withMonacoLine(editor, request.operation),
          );
          break;
        case "set-mode":
          applyMonacoMode(editor, request.mode ?? "normal");
          break;
        case "dispose":
          restoreMonacoMode(editor);
          break;
      }
      return;
    }

    if (request.adapterId === "ace") {
      const editor = findAce(target);
      if (!editor) return;
      event.preventDefault();
      switch (request.operation) {
        case "move":
          aceMove(editor, request.motion as CursorMotion);
          break;
        case "word":
          if (request.motion === "forward") editor.navigateWordRight?.();
          else editor.navigateWordLeft?.();
          break;
        case "delete-line":
          withAceLine(editor, request.operation);
          break;
        case "yank-line":
          sendBridgeResponse(
            request.requestId,
            withAceLine(editor, request.operation),
          );
          break;
        case "set-mode":
          applyAceMode(editor, request.mode ?? "normal");
          break;
        case "dispose":
          restoreAceMode(editor);
          break;
      }
      return;
    }

    if (request.adapterId === "codemirror6") {
      const view = findCodeMirror6(target);
      if (!view) return;
      event.preventDefault();
      switch (request.operation) {
        case "move":
          codeMirrorMove(view, request.motion as CursorMotion);
          break;
        case "word":
          codeMirrorMove(view, request.motion as WordMotion, true);
          break;
        case "delete-line":
          withCodeMirrorLine(view, request.operation);
          break;
        case "yank-line":
          sendBridgeResponse(
            request.requestId,
            withCodeMirrorLine(view, request.operation),
          );
          break;
      }
    }
  } catch (error) {
    // A broken or customized editor integration must not disrupt its host page.
    console.warn("[webvim] editor bridge failed", error);
    if (request.operation === "yank-line") {
      sendBridgeResponse(request.requestId, null);
    }
  }
}

function sendBridgeResponse(
  requestId: string | undefined,
  result: string | null,
): void {
  if (!requestId) return;
  window.dispatchEvent(
    new CustomEvent(EDITOR_BRIDGE_RESPONSE_EVENT, {
      detail: JSON.stringify({ requestId, result }),
    }),
  );
}

function aceMove(editor: AceEditorLike, motion: CursorMotion): void {
  switch (motion) {
    case "left":
      editor.navigateLeft();
      break;
    case "right":
      editor.navigateRight();
      break;
    case "up":
      editor.navigateUp();
      break;
    case "down":
      editor.navigateDown();
      break;
  }
}

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  allFrames: true,
  matchAboutBlank: true,
  world: "MAIN",
  runAt: "document_idle",

  main() {
    const flags = window as unknown as Record<symbol, unknown>;
    if (flags[BRIDGE_FLAG]) return;
    flags[BRIDGE_FLAG] = true;
    window.addEventListener(EDITOR_BRIDGE_EVENT, handleBridgeEvent, true);
  },
});

const MONACO_COMMANDS: Readonly<Record<CursorMotion, string>> = {
  left: "cursorLeft",
  down: "cursorDown",
  up: "cursorUp",
  right: "cursorRight",
};
