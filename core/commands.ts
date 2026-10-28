export type LineOperator = "delete" | "yank";

export type CommandParseResult =
  | { readonly status: "none" }
  | { readonly status: "pending" }
  | { readonly status: "command"; readonly operator: LineOperator };

const NO_COMMAND: CommandParseResult = { status: "none" };
const PENDING: CommandParseResult = { status: "pending" };

/** Parses the supported two-key line operators without changing editor text. */
export class CommandParser {
  private pendingOperator: "d" | "y" | null = null;

  reset(): void {
    this.pendingOperator = null;
  }

  feed(key: string): CommandParseResult {
    if (this.pendingOperator) {
      const pending = this.pendingOperator;
      this.pendingOperator = null;
      if (key === pending) {
        return {
          status: "command",
          operator: pending === "d" ? "delete" : "yank",
        };
      }
    }

    if (key === "d" || key === "y") {
      this.pendingOperator = key;
      return PENDING;
    }

    return NO_COMMAND;
  }
}
