import { log } from "../shared/constants";
import type { CollectorHandshake, Message, WebsiteInfo } from "../shared/messages";
import { isMapsUrl } from "./maps-detector";
import { Extractor, type ExtractorDeps } from "./extractor";

/**
 * Content-script entry for the collector tab. On every load it asks the
 * background "am I the designated collector?" and, only if yes, resumes the
 * crawl exactly where the persisted session left off. It is inert on any other
 * Maps tab, so the user can keep their own Maps tab open untouched.
 */

let extractor: Extractor | null = null;
let booted = false;

function runtimeSend(message: Message): Promise<unknown> {
  return chrome.runtime.sendMessage(message).catch(() => undefined);
}

const deps: ExtractorDeps = {
  emit: (message) => {
    void runtimeSend(message);
  },
  requestWebsite: async (url) => {
    const res = (await runtimeSend({ type: "ANALYZE_WEBSITE", url })) as WebsiteInfo | null | undefined;
    return res ?? null;
  },
  navigate: (url) => {
    try {
      window.location.assign(url);
    } catch {
      /* navigation blocked; the resume handshake will retry on next load */
    }
  },
};

async function handshake(): Promise<CollectorHandshake | null> {
  const res = (await runtimeSend({ type: "AM_I_COLLECTOR" })) as CollectorHandshake | null | undefined;
  return res ?? null;
}

async function boot(): Promise<void> {
  if (booted) return;
  if (!isMapsUrl(location.href)) return;
  booted = true;

  const hs = await handshake();
  if (!hs || !hs.isCollector || !hs.session || !hs.settings) {
    log("not the collector tab — staying idle");
    return;
  }

  extractor = new Extractor(hs.session, hs.settings, deps);
  log("collector active; status =", hs.session.status, "cursor =", hs.session.cursor);

  switch (hs.session.status) {
    case "LIST":
      await extractor.runList();
      break;
    case "DETAILS":
      await extractor.runDetailStep();
      break;
    case "PAUSED":
      // Resident but waiting for CONTENT_RESUME.
      break;
    default:
      break;
  }
}

function onMessage(message: Message, sendResponse: (r: unknown) => void): void {
  switch (message.type) {
    case "CONTENT_PAUSE":
      extractor?.pause();
      sendResponse({ ok: true });
      break;
    case "CONTENT_RESUME":
      if (extractor) void extractor.resume();
      else {
        booted = false;
        void boot();
      }
      sendResponse({ ok: true });
      break;
    case "CONTENT_STOP":
      extractor?.stop();
      sendResponse({ ok: true });
      break;
    default:
      break;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  onMessage(message as Message, sendResponse);
  return true; // keep the channel open for the async reply
});

void boot();
log("content script loaded");
