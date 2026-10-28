import type { ModeManager } from "../core/modes";
import {
  GOOGLE_DOCS_ATTACH_MESSAGE,
  GOOGLE_DOCS_DETACH_MESSAGE,
} from "../core/google-docs-bridge";
import type { GoogleDocsDebuggerResponse } from "../core/google-docs-bridge";
import { VimEngine } from "../core/vim-engine";
import { KeyboardController } from "../input/keyboard-controller";
import {
  DOCS_EVENT_FRAME_SELECTOR,
  createGoogleDocsProvider,
} from "./google-docs-adapter";
import { EditorAdapterRegistry } from "./registry";

export interface GoogleDocsSession {
  stop(): void;
}

export async function startGoogleDocsSession(
  modes: ModeManager,
): Promise<GoogleDocsSession | null> {
  const initialFrame = findEventFrame();
  if (!initialFrame || !readFrameBody(initialFrame)) {
    console.warn("[webvim] Google Docs editing frame is unavailable or cross-origin");
    return null;
  }

  let attachResult: GoogleDocsDebuggerResponse;
  try {
    attachResult = (await browser.runtime.sendMessage({
      type: GOOGLE_DOCS_ATTACH_MESSAGE,
    })) as GoogleDocsDebuggerResponse;
  } catch (error) {
    console.warn("[webvim] could not attach to Google Docs input", error);
    return null;
  }
  if (!attachResult?.ok) {
    console.warn(
      "[webvim] Google Docs input is unavailable",
      attachResult?.error ?? "Chrome debugger permission or attachment was denied",
    );
    return null;
  }

  let stopped = false;
  let observer: MutationObserver | null = null;
  let observedFrame: HTMLIFrameElement | null = null;
  let activeWindow: Window | null = null;
  let activeBody: HTMLElement | null = null;
  let controller: KeyboardController | null = null;

  const detachController = (): void => {
    const previous = controller;
    controller = null;
    activeWindow = null;
    activeBody = null;
    try {
      previous?.stop();
    } catch (error) {
      console.warn("[webvim] could not detach Google Docs keyboard handling", error);
    }
  };

  const onFrameLoad = (): void => synchronizeFrame();

  function synchronizeFrame(): void {
    if (stopped) return;

    const frame = findEventFrame();
    if (frame !== observedFrame) {
      observedFrame?.removeEventListener("load", onFrameLoad);
      observedFrame = frame;
      observedFrame?.addEventListener("load", onFrameLoad);
    }

    const frameBody = frame ? readFrameBody(frame) : null;
    const frameWindow = frame?.contentWindow ?? null;
    if (!frame || !frameBody || !frameWindow) {
      detachController();
      return;
    }

    if (frameWindow === activeWindow && frameBody === activeBody) return;
    detachController();

    const registry = new EditorAdapterRegistry([
      createGoogleDocsProvider(frameBody),
    ]);
    const nextController = new KeyboardController(
      new VimEngine(modes),
      registry,
      frameWindow,
    );

    try {
      nextController.start();
      controller = nextController;
      activeWindow = frameWindow;
      activeBody = frameBody;
    } catch (error) {
      try {
        nextController.stop();
      } catch (stopError) {
        console.warn("[webvim] could not clean up Google Docs frame", stopError);
      }
      console.warn("[webvim] Google Docs frame could not be attached", error);
    }
  }

  function containsEventFrame(node: Node): boolean {
    if (node.nodeType !== 1) return false;
    const element = node as Element;
    return (
      element.matches(DOCS_EVENT_FRAME_SELECTOR) ||
      Boolean(element.querySelector(DOCS_EVENT_FRAME_SELECTOR))
    );
  }

  synchronizeFrame();
  if (!controller) {
    try {
      await browser.runtime.sendMessage({ type: GOOGLE_DOCS_DETACH_MESSAGE });
    } catch (error) {
      warnUnlessContextInvalidated(
        "[webvim] could not release Google Docs debugger",
        error,
      );
    }
    return null;
  }

  observer = new MutationObserver((records) => {
    if (
      records.some((record) =>
        [...record.addedNodes, ...record.removedNodes].some(containsEventFrame),
      )
    ) {
      synchronizeFrame();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  return {
    stop(): void {
      if (stopped) return;
      stopped = true;
      observer?.disconnect();
      observer = null;
      observedFrame?.removeEventListener("load", onFrameLoad);
      observedFrame = null;
      detachController();
      try {
        void browser.runtime
          .sendMessage({ type: GOOGLE_DOCS_DETACH_MESSAGE })
          .catch((error: unknown) => {
            warnUnlessContextInvalidated(
              "[webvim] could not detach Google Docs input",
              error,
            );
          });
      } catch (error) {
        warnUnlessContextInvalidated(
          "[webvim] could not detach Google Docs input",
          error,
        );
      }
    },
  };
}

function warnUnlessContextInvalidated(message: string, error: unknown): void {
  const description = error instanceof Error ? error.message : String(error);
  if (description.includes("Extension context invalidated")) return;
  console.warn(message, error);
}

function findEventFrame(): HTMLIFrameElement | null {
  return document.querySelector<HTMLIFrameElement>(DOCS_EVENT_FRAME_SELECTOR);
}

function readFrameBody(frame: HTMLIFrameElement): HTMLElement | null {
  try {
    return frame.contentWindow?.document.body ?? null;
  } catch (error) {
    console.warn("[webvim] cannot access Google Docs editing frame", error);
    return null;
  }
}
