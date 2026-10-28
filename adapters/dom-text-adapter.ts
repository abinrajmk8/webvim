import type {
  AdapterCapability,
  CursorMotion,
  EditorAdapter,
  WordMotion,
} from "../core/editor-adapter";
import type { VimMode } from "../core/modes";

const INPUT_TYPES = new Set(["text", "search", "email", "url", "tel"]);
const INPUT_CAPABILITIES: ReadonlySet<AdapterCapability> = new Set([
  "horizontal-motion",
  "word-motion",
  "cursor-presentation",
]);
const TEXTAREA_CAPABILITIES: ReadonlySet<AdapterCapability> = new Set([
  "horizontal-motion",
  "vertical-motion",
  "word-motion",
  "line-operations",
  "cursor-presentation",
]);
const CONTENTEDITABLE_CAPABILITIES: ReadonlySet<AdapterCapability> = new Set([
  "horizontal-motion",
  "vertical-motion",
  "word-motion",
  "cursor-presentation",
]);

function supportsCaretShape(): boolean {
  return typeof CSS !== "undefined" && CSS.supports("caret-shape", "block");
}

abstract class CaretStyleAdapter implements EditorAdapter {
  abstract readonly id: string;
  abstract readonly root: HTMLElement;
  abstract readonly capabilities: ReadonlySet<AdapterCapability>;

  private readonly oldCaretShape: string;
  private readonly oldCaretShapePriority: string;
  private caretShapeChanged = false;

  protected constructor(root: HTMLElement) {
    this.root = root;
    this.oldCaretShape = root.style.getPropertyValue("caret-shape");
    this.oldCaretShapePriority = root.style.getPropertyPriority("caret-shape");
  }

  setMode(mode: VimMode): void {
    if (!supportsCaretShape()) return;
    this.root.style.setProperty(
      "caret-shape",
      mode === "normal" ? "block" : "bar",
    );
    this.caretShapeChanged = true;
  }

  dispose(): void {
    if (!this.caretShapeChanged) return;
    if (this.oldCaretShape) {
      this.root.style.setProperty(
        "caret-shape",
        this.oldCaretShape,
        this.oldCaretShapePriority,
      );
    } else {
      this.root.style.removeProperty("caret-shape");
    }
  }
}

export class TextControlAdapter extends CaretStyleAdapter {
  readonly id = "html-text-control";
  readonly root: HTMLInputElement | HTMLTextAreaElement;
  readonly capabilities: ReadonlySet<AdapterCapability>;
  private preferredColumn: number | null = null;

  constructor(root: HTMLInputElement | HTMLTextAreaElement) {
    super(root);
    this.root = root;
    this.capabilities =
      root instanceof HTMLTextAreaElement
        ? TEXTAREA_CAPABILITIES
        : INPUT_CAPABILITIES;
  }

  moveCursor(motion: CursorMotion): void {
    const value = this.root.value;
    const start = this.root.selectionStart ?? 0;
    const end = this.root.selectionEnd ?? start;
    let next = start;

    if (motion === "left") {
      next = start === end ? Math.max(0, start - 1) : start;
      this.preferredColumn = null;
    } else if (motion === "right") {
      next = start === end ? Math.min(value.length, end + 1) : end;
      this.preferredColumn = null;
    } else if (this.root instanceof HTMLTextAreaElement) {
      const lines = lineStarts(value);
      const currentLine = lineAt(lines, start);
      const currentColumn = start - lines[currentLine];
      this.preferredColumn ??= currentColumn;
      const destination =
        motion === "up" ? currentLine - 1 : currentLine + 1;
      if (destination >= 0 && destination < lines.length) {
        const lineEnd = value.indexOf("\n", lines[destination]);
        const endOfLine = lineEnd < 0 ? value.length : lineEnd;
        next = Math.min(lines[destination] + this.preferredColumn, endOfLine);
      } else {
        next = start;
      }
    }

    this.root.setSelectionRange(next, next);
  }

  moveByWord(motion: WordMotion): void {
    this.preferredColumn = null;
    const value = this.root.value;
    const current = this.root.selectionEnd ?? 0;
    const next =
      motion === "forward"
        ? nextWord(value, current)
        : previousWord(value, current);
    this.root.setSelectionRange(next, next);
  }

  deleteCurrentLine(): string | null {
    if (!(this.root instanceof HTMLTextAreaElement)) return null;

    const value = this.root.value;
    const cursor = this.root.selectionStart ?? 0;
    const { start, end, text } = currentLine(value, cursor);
    const deletionStart = end === value.length && start > 0 ? start - 1 : start;
    const deletionEnd = end < value.length ? end + 1 : end;

    this.root.setRangeText("", deletionStart, deletionEnd, "start");
    this.root.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "deleteContentBackward",
      }),
    );
    this.preferredColumn = null;
    return text;
  }

  yankCurrentLine(): string | null {
    if (!(this.root instanceof HTMLTextAreaElement)) return null;
    const cursor = this.root.selectionStart ?? 0;
    return currentLine(this.root.value, cursor).text;
  }
}

export class ContentEditableAdapter extends CaretStyleAdapter {
  readonly id = "contenteditable";
  readonly root: HTMLElement;
  readonly capabilities = CONTENTEDITABLE_CAPABILITIES;

  constructor(root: HTMLElement) {
    super(root);
    this.root = root;
  }

  moveCursor(motion: CursorMotion): void {
    const selection = this.selection();
    if (!selection) return;

    const direction =
      motion === "left" || motion === "right"
        ? motion
        : motion === "up"
          ? "backward"
          : "forward";
    const granularity =
      motion === "up" || motion === "down" ? "line" : "character";
    modifySelection(selection, direction, granularity);
  }

  moveByWord(motion: WordMotion): void {
    const selection = this.selection();
    if (selection) {
      modifySelection(
        selection,
        motion === "forward" ? "forward" : "backward",
        "word",
      );
    }
  }

  private selection(): Selection | null {
    const root = this.root.getRootNode() as Node & {
      getSelection?: () => Selection | null;
    };
    const selection = root.getSelection?.() ?? document.getSelection();
    const anchor = selection?.anchorNode;
    return anchor && (anchor === this.root || this.root.contains(anchor))
      ? selection
      : null;
  }
}

function modifySelection(
  selection: Selection,
  direction: "left" | "right" | "forward" | "backward",
  granularity: "character" | "line" | "word",
): void {
  const modifiable = selection as Selection & {
    modify?: (
      alter: "move",
      direction: string,
      granularity: string,
    ) => void;
  };
  modifiable.modify?.("move", direction, granularity);
}

export function inputTypeIsSupported(input: HTMLInputElement): boolean {
  return INPUT_TYPES.has(input.type.toLowerCase());
}

export function lineStarts(text: string): number[] {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") starts.push(index + 1);
  }
  return starts;
}

function lineAt(starts: readonly number[], position: number): number {
  let low = 0;
  let high = starts.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (starts[middle] <= position) low = middle + 1;
    else high = middle;
  }
  return Math.max(0, low - 1);
}

function isWordCharacter(character: string | undefined): boolean {
  return character !== undefined && /[\p{L}\p{N}_]/u.test(character);
}

function nextWord(text: string, position: number): number {
  let next = Math.min(position, text.length);
  while (next < text.length && isWordCharacter(text[next])) next += 1;
  while (next < text.length && !isWordCharacter(text[next])) next += 1;
  return next;
}

function previousWord(text: string, position: number): number {
  let previous = Math.max(0, position - 1);
  while (previous > 0 && !isWordCharacter(text[previous])) previous -= 1;
  while (previous > 0 && isWordCharacter(text[previous - 1])) previous -= 1;
  return previous;
}

function currentLine(
  text: string,
  position: number,
): { start: number; end: number; text: string } {
  const start = text.lastIndexOf("\n", Math.max(0, position - 1)) + 1;
  const lineEnd = text.indexOf("\n", position);
  const end = lineEnd < 0 ? text.length : lineEnd;
  return { start, end, text: text.slice(start, end) };
}

export function contentEditableRoot(target: Element): HTMLElement | null {
  const explicitHost = target.closest<HTMLElement>(
    '[contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]',
  );
  if (explicitHost && (target as HTMLElement).isContentEditable) {
    if (target.closest('[contenteditable="false"]')) return null;
    return explicitHost;
  }

  const ownerDocument = target.ownerDocument;
  if (ownerDocument.designMode === "on") return ownerDocument.body;
  return null;
}
