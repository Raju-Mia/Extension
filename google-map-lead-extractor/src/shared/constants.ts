import type { Settings } from "./types";

/**
 * Centralized tunable limits, selectors, and the development logger.
 *
 * Google Maps' DOM is generated and changes frequently, and its two web
 * layouts behave similarly but not identically. Every selector below is an
 * ORDERED FALLBACK ARRAY: the code tries each strategy in turn and prefers
 * semantic/accessible signals (role, aria-label, data-item-id, href/tel/mailto
 * patterns, and visible labels) over hashed class names. Update the arrays here
 * rather than hardcoding selectors elsewhere.
 *
 * NOTE: these are best-effort and must be re-verified against the live DOM
 * during QA (see README "Known limitations").
 */

export const DEFAULT_SETTINGS: Settings = {
  maxBatches: 5,
  maxBusinesses: 100,
  extractDetails: true,
  extractWebsite: false,
  removeDuplicates: true,
  delayMs: 900,
  maxScanTimeSec: 1800,
  preferredFormat: "csv",
};

export type { Settings };

/** Bounds enforced on the options page and when reading settings. */
export const SETTINGS_RANGES = {
  maxBatches: { min: 1, max: 50 },
  maxBusinesses: { min: 1, max: 500 },
  delayMs: { min: 300, max: 5000 },
  maxScanTimeSec: { min: 60, max: 7200 },
} as const;

export const STORAGE_KEYS = {
  settings: "settings",
  session: "session",
  records: "records",
} as const;

/** Timing / termination guards. */
export const LIMITS = {
  // Stop scrolling the feed after this many consecutive steps with no new card.
  MAX_STABLE_SCROLLS: 6,
  FEED_WAIT_TIMEOUT: 15000,
  PLACE_WAIT_TIMEOUT: 12000,
  // Fraction of the feed viewport to scroll per step (slight overlap).
  SCROLL_RATIO: 0.9,
  PROGRESS_THROTTLE_MS: 400,
  // Persist collected records to storage every N new businesses.
  PERSIST_EVERY: 5,
  // Absolute cap so a runaway crawl can never exceed the configured maximum.
  MAX_PLACE_URLS: 1000,
};

/** Sign that a Maps results page (or place page) has rendered. */
export const SELECTORS = {
  mapsReady: ['div[role="feed"]', 'a[href*="/maps/place/"]', 'div[role="main"]', "#pane"],

  /** The scrollable left-hand results list. */
  resultsFeed: [
    'div[role="feed"]',
    '[aria-label="Search results"]',
    '[aria-label="Search Results"]',
    'div[role="main"][aria-label*="results" i]',
  ],

  /** A single result card's primary link (aria-label = name, href = place URL). */
  resultCardLink: ['a.hfpxzc', 'div[role="feed"] a[href*="/maps/place/"]', 'a[href*="/maps/place/"][aria-label]'],

  /** The opened place details panel. */
  placePanel: ['div[role="main"]', 'div[aria-label="Place details"]', "#pane"],

  /** Place name heading. */
  placeName: ["h1.DkEaL", 'div[role="main"] h1', "#pane h1", "h1[itemprop='name']"],

  /** Category label near the title. */
  placeCategory: [
    'div[role="main"] button[jsaction*="category"]',
    "div.DkEaL + button",
    'div[itemprop="businessCategory"]',
    "span.sYlXv span",
    'div[role="main"] .W48fs span',
  ],

  /** Phone affordance / tel links. */
  placePhone: [
    'button[data-item-id^="phone:tel:"]',
    'button[data-item-id="phone"]',
    'a[href^="tel:"]',
    'button[aria-label^="Phone"]',
    'button[aria-label^="Call"]',
    '[data-item-id^="phone:tel:"]',
  ],

  /** Website link. */
  placeWebsite: [
    'a[data-item-id="authority"]',
    'a[data-value="Website"]',
    'a[aria-label^="Website:"]',
    'a[itemprop="url"]',
    'button[data-item-id="authority"]',
    'a[class*="lCr1be"]',
  ],

  /** Email link (some businesses show email directly in Maps). */
  placeEmail: ['a[href^="mailto:"]', 'button[data-item-id^="email:"]', '[aria-label^="Email:"]'],

  /** Links section (Facebook, Instagram etc visible in Maps place panel). */
  placeLinks: [
    'div[data-attrid="place:/documentation/aboutme"] a[href^="http"]',
    'div[aria-label="Links"] a[href^="http"]',
    'a[data-item-id^="https://"]',
    'div[class*="YvebBb"] a[href^="http"]',
  ],

  /** Address row. */
  placeAddress: [
    'button[data-item-id="address"]',
    'div[aria-label^="Address"]',
    'div[itemprop="address"]',
    "div.XIfpRc",
    'button[aria-label^="Address"]',
  ],

  /** Rating + review count. */
  placeRating: ['div.F7nice span[aria-hidden="true"]', 'span[role="img"][aria-label*="star" i]', 'div[itemprop="aggregateRating"]'],
  placeReviews: ['span[aria-label*="review" i]', 'div.F7nice a span', 'a[href*="/reviews"] span'],

  /** Opening hours. */
  placeHours: ['div.t39EBf', 'button[data-item-id="oh"]', 'td[data-item-id^="oh:"]', 'div[aria-label*="Hours" i]'],

  /** Short description / about. */
  placeDescription: ['div[data-attrid*="description"] .W4Efsd', "div.mVDMX", 'div[class*="W2PFBf"]', "[itemprop='description']"],

  /** Services / attributes list. */
  placeServices: ['div[data-attrid*="services"]', 'ul.W48fs', 'div[aria-label*="Service" i]'],
} as const;

/** Text markers that indicate an "open now" style business status. */
export const STATUS_MARKERS: Array<{ pattern: RegExp; status: string }> = [
  { pattern: /\bopen (24 hours|now|closes)\b/i, status: "Open" },
  { pattern: /\bcloses? soon\b/i, status: "Closes soon" },
  { pattern: /\bclosed\b/i, status: "Closed" },
  { pattern: /\bpermanently closed\b/i, status: "Permanently closed" },
  { pattern: /\btemporarily closed\b/i, status: "Temporarily closed" },
];

/** Social URL detection applied to any outbound links found on a place/website. */
export const SOCIAL_PATTERNS: Array<{ key: "facebook" | "instagram" | "linkedin" | "youtube" | "tiktok"; re: RegExp }> = [
  { key: "facebook", re: /https?:\/\/(?:www\.|m\.)?(?:facebook\.com|fb\.com|fb\.me)\/[^\s"'<>]+/i },
  { key: "instagram", re: /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>]+/i },
  { key: "linkedin", re: /https?:\/\/(?:www\.|[\w-]+\.)?linkedin\.com\/[^\s"'<>]+/i },
  { key: "youtube", re: /https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\/[^\s"'<>]+/i },
  { key: "tiktok", re: /https?:\/\/(?:www\.|m\.)?tiktok\.com\/[^\s"'<>]+/i },
];

/** Email regex for public pages (mailto links and plain text). */
export const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Extract the search query from a Maps URL (/maps/search/... or ?q=). */
export function extractSearchQuery(url: string): string | null {
  try {
    const u = new URL(url);
    const q = u.searchParams.get("q") || u.searchParams.get("query");
    if (q) return q.replace(/\+/g, " ").trim();
    const m = u.pathname.match(/\/maps\/search\/([^/]+)/);
    if (m) return decodeURIComponent(m[1]).replace(/\+/g, " ").trim();
    return null;
  } catch {
    return null;
  }
}

/** Dev logger; silent unless DEBUG is true, and never logs collected business data. */
export const DEBUG = false;

export function log(...args: unknown[]): void {
  if (DEBUG) {
    console.log("[Maps Lead Extractor]", ...args);
  }
}
