import type { EditorAdapter } from "../core/editor-adapter";

export interface EditorAdapterProvider {
  readonly id: string;
  /** Locate an active editable root inside a keyboard/focus event path. */
  findRoot(path: readonly EventTarget[]): HTMLElement | null;
  /** Return null when the page does not expose this editor's public API. */
  create(root: HTMLElement): EditorAdapter | null;
}

export class EditorAdapterRegistry {
  private readonly providers: readonly EditorAdapterProvider[];
  private readonly instances = new WeakMap<HTMLElement, EditorAdapter>();

  constructor(providers: readonly EditorAdapterProvider[]) {
    this.providers = providers;
  }

  resolve(path: readonly EventTarget[]): EditorAdapter | null {
    for (const provider of this.providers) {
      const root = provider.findRoot(path);
      if (!root) continue;

      const existing = this.instances.get(root);
      if (existing) return existing;

      const adapter = provider.create(root);
      if (!adapter) continue;
      this.instances.set(root, adapter);
      return adapter;
    }
    return null;
  }

  release(adapter: EditorAdapter): void {
    if (this.instances.get(adapter.root) === adapter) {
      this.instances.delete(adapter.root);
    }
    adapter.dispose();
  }
}
