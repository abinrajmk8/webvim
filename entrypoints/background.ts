import {
  GOOGLE_DOCS_ATTACH_MESSAGE,
  GOOGLE_DOCS_DETACH_MESSAGE,
  GOOGLE_DOCS_DETACHED_MESSAGE,
  GOOGLE_DOCS_MOVE_MESSAGE,
} from "../core/google-docs-bridge";
import type { GoogleDocsMotion } from "../core/google-docs-bridge";

interface RuntimeMessage {
  readonly type?: unknown;
  readonly motion?: unknown;
}

interface ArrowKey {
  readonly key: string;
  readonly code: string;
  readonly virtualKeyCode: number;
  readonly modifiers: number;
}

const attachedTabs = new Set<number>();
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.userAgent);
const ARROW_KEYS: Readonly<Record<string, Omit<ArrowKey, "modifiers">>> = {
  left: { key: "ArrowLeft", code: "ArrowLeft", virtualKeyCode: 37 },
  down: { key: "ArrowDown", code: "ArrowDown", virtualKeyCode: 40 },
  up: { key: "ArrowUp", code: "ArrowUp", virtualKeyCode: 38 },
  right: { key: "ArrowRight", code: "ArrowRight", virtualKeyCode: 39 },
};

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((rawMessage, sender) => {
    const message = rawMessage as RuntimeMessage;
    if (
      message.type !== GOOGLE_DOCS_ATTACH_MESSAGE &&
      message.type !== GOOGLE_DOCS_DETACH_MESSAGE &&
      message.type !== GOOGLE_DOCS_MOVE_MESSAGE
    ) {
      return undefined;
    }

    return handleGoogleDocsMessage(message, sender);
  });

  chrome.debugger.onDetach.addListener((debuggee, reason) => {
    const tabId = debuggee.tabId;
    if (tabId === undefined || !attachedTabs.delete(tabId)) return;
    notifyDetached(tabId, reason);
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (
      attachedTabs.has(tabId) &&
      changeInfo.url &&
      !isGoogleDocsUrl(changeInfo.url)
    ) {
      void detachForNavigation(tabId);
    }
  });
});

async function handleGoogleDocsMessage(
  message: RuntimeMessage,
  sender: Browser.runtime.MessageSender,
): Promise<{ ok: boolean; error?: string }> {
  const tabId = sender.tab?.id;
  if (tabId === undefined || !isGoogleDocsUrl(sender.tab?.url ?? sender.url)) {
    return { ok: false, error: "The request did not come from a Google Docs tab" };
  }

  if (message.type === GOOGLE_DOCS_ATTACH_MESSAGE) {
    if (sender.frameId !== 0) {
      return { ok: false, error: "Debugger attachment is limited to the top frame" };
    }
    if (attachedTabs.has(tabId)) return { ok: true };

    try {
      await chrome.debugger.attach({ tabId }, "1.3");
      attachedTabs.add(tabId);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  }

  if (message.type === GOOGLE_DOCS_DETACH_MESSAGE) {
    if (sender.frameId !== 0 || !attachedTabs.has(tabId)) {
      return { ok: true };
    }
    try {
      await chrome.debugger.detach({ tabId });
      attachedTabs.delete(tabId);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  }

  const motion = asGoogleDocsMotion(message.motion);
  if (!motion || !attachedTabs.has(tabId)) {
    return { ok: false, error: "Google Docs input is not attached" };
  }

  const key = arrowForMotion(motion);
  if (!key) return { ok: false, error: "Unsupported Google Docs motion" };

  try {
    const debuggee = { tabId };
    await chrome.debugger.sendCommand(debuggee, "Input.dispatchKeyEvent", {
      type: "keyDown",
      key: key.key,
      code: key.code,
      windowsVirtualKeyCode: key.virtualKeyCode,
      nativeVirtualKeyCode: key.virtualKeyCode,
      modifiers: key.modifiers,
    });
    await chrome.debugger.sendCommand(debuggee, "Input.dispatchKeyEvent", {
      type: "keyUp",
      key: key.key,
      code: key.code,
      windowsVirtualKeyCode: key.virtualKeyCode,
      nativeVirtualKeyCode: key.virtualKeyCode,
      modifiers: key.modifiers,
    });
    return { ok: true };
  } catch (error) {
    await disableDebuggerAfterInputFailure(tabId, errorMessage(error));
    return { ok: false, error: errorMessage(error) };
  }
}

async function disableDebuggerAfterInputFailure(
  tabId: number,
  reason: string,
): Promise<void> {
  if (!attachedTabs.delete(tabId)) return;
  try {
    await chrome.debugger.detach({ tabId });
  } catch {
    // The debugger may already have detached as part of the failed command.
  }
  notifyDetached(tabId, reason);
}

function notifyDetached(tabId: number, reason: string): void {
  void browser.tabs
    .sendMessage(
      tabId,
      { type: GOOGLE_DOCS_DETACHED_MESSAGE, reason },
      { frameId: 0 },
    )
    .catch(() => undefined);
}

async function detachForNavigation(tabId: number): Promise<void> {
  if (!attachedTabs.has(tabId)) return;
  try {
    await chrome.debugger.detach({ tabId });
  } catch {
    // The tab may already have closed or detached during navigation.
  }
  if (attachedTabs.delete(tabId)) {
    notifyDetached(tabId, "navigated away from Google Docs");
  }
}

function arrowForMotion(motion: GoogleDocsMotion): ArrowKey | null {
  if (motion === "forward" || motion === "backward") {
    const key = ARROW_KEYS[motion === "forward" ? "right" : "left"];
    return { ...key, modifiers: IS_MAC ? 1 : 2 };
  }
  const key = ARROW_KEYS[motion];
  return key ? { ...key, modifiers: 0 } : null;
}

function asGoogleDocsMotion(value: unknown): GoogleDocsMotion | null {
  return value === "left" ||
    value === "right" ||
    value === "up" ||
    value === "down" ||
    value === "forward" ||
    value === "backward"
    ? (value as GoogleDocsMotion)
    : null;
}

function isGoogleDocsUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.hostname === "docs.google.com" &&
      url.pathname.startsWith("/document/")
    );
  } catch {
    return false;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
