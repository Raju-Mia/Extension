import type { Business, ExtractPhase, Session, Settings, Stats } from "./types";

/**
 * Central definition of every runtime message exchanged between the popup
 * window, the background worker, and the collector-tab content script. Keeping
 * them here avoids string drift across contexts.
 *
 * Flow (collector-tab architecture):
 *   popup  --START/PAUSE/RESUME/STOP/CLOSE_COLLECTOR/GET_SESSION/CLEAR_RESULTS-->  background
 *   background --CONTENT_START/PAUSE/RESUME/STOP-->  collector content script
 *   content  --AM_I_COLLECTOR-->  background         (handshake on every load)
 *   content  --ANALYZE_WEBSITE-->  background        (opt-in public-site fetch)
 *   content  --EXTRACT_PROGRESS/COMPLETE/ERROR-->    broadcast (popup + background listen)
 *
 * The content script owns the crawl and persists the Session + records to
 * chrome.storage.local; the background owns tab lifecycle and the handshake.
 */

export type Message =
  // Popup -> background
  | { type: "START"; searchUrl: string; searchQuery: string | null }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "STOP" }
  | { type: "CLOSE_COLLECTOR" }
  | { type: "GET_SESSION" }
  | { type: "CLEAR_RESULTS" }
  // Background -> content (collector tab)
  | { type: "CONTENT_START"; settings: Settings }
  | { type: "CONTENT_PAUSE" }
  | { type: "CONTENT_RESUME" }
  | { type: "CONTENT_STOP" }
  // Content -> background (handshake on load, and opt-in website analysis)
  | { type: "AM_I_COLLECTOR" }
  | { type: "ANALYZE_WEBSITE"; url: string }
  // Content -> broadcast
  | { type: "EXTRACT_PROGRESS"; stats: Stats; current: string | null; phase: ExtractPhase }
  | { type: "EXTRACT_COMPLETE"; stats: Stats }
  | { type: "EXTRACT_ERROR"; message: string };

/** Public contact info discovered on a business's own website (all optional). */
export interface WebsiteInfo {
  email: string | null;
  facebook: string | null;
  instagram: string | null;
  linkedin: string | null;
  youtube: string | null;
  tiktok: string | null;
}

/** Reply to AM_I_COLLECTOR: tells a freshly loaded content script what to do. */
export interface CollectorHandshake {
  /** True only for the tab the background designated as the collector. */
  isCollector: boolean;
  /** Current persisted session, or null when no crawl is active. */
  session: Session | null;
  /** Settings snapshot so the collector knows how to behave this load. */
  settings: Settings | null;
}

/** Reply to GET_SESSION. */
export type SessionResponse = Session | null;

/** Reply to ANALYZE_WEBSITE. */
export type WebsiteResponse = WebsiteInfo | null;

/** A full enriched record produced by a DETAILS page-load. */
export type CollectedRecord = Business;

export type { ExtractPhase };
