import { DEFAULT_SETTINGS, STORAGE_KEYS, type Settings } from "../shared/constants";

/** Read settings, merged over defaults so new keys never break old storage. */
export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.settings);
  const value = stored?.[STORAGE_KEYS.settings] as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...(value ?? {}) };
}

/** Persist the full settings object. */
export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
}
