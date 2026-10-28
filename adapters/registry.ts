import type { EditorAdapter } from "../core/editor-adapter";

export interface EditorAdapterProvider {
  readonly id: string;
  /** Whether this provider should be active on the given page. */
  supportsPage(url: URL): boolean;
  /** Returns an adapter if the event target is this provider's editor input. */
  resolve(target: EventTarget | null): EditorAdapter | null;
}

export class EditorAdapterRegistry {
  private readonly providers: readonly EditorAdapterProvider[];

  constructor(pageUrl: URL, providers: readonly EditorAdapterProvider[]) {
    this.providers = providers.filter((provider) =>
      provider.supportsPage(pageUrl),
    );
  }

  resolve(target: EventTarget | null): EditorAdapter | null {
    for (const provider of this.providers) {
      const adapter = provider.resolve(target);
      if (adapter) return adapter;
    }
    return null;
  }
}
