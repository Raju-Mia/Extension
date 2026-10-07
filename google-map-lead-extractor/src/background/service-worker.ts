import { EMAIL_RE, SOCIAL_PATTERNS, log } from "../shared/constants";
import type { CollectorHandshake, Message, SessionResponse, WebsiteInfo } from "../shared/messages";
import type { Session, Stats } from "../shared/types";
import {
  clearRecords,
  clearSession,
  loadSession,
  loadSettings,
  saveSession,
  updateSession,
} from "../utils/storage";

/**
 * Background service worker (Manifest V3) — the collector-tab orchestrator.
 *
 * It does NO scraping and holds NO business rows of its own. Its jobs:
 *   1. Open the extraction in a SEPARATE, unfocused window so the user's own
 *      Maps tab is never touched.
 *   2. Answer the content script's AM_I_COLLECTOR handshake so exactly one tab
 *      drives the crawl and can resume across reloads.
 *   3. Relay PAUSE / RESUME / STOP / CLOSE and persist status transitions.
 *   4. Optionally fetch a business's own public website for contact/social
 *      links — only after the user granted the extra host permission.
 */

const POPUP_URL = "popup.html";
const ACTIVE = new Set(["LIST", "DETAILS", "PAUSED"]);

function emptyStats(): Stats {
  return { found: 0, processed: 0, newCount: 0, duplicates: 0, total: 0 };
}

/* --------------------------------------------------------------- collector */

async function forwardToCollector(tabId: number | null, message: Message): Promise<void> {
  if (tabId == null) return;
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    /* collector not reachable on this load; the resume handshake covers it */
  }
}

async function onStart(searchUrl: string, searchQuery: string | null): Promise<{ ok: boolean; error?: string }> {
  const session: Session = {
    status: "LIST",
    resumePhase: "LIST",
    searchQuery,
    searchUrl,
    collectorTabId: null,
    cursor: 0,
    placeUrls: [],
    startedAt: Date.now(),
    finishedAt: null,
    stats: emptyStats(),
  };
  try {
    const win = await chrome.windows.create({ url: searchUrl, type: "normal", focused: false, width: 1040, height: 800 });
    const tabs = win?.id != null ? await chrome.tabs.query({ windowId: win.id }) : [];
    const tab = tabs.find((t) => t.id != null);
    if (tab?.id == null) return { ok: false, error: "Could not open the collector window." };
    session.collectorTabId = tab.id;
    await saveSession(session);
    log("collector window opened", tab.id);
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not open the collector window." };
  }
}

async function onAmICollector(sender: chrome.runtime.MessageSender): Promise<CollectorHandshake> {
  const session = await loadSession();
  const tabId = sender.tab?.id;
  const isCollector = !!session && tabId != null && session.collectorTabId === tabId && ACTIVE.has(session.status);
  if (!isCollector || !session) return { isCollector: false, session: null, settings: null };
  const settings = await loadSettings();
  return { isCollector: true, session, settings };
}

async function onPause(): Promise<void> {
  const s = await loadSession();
  if (!s) return;
  const from = s.status === "DETAILS" || s.status === "LIST" ? s.status : s.resumePhase;
  await updateSession({ status: "PAUSED", resumePhase: from });
  await forwardToCollector(s.collectorTabId, { type: "CONTENT_PAUSE" });
}

async function onResume(): Promise<void> {
  const s = await loadSession();
  if (!s) return;
  const target = s.resumePhase === "DETAILS" ? "DETAILS" : "LIST";
  await updateSession({ status: target });
  await forwardToCollector(s.collectorTabId, { type: "CONTENT_RESUME" });
}

async function onStop(): Promise<void> {
  const s = await loadSession();
  if (!s) return;
  await updateSession({ status: "STOPPED", finishedAt: Date.now() });
  await forwardToCollector(s.collectorTabId, { type: "CONTENT_STOP" });
}

async function onCloseCollector(): Promise<void> {
  const s = await loadSession();
  if (s?.collectorTabId != null) {
    try {
      await chrome.tabs.remove(s.collectorTabId);
    } catch {
      /* already gone */
    }
  }
  await updateSession({ status: "STOPPED", collectorTabId: null, finishedAt: Date.now() });
}

async function handleTabClosed(tabId: number): Promise<void> {
  const s = await loadSession();
  if (s && s.collectorTabId === tabId && ACTIVE.has(s.status)) {
    await updateSession({ status: "STOPPED", finishedAt: Date.now() });
    chrome.runtime
      .sendMessage({ type: "EXTRACT_ERROR", message: "The collector window was closed. Your results so far are saved." })
      .catch(() => undefined);
  }
}

/* ------------------------------------------------------- website (opt-in) */

const EMPTY_WEBSITE: WebsiteInfo = {
  email: null,
  facebook: null,
  instagram: null,
  linkedin: null,
  youtube: null,
  tiktok: null,
};

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      credentials: "omit",
      headers: { Accept: "text/html,application/xhtml+xml,*/*" },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (ct && !/html|plain|xhtml/i.test(ct)) return null;
    const text = await res.text();
    return text.slice(0, 400_000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function contactLinks(html: string, origin: string): string[] {
  const out = new Set<string>();
  const re = /href=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.size < 6) {
    try {
      const u = new URL(m[1], origin);
      if (u.origin !== origin) continue;
      if (/(contact|about|reach|company|team)/i.test(u.pathname)) out.add(u.href);
    } catch {
      /* ignore malformed href */
    }
  }
  return Array.from(out);
}

function extractEmails(text: string): string {
  const found = text.match(EMAIL_RE) ?? [];
  const junk = /\.(png|jpe?g|gif|svg|webp|css|js)$/i;
  const uniq = Array.from(new Set(found.map((e) => e.toLowerCase()))).filter(
    (e) => !junk.test(e) && !/sentry|wixpress|example\.|schema\.org|@2x|@3x|yourdomain|domain\.com/i.test(e),
  );
  return uniq.length ? uniq.slice(0, 2).join("; ") : "";
}

type SocialKey = "facebook" | "instagram" | "linkedin" | "youtube" | "tiktok";

function findSocial(text: string, key: SocialKey): string {
  const pattern = SOCIAL_PATTERNS.find((s) => s.key === key);
  if (!pattern) return "";
  const m = text.match(pattern.re);
  return m ? m[0].replace(/[).,;'"]+$/, "") : "";
}

async function analyzeWebsite(rawUrl: string): Promise<WebsiteInfo> {
  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return EMPTY_WEBSITE;
  }
  const grant = await chrome.permissions.contains({ origins: [`${target.origin}/*`] }).catch(() => false);
  if (!grant) return EMPTY_WEBSITE; // user did not opt in to website extraction for this site

  const html = await fetchText(target.href);
  if (!html) return EMPTY_WEBSITE;
  let corpus = html;
  for (const link of contactLinks(html, target.origin).slice(0, 2)) {
    const extra = await fetchText(link);
    if (extra) corpus += `\n${extra}`;
  }
  return {
    email: extractEmails(corpus) || null,
    facebook: findSocial(corpus, "facebook") || null,
    instagram: findSocial(corpus, "instagram") || null,
    linkedin: findSocial(corpus, "linkedin") || null,
    youtube: findSocial(corpus, "youtube") || null,
    tiktok: findSocial(corpus, "tiktok") || null,
  };
}

/* ------------------------------------------------------------- UI window */

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
  await chrome.windows.create({ url: chrome.runtime.getURL(POPUP_URL), type: "popup", width: 400, height: 760, focused: true });
}

/* ----------------------------------------------------------- messaging */

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  switch (message.type) {
    case "START":
      void onStart(message.searchUrl, message.searchQuery).then(sendResponse);
      return true;
    case "PAUSE":
      void onPause().then(() => sendResponse({ ok: true }));
      return true;
    case "RESUME":
      void onResume().then(() => sendResponse({ ok: true }));
      return true;
    case "STOP":
      void onStop().then(() => sendResponse({ ok: true }));
      return true;
    case "CLOSE_COLLECTOR":
      void onCloseCollector().then(() => sendResponse({ ok: true }));
      return true;
    case "GET_SESSION":
      void loadSession().then((s) => sendResponse(s as SessionResponse));
      return true;
    case "CLEAR_RESULTS":
      void (async () => {
        await clearRecords();
        await clearSession();
        sendResponse({ ok: true });
      })();
      return true;
    case "AM_I_COLLECTOR":
      void onAmICollector(sender).then(sendResponse);
      return true;
    case "ANALYZE_WEBSITE":
      void analyzeWebsite(message.url).then((info) => sendResponse(info));
      return true;
    default:
      // EXTRACT_PROGRESS / EXTRACT_COMPLETE / EXTRACT_ERROR are broadcasts the
      // content script sends straight to the popup; nothing to do here.
      return false;
  }
});

chrome.runtime.onInstalled.addListener(() => log("installed"));
chrome.action.onClicked.addListener(() => void openOrFocusWindow());
chrome.tabs.onRemoved.addListener((tabId) => void handleTabClosed(tabId));
