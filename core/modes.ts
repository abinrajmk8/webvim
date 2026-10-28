export type VimMode = "normal" | "insert";

export type ModeListener = (mode: VimMode, previous: VimMode) => void;

export class ModeManager {
  private current: VimMode;
  private readonly listeners = new Set<ModeListener>();

  constructor(initial: VimMode = "normal") {
    this.current = initial;
  }

  get mode(): VimMode {
    return this.current;
  }

  set(next: VimMode): void {
    if (next === this.current) return;
    const previous = this.current;
    this.current = next;
    for (const listener of [...this.listeners]) {
      listener(next, previous);
    }
  }

  subscribe(listener: ModeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
