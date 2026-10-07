/**
 * Core data models shared across the background worker, content script, popup
 * window, options page, and results table. Only fields genuinely visible in the
 * Google Maps UI (or an opted-in public business website) are stored, and every
 * record carries a provenance marker. No field is ever filled with fake data.
 */

/** A single business collected from Google Maps search results. */
export interface Business {
  /** Stable dedupe key: Google cid/place id when present, else name+address. */
  placeId: string;
  businessName: string | null;
  category: string | null;
  /** Normalized phone (digits, leading + kept); null when not shown. */
  phone: string | null;
  /** Phone exactly as displayed in the UI. */
  phoneOriginal: string | null;
  email: string | null;
  website: string | null;
  facebook: string | null;
  instagram: string | null;
  linkedin: string | null;
  youtube: string | null;
  tiktok: string | null;
  rating: string | null;
  reviewCount: string | null;
  businessStatus: string | null;
  openingHours: string | null;
  services: string | null;
  description: string | null;
  address: string | null;
  plusCode: string | null;
  latitude: string | null;
  longitude: string | null;
  mapsUrl: string | null;
  searchQuery: string | null;
  /** ISO timestamp of when this record was captured/last merged. */
  extractedAt: string;
  /** Provenance marker. */
  source: "google-maps";
}

/** High-level state machine for a collection session. */
export type ExtractPhase =
  | "IDLE"
  | "LIST" // scrolling the results feed, collecting cards
  | "DETAILS" // opening each place panel to enrich fields
  | "COMPLETED"
  | "PAUSED"
  | "STOPPED"
  | "ERROR";

/** Live counters surfaced to the UI. */
export interface Stats {
  found: number; // unique businesses collected so far
  processed: number; // place panels opened/enriched so far
  newCount: number; // new cards seen in the latest scroll step
  duplicates: number; // cards skipped as duplicates
  total: number; // total place urls queued for detail enrichment
}

/**
 * A place card captured during the LIST phase, before its detail panel is
 * opened. The DETAILS crawl navigates to `url` (one page load each) and
 * enriches a full Business record from it.
 */
export interface QueuedPlace {
  /** Stable key derived from the cid/data-place-id in the URL, else name+address. */
  placeId: string;
  /** Absolute /maps/place/... URL for this business. */
  url: string;
  name: string | null;
  category: string | null;
  rating: string | null;
  reviewCount: string | null;
}

/** Persisted session so an extraction can resume after a reload/tab close. */
export interface Session {
  status: ExtractPhase;
  /** Phase to return to when resuming from a PAUSED status. */
  resumePhase: ExtractPhase;
  searchQuery: string | null;
  searchUrl: string | null;
  collectorTabId: number | null;
  /** Index into placeUrls for the DETAILS crawl cursor. */
  cursor: number;
  /** Place cards collected during the LIST phase, queued for enrichment. */
  placeUrls: QueuedPlace[];
  startedAt: number | null;
  finishedAt: number | null;
  stats: Stats;
}

/** User-tunable settings (options page + popup quick controls). */
export interface Settings {
  maxBatches: number;
  maxBusinesses: number;
  /** Open each Maps place panel to read phone/website/hours/etc. */
  extractDetails: boolean;
  /** Visit the business's own public website for email/social (permission-gated). */
  extractWebsite: boolean;
  removeDuplicates: boolean;
  delayMs: number;
  maxScanTimeSec: number;
  preferredFormat: "csv" | "excel" | "json";
}
