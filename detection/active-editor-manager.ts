import type { EditorAdapter } from "../core/editor-adapter";
import type { EditorAdapterRegistry } from "../adapters/registry";

export type ActiveEditorListener = (adapter: EditorAdapter | null) => void;

export class ActiveEditorManager {
  private readonly target: Window;
  private readonly registry: EditorAdapterRegistry;
  private readonly onChange: ActiveEditorListener;
  private activeAdapter: EditorAdapter | null = null;
  private observer: MutationObserver | null = null;
  private listening = false;

  constructor(
    registry: EditorAdapterRegistry,
    onChange: ActiveEditorListener,
    target: Window = window,
  ) {
    this.registry = registry;
    this.onChange = onChange;
    this.target = target;
  }

  start(): void {
    if (this.listening) return;
    this.listening = true;
    this.target.addEventListener("focusin", this.onFocusIn, true);
    this.target.addEventListener("focusout", this.onFocusOut, true);
    this.target.addEventListener("popstate", this.onRouteChange, true);
    this.target.addEventListener("hashchange", this.onRouteChange, true);
    this.refreshFromActiveElement();
  }

  resolvePath(path: readonly EventTarget[]): EditorAdapter | null {
    const adapter = this.registry.resolve(path);
    this.setActive(adapter);
    return adapter;
  }

  stop(): void {
    if (!this.listening) return;
    this.listening = false;
    this.target.removeEventListener("focusin", this.onFocusIn, true);
    this.target.removeEventListener("focusout", this.onFocusOut, true);
    this.target.removeEventListener("popstate", this.onRouteChange, true);
    this.target.removeEventListener("hashchange", this.onRouteChange, true);
    this.disconnectObserver();
    this.setActive(null);
  }

  private readonly onFocusIn = (event: FocusEvent): void => {
    this.resolvePath(event.composedPath());
  };

  private readonly onFocusOut = (): void => {
    queueMicrotask(() => this.refreshFromActiveElement());
  };

  private readonly onRouteChange = (): void => {
    this.refreshFromActiveElement();
  };

  private readonly onMutations = (): void => {
    if (this.activeAdapter && !this.activeAdapter.root.isConnected) {
      this.setActive(null);
      return;
    }
    this.refreshFromActiveElement();
  };

  private refreshFromActiveElement(): void {
    let active: Element | null = this.target.document.activeElement;
    while (active?.shadowRoot?.activeElement) {
      active = active.shadowRoot.activeElement;
    }
    if (active) {
      this.resolvePath(this.pathFrom(active));
    } else {
      this.setActive(null);
    }
  }

  private pathFrom(element: Element): EventTarget[] {
    const path: EventTarget[] = [];
    let current: Node | null = element;
    while (current) {
      path.push(current);
      if (current instanceof ShadowRoot) {
        current = current.host;
      } else {
        current = current.parentNode;
      }
    }
    path.push(this.target.document, this.target);
    return path;
  }

  private setActive(adapter: EditorAdapter | null): void {
    if (adapter === this.activeAdapter) return;

    if (this.activeAdapter) this.registry.release(this.activeAdapter);
    this.activeAdapter = adapter;
    if (adapter) this.connectObserver();
    else this.disconnectObserver();
    this.onChange(adapter);
  }

  private connectObserver(): void {
    if (this.observer || !this.target.document.documentElement) return;
    this.observer = new MutationObserver(this.onMutations);
    this.observer.observe(this.target.document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["contenteditable", "disabled", "readonly"],
    });
  }

  private disconnectObserver(): void {
    this.observer?.disconnect();
    this.observer = null;
  }
}
