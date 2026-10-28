import { PageApiAdapter } from "./bridge-adapter";
import type { EditorAdapterProvider } from "./registry";

export function createCodeMirrorProvider(): EditorAdapterProvider {
  return {
    id: "codemirror6",

    findRoot(path): HTMLElement | null {
      for (const target of path) {
        if (!(target instanceof HTMLElement)) continue;
        const content = target.matches(".cm-content")
          ? target
          : target.closest<HTMLElement>(".cm-content");
        if (content?.closest(".cm-editor")) return content;
      }
      return null;
    },

    create(root): PageApiAdapter | null {
      const adapter = new PageApiAdapter("codemirror6", root);
      return adapter.supported ? adapter : null;
    },
  };
}
