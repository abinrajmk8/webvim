import type { ModeManager, VimMode } from "../core/modes";

const STYLE = `
  :host { all: initial; }
  .panel {
    position: fixed;
    right: 12px;
    bottom: 12px;
    z-index: 2147483647;
    padding: 4px 10px;
    border-radius: 4px;
    font: 600 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: #fff;
    background: #2563eb;
    opacity: 0.9;
    pointer-events: none;
    user-select: none;
  }
  .panel[data-mode='insert'] { background: #16a34a; }
`;

/** Temporary debug UI. Returns a function that unmounts it. */
export function mountDebugPanel(modes: ModeManager): () => void {
  const host = document.createElement("div");
  host.setAttribute("data-browser-vim", "debug-panel");
  const shadow = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = STYLE;

  const panel = document.createElement("div");
  panel.className = "panel";

  const render = (mode: VimMode): void => {
    panel.dataset.mode = mode;
    panel.textContent = `-- ${mode.toUpperCase()} --`;
  };

  render(modes.mode);
  shadow.append(style, panel);
  document.documentElement.append(host);

  const unsubscribe = modes.subscribe(render);
  return () => {
    unsubscribe();
    host.remove();
  };
}
