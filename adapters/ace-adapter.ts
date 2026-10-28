import { PageApiAdapter } from "./bridge-adapter";
import type { EditorAdapterProvider } from "./registry";

const ACE_INPUT_SELECTOR = "textarea.ace_text-input, .ace_text-input";

export function createAceProvider(): EditorAdapterProvider {
  return {
    id: "ace",

    findRoot(path): HTMLElement | null {
      return (
        path.find(
          (target): target is HTMLElement =>
            target instanceof HTMLElement &&
            target.matches(ACE_INPUT_SELECTOR) &&
            Boolean(target.closest(".ace_editor")),
        ) ?? null
      );
    },

    create(root): PageApiAdapter | null {
      const adapter = new PageApiAdapter("ace", root);
      return adapter.supported ? adapter : null;
    },
  };
}
