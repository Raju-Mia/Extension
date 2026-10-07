import { log } from "../shared/constants";

/**
 * Background service worker (Manifest V3). Kept intentionally thin: it does no
 * scraping, holds no member data, and makes no network requests.
 *
 * Its main job is to open the extractor UI in a STANDALONE WINDOW (rather than
 * the transient action popup, which closes the instant the user clicks another
 * tab). A real window stays open while the user navigates Telegram, so an
 * in-progress extraction can be watched without it disappearing.
 */

const POPUP_URL = "popup.html";

/** Find an already-open extractor window, if any (survives worker restarts). */
async function findExistingWindow(): Promise<chrome.windows.Window | null> {
  const target = chrome.runtime.getURL(POPUP_URL);
  const windows = await chrome.windows.getAll();
  for (const win of windows) {
    if (win.id === undefined) continue;
    const tabs = await chrome.tabs.query({ windowId: win.id });
    if (tabs.some((tab) => tab.url === target)) return win;
  }
  return null;
}

async function openOrFocusWindow(): Promise<void> {
  const existing = await findExistingWindow();
  if (existing?.id !== undefined) {
    await chrome.windows.update(existing.id, { focused: true });
    return;
  }
  await chrome.windows.create({
    url: chrome.runtime.getURL(POPUP_URL),
    type: "popup",
    width: 400,
    height: 720,
    focused: true,
  });
}

chrome.runtime.onInstalled.addListener(() => {
  log("installed");
});

// With no default_popup in the manifest, clicking the toolbar icon fires this.
chrome.action.onClicked.addListener(() => {
  void openOrFocusWindow();
});

// Keep the worker alive for message relaying; reply so senders never hang.
chrome.runtime.onMessage.addListener((_message, _sender, sendResponse) => {
  sendResponse({ ok: true });
  return false;
});
