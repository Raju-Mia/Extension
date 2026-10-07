/**
 * Centralized tunable limits, selectors, and the development logger.
 * Selectors are arrays so a single failing strategy can fall back to the next.
 */

export const DEFAULT_SETTINGS = {
  scrollDelay: 350,
  maxScanTimeSec: 900,
  autoOpenGroupInfo: true,
  includeSelf: true,
  preferredFormat: "csv" as "csv" | "json",
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
  // Throttle progress messages so a 10k-member scan does not flood the runtime.
  PROGRESS_THROTTLE_MS: 250,
  MAX_LIST_HEIGHT_PX: 1_000_000,
};

/**
 * Selector strategies. WhatsApp's generated class names change frequently, so
 * we prefer aria/data attributes, roles, and visible text over hashed classes.
 * Each list is tried in order until one yields results.
 */
export const SELECTORS = {
  /** Sign that WhatsApp Web main UI is loaded (chat list pane present). */
  appReady: ['div#pane-side', '[aria-label="Chat list"]', '[data-tab="3"]'],

  /** The right-hand conversation pane (header + messages + optional drawer). */
  mainPane: ['#main', 'div[id="main"]', 'main[aria-label]'],

  /** Active chat header title (contains the group/participant name). */
  chatHeaderTitle: [
    'span[dir="auto"][title]',
    'header span[title]',
    'header [dir="auto"]',
    '#main header span[dir="auto"]',
  ],

  /** The chat header bar itself, used to find the info/menu buttons. */
  chatHeader: [
    "#main header",
    'div[id="main"] header',
    'header[role="banner"]',
    '[data-testid="chat-header-info"]',
  ],

  /** Group-info opening button (header avatar / title click target). */
  groupInfoButton: [
    'header [role="button"][aria-label]',
    "#main header [data-id]",
    "#main header [role='button']",
  ],

  /** Panel that lists participants once group info is opened. */
  participantsSection: [
    '[aria-label="Group participants"]',
    '[data-modal-tab="true"] [role="list"]',
    '[aria-label="See all participants"]',
  ],

  /** Button that expands an abbreviated participant list ("View all N"). */
  viewAllParticipants: [
    'button[aria-label*="articipants" i]',
    '[role="button"][aria-label*="articipants" i]',
  ],

  /** A single participant row inside the participants list. */
  participantRow: [
    '[role="listitem"]',
    '[data-testid="contact"]',
    'div[role="button"][aria-label]',
  ],
} as const;

/** Text markers used to detect roles from visible labels. */
export const ROLE_MARKERS: Array<{ pattern: RegExp; role: string }> = [
  { pattern: /\badmin\b/i, role: "Admin" },
  { pattern: /\bgroup admin\b/i, role: "Admin" },
  { pattern: /\byou\b/i, role: "You" },
];

/**
 * Visible-text markers that only appear for a GROUP (never an individual
 * chat). Matched against the whole conversation pane so we do not depend on a
 * single fragile header selector.
 */
export const GROUP_TEXT_MARKERS: RegExp[] = [
  /\bexit group\b/i,
  /\bgroup participants\b/i,
  /\bsee member changes\b/i,
  /\badd participants?\b/i,
  /\badd members?\b/i,
  /\binvite to group\b/i,
  /\bgroup admin\b/i,
  /\bclick here for group info\b/i,
  /\bgroup icon\b/i,
  /\bcreate a similar group\b/i,
  /\b\d+\s+(members?|participants?)\b/i,
];

/**
 * A header subtitle that previews members ("Mobarak, Nirjhor, You") is a
 * strong group signal; individual chats show a phone/last-seen instead.
 */
export const GROUP_SUBTITLE_PATTERN = /(^|,\s*)You\b|\bYou(,|\s*$)/i;

/** Dev logger; silent unless DEBUG is true, and never logs participant data. */
export const DEBUG = false;

export function log(...args: unknown[]): void {
  if (DEBUG) {
    console.log("[WhatsApp Exporter]", ...args);
  }
}
