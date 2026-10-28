import { createMonacoProvider } from "../adapters/monaco-adapter";
import { createAceProvider } from "../adapters/ace-adapter";
import { createCodeMirrorProvider } from "../adapters/codemirror-adapter";
import {
  createContentEditableProvider,
  createTextControlProvider,
} from "../adapters/dom-provider";
import { EditorAdapterRegistry } from "../adapters/registry";
import { ModeManager } from "../core/modes";
import {
  DEFAULT_WEBVIM_ENABLED,
  WEBVIM_ENABLED_KEY,
  getWebVimEnabled,
} from "../core/settings";
import { VimEngine } from "../core/vim-engine";
import { KeyboardController } from "../input/keyboard-controller";
import { mountDebugPanel } from "../ui/debug-panel";

const BOOT_FLAG = Symbol.for("webvim.booted");

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  allFrames: true,
  matchAboutBlank: true,
  // The isolated world can use extension storage without exposing settings to the page.
  world: "ISOLATED",
  runAt: "document_idle",

  main() {
    const flags = window as unknown as Record<symbol, unknown>;
    if (flags[BOOT_FLAG]) return; // guard against double injection
    const state: { session: RuntimeSession | null } = { session: null };
    flags[BOOT_FLAG] = state;

    const stopSession = (): void => {
      const session = state.session;
      if (!session) return;
      state.session = null;

      try {
        session.controller.stop();
      } catch (error) {
        console.error("[webvim] could not stop keyboard handling", error);
      }
      try {
        session.unmountPanel();
      } catch (error) {
        console.error("[webvim] could not remove mode panel", error);
      }
    };

    const startSession = (): void => {
      if (state.session) return;

      let controller: KeyboardController | null = null;
      let unmountPanel: (() => void) | null = null;
      try {
        const modes = new ModeManager("normal");
        const engine = new VimEngine(modes);
        const isGoogleWorkspace = isGoogleDocsContext();
        const registry = new EditorAdapterRegistry(
          isGoogleWorkspace
            ? []
            : [
                createMonacoProvider(),
                createAceProvider(),
                createCodeMirrorProvider(),
                createTextControlProvider(),
                createContentEditableProvider(),
              ],
        );

        controller = new KeyboardController(engine, registry);
        unmountPanel =
          window === window.top && !isGoogleWorkspace
            ? mountDebugPanel(modes)
            : () => undefined;
        controller.start();
        state.session = { controller, unmountPanel };
      } catch (error) {
        try {
          controller?.stop();
        } catch (stopError) {
          console.error("[webvim] could not clean up keyboard handling", stopError);
        }
        try {
          unmountPanel?.();
        } catch (panelError) {
          console.error("[webvim] could not clean up mode panel", panelError);
        }
        console.error("[webvim] could not initialize on this page", error);
      }
    };

    const applyStoredValue = (value: unknown): void => {
      if (typeof value === "boolean" ? value : DEFAULT_WEBVIM_ENABLED) {
        startSession();
      } else {
        stopSession();
      }
    };

    let settingChangedDuringRead = false;
    const onStorageChanged = (
      changes: Record<string, Browser.storage.StorageChange>,
      areaName: string,
    ): void => {
      if (areaName !== "local" || !(WEBVIM_ENABLED_KEY in changes)) return;
      settingChangedDuringRead = true;
      applyStoredValue(changes[WEBVIM_ENABLED_KEY]?.newValue);
    };

    try {
      browser.storage.onChanged.addListener(onStorageChanged);
    } catch (error) {
      console.error("[webvim] could not subscribe to setting changes", error);
    }

    void getWebVimEnabled()
      .then((enabled) => {
        if (!settingChangedDuringRead) applyStoredValue(enabled);
      })
      .catch((error: unknown) => {
        console.error("[webvim] could not load setting; defaulting to enabled", error);
        if (!settingChangedDuringRead) applyStoredValue(DEFAULT_WEBVIM_ENABLED);
      });
  },
});

interface RuntimeSession {
  readonly controller: KeyboardController;
  readonly unmountPanel: () => void;
}

/**
 * Content scripts can also run in related about:blank and nested frames.
 * Check the effective and ancestor origins so those frames do not mistake a
 * Google Docs editor's hidden input for an ordinary text control.
 */
function isGoogleDocsContext(): boolean {
  const isDocsOrigin = (origin: string): boolean => {
    try {
      return new URL(origin).hostname === "docs.google.com";
    } catch {
      return false;
    }
  };

  if (isDocsOrigin(window.location.origin)) return true;

  const ancestorOrigins = (
    window.location as Location & { ancestorOrigins?: DOMStringList }
  ).ancestorOrigins;
  if (ancestorOrigins) {
    for (let index = 0; index < ancestorOrigins.length; index += 1) {
      const origin = ancestorOrigins.item(index);
      if (origin && isDocsOrigin(origin)) return true;
    }
  }

  return Boolean(document.referrer && isDocsOrigin(document.referrer));
}
