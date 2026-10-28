import { createMonacoProvider } from "../adapters/monaco-adapter";
import { EditorAdapterRegistry } from "../adapters/registry";
import { ModeManager } from "../core/modes";
import { VimEngine } from "../core/vim-engine";
import { KeyboardController } from "../input/keyboard-controller";
import { mountDebugPanel } from "../ui/debug-panel";

const BOOT_FLAG = Symbol.for("webvim.booted");

export default defineContentScript({
  matches: ["*://neetcode.io/*", "*://*.neetcode.io/*"],
  // MAIN world gives synchronous access to the page's `window.monaco` API.
  world: "MAIN",
  runAt: "document_idle",

  main() {
    const flags = window as unknown as Record<symbol, unknown>;
    if (flags[BOOT_FLAG]) return; // guard against double injection
    flags[BOOT_FLAG] = true;

    const modes = new ModeManager("normal");
    const engine = new VimEngine(modes);
    const registry = new EditorAdapterRegistry(new URL(window.location.href), [
      createMonacoProvider({ hosts: ["neetcode.io"] }),
    ]);

    new KeyboardController(engine, registry).start();
    mountDebugPanel(modes);
  },
});
