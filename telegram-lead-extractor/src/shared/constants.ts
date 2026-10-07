/**
 * Centralized tunable limits, selectors, and the development logger.
 * Selectors are ordered fallback arrays so one failing strategy yields to the
 * next. Telegram Web's DOM differs across its clients (/a/ React app and /k/
 * desktop-style), so each list tries the modern client first, then fallbacks.
 *
 * NOTE: these are best-effort and are re-verified against the live DOM during
 * QA (see plan §50). Update the arrays here rather than hardcoding elsewhere.
 */

export const DEFAULT_SETTINGS = {
  scrollDelay: 350,
  maxScanTimeSec: 900,
  autoOpenMemberList: true,
  includeSelf: true,
  preferredFormat: "csv" as "csv" | "excel" | "json",
  saveHistory: false,
};

export type Settings = typeof DEFAULT_SETTINGS;

/** Bounds enforced on the options page and when reading settings. */
export const SETTINGS_RANGES = {
  scrollDelay: { min: 100, max: 3000 },
  maxScanTimeSec: { min: 30, max: 3600 },
} as const;

export const STORAGE_KEYS = {
  settings: "settings",
} as const;

/** Timing / termination guards. Content script may override from settings. */
export const LIMITS = {
  // Large/virtualized lists need more patience before we trust "no new rows".
  MAX_STABLE_ITERATIONS: 8,
  DOM_UPDATE_TIMEOUT: 3000,
  ELEMENT_WAIT_TIMEOUT: 8000,
  // Fraction of the viewport to scroll per step (<1 keeps overlap so lazily
  // rendered rows are never skipped between jumps).
  SCROLL_OVERLAP_RATIO: 0.7,
  // Throttle progress messages so a huge channel does not flood the runtime.
  PROGRESS_THROTTLE_MS: 250,
  MAX_LIST_HEIGHT_PX: 5_000_000,
};

/**
 * Selector strategies. We prefer aria/data attributes, roles, href patterns,
 * and visible text over hashed/generated class names.
 */
export const SELECTORS = {
  /** Sign that Telegram Web main UI is loaded (chat list present). */
  appReady: [
    '[aria-label="Chat list"]',
    ".chat-column",
    ".chat-list",
    "#chatList",
    '[class*="chat-list"]',
  ],

  /** The opened-chat header bar (title + profile click target). */
  chatHeader: [
    ".chat-header",
    "header.chat-header",
    '[class*="chat-header"]',
    ".column-header",
  ],

  /** Active chat title element inside the header. */
  chatTitle: [
    ".peer-title",
    ".chat-header .peer-title",
    '[class*="peer-title"]',
    ".column-header .md-caption",
    "header [dir='auto']",
  ],

  /** Header click target that opens the profile / info panel. */
  chatInfoButton: [
    ".chat-header .peer-info",
    ".chat-header button[aria-label]",
    ".chat-header [role='button']",
    ".column-header .left",
  ],

  /** Button/row that opens the full member list modal. */
  membersOpenButton: [
    '[aria-label*="Member" i]',
    ".section-row",
    '[class*="members"]',
    ".profile-info .section-row",
  ],

  /** The member-list container (modal or sidebar) once open. */
  membersList: [
    '[aria-label="Members"]',
    ".user-list",
    ".members-modal",
    '[class*="user-list"]',
    ".chat-list:not(.chat-column)",
  ],

  /** A single member row inside the member list. */
  memberRow: [
    ".chat-list-item",
    ".list-item",
    '[data-peer-id]',
    ".user-list .chat-list-item",
  ],
} as const;

/** Text markers that indicate a group/channel (never a 1:1 direct chat). */
export const GROUP_TEXT_MARKERS: RegExp[] = [
  /\bmembers?\b/i,
  /\bsubscribers?\b/i,
  /\badd (member|people|users)\b/i,
  /\bview (members|group)\b/i,
  /\bgroup admin\b/i,
  /\bleave (group|channel)\b/i,
  /\bcopy (invite|link)\b/i,
  /\b\d[\d\s,.]*\s+(members|subscribers)\b/i,
];

/** Markers that specifically suggest a channel (subscribers wording). */
export const CHANNEL_TEXT_MARKERS: RegExp[] = [
  /\bsubscribers?\b/i,
  /\bleave channel\b/i,
  /\bunmute notifications\b/i,
];

/** Role wording detected from visible labels/badges on a member row. */
export const ROLE_MARKERS: Array<{ pattern: RegExp; role: string }> = [
  { pattern: /\b(owner|creator|created)\b/i, role: "owner" },
  { pattern: /\b(admin|administrator)\b/i, role: "admin" },
  { pattern: /\bbot\b/i, role: "bot" },
];

/** Dev logger; silent unless DEBUG is true, and never logs member data. */
export const DEBUG = false;

export function log(...args: unknown[]): void {
  if (DEBUG) {
    console.log("[Telegram Lead Extractor]", ...args);
  }
}
