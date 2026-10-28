import { PageApiAdapter } from "./bridge-adapter";
import type { EditorAdapterProvider } from "./registry";

const INPUT_SELECTOR = "textarea.inputarea, .native-edit-context";

export function createMonacoProvider(): EditorAdapterProvider {
  return {
    id: "monaco",

    findRoot(path): HTMLElement | null {
      return (
        path.find(
          (target): target is HTMLElement =>
            target instanceof HTMLElement && target.matches(INPUT_SELECTOR),
        ) ?? null
      );
    },

    create(root): PageApiAdapter | null {
      const adapter = new PageApiAdapter("monaco", root);
      return adapter.supported ? adapter : null;
    },
  };
}
