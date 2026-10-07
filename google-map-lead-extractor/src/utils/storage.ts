import { DEFAULT_SETTINGS, STORAGE_KEYS, log } from "../shared/constants";
import type { Settings } from "../shared/types";
import type { Business, Session } from "../shared/types";
import { altKey, mergeBusiness } from "./normalize";

/**
 * chrome.storage.local access layer. Everything is local — nothing is ever sent
 * to a server. Records are keyed by a stable placeId, with an optional alternate
 * identity (name+phone / name+address) used to fold true duplicates together.
 */

/* ------------------------------------------------------------------ settings */

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

/* ------------------------------------------------------------------- session */

/** The persisted crawl session, or null. */
export async function loadSession(): Promise<Session | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.session);
  return (stored?.[STORAGE_KEYS.session] as Session | undefined) ?? null;
}

export async function saveSession(session: Session): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.session]: session });
}

export async function clearSession(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.session);
}

/** Patch a session in place, creating it if missing (used by both bg + content). */
export async function updateSession(patch: Partial<Session>): Promise<Session | null> {
  const current = await loadSession();
  if (!current) return null;
  const next: Session = { ...current, ...patch };
  await saveSession(next);
  return next;
}

/* ------------------------------------------------------------------- records */

/** All collected business records. */
export async function loadRecords(): Promise<Business[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.records);
  const value = stored?.[STORAGE_KEYS.records];
  return Array.isArray(value) ? (value as Business[]) : [];
}

export async function saveRecords(records: Business[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.records]: records });
}

export async function clearRecords(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.records);
}

export interface UpsertResult {
  total: number;
  added: number;
  updated: number;
  duplicates: number;
}

/**
 * Insert or merge records, keeping one row per real business.
 *
 * - Matches first by placeId (Google id / name+address composite).
 * - When `removeDuplicates` is on, also folds in rows that share an alternate
 *   identity (name+phone or name+address) so the same shop appearing twice does
 *   not create two export rows.
 * - Merging only fills empty fields, so a richer later page-load enriches an
 *   earlier partial capture without erasing anything.
 */
export async function upsertRecords(
  incoming: Business | Business[],
  options: { removeDuplicates: boolean },
): Promise<UpsertResult> {
  const list = Array.isArray(incoming) ? incoming : [incoming];
  const existing = await loadRecords();

  const byPlaceId = new Map<string, number>();
  const byAlt = new Map<string, number>();
  existing.forEach((b, i) => {
    byPlaceId.set(b.placeId, i);
    if (options.removeDuplicates) {
      const alt = altKey(b);
      if (alt) byAlt.set(alt, i);
    }
  });

  let added = 0;
  let updated = 0;
  let duplicates = 0;

  for (const record of list) {
    const alt = options.removeDuplicates ? altKey(record) : null;
    const idx = byPlaceId.get(record.placeId) ?? (alt ? byAlt.get(alt) : undefined);

    if (idx === undefined) {
      const newIndex = existing.length;
      existing.push(record);
      byPlaceId.set(record.placeId, newIndex);
      if (alt) byAlt.set(alt, newIndex);
      added += 1;
    } else {
      if (byAlt.get(alt ?? "") !== undefined && idx !== byPlaceId.get(record.placeId)) {
        duplicates += 1; // matched via alternate identity, not placeId
      }
      const merged = mergeBusiness(existing[idx], record);
      existing[idx] = merged;
      byPlaceId.set(merged.placeId, idx);
      updated += 1;
    }
  }

  await saveRecords(existing);
  log(`upsert: +${added} ~${updated} dup${duplicates} = ${existing.length} total`);
  return { total: existing.length, added, updated, duplicates };
}
