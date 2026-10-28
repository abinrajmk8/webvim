export const WEBVIM_ENABLED_KEY = "webvimEnabled";
export const DEFAULT_WEBVIM_ENABLED = true;

export async function getWebVimEnabled(): Promise<boolean> {
  const stored = await browser.storage.local.get(WEBVIM_ENABLED_KEY);
  const value: unknown = stored[WEBVIM_ENABLED_KEY];

  return typeof value === "boolean" ? value : DEFAULT_WEBVIM_ENABLED;
}

export async function setWebVimEnabled(enabled: boolean): Promise<void> {
  await browser.storage.local.set({ [WEBVIM_ENABLED_KEY]: enabled });
}
