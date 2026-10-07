import type { Business } from "../shared/types";

/**
 * Pure, dependency-free normalization helpers shared by the content parsers and
 * the storage layer. Kept free of the `chrome` API so they can be unit-smoke
 * tested in isolation (see README "Testing").
 */

/** A blank record skeleton. Missing fields stay null (never fake data). */
export function emptyBusiness(placeId: string): Business {
  return {
    placeId,
    businessName: null,
    category: null,
    phone: null,
    phoneOriginal: null,
    email: null,
    website: null,
    facebook: null,
    instagram: null,
    linkedin: null,
    youtube: null,
    tiktok: null,
    rating: null,
    reviewCount: null,
    businessStatus: null,
    openingHours: null,
    services: null,
    description: null,
    address: null,
    plusCode: null,
    latitude: null,
    longitude: null,
    mapsUrl: null,
    searchQuery: null,
    extractedAt: new Date().toISOString(),
    source: "google-maps",
  };
}

/**
 * Normalize a phone number to a dial-friendly form: keep a leading '+' and the
 * digits, drop spaces, dashes, dots and parentheses.
 *   "09666-787807"    -> "09666787807"
 *   "+880 1711-111111" -> "+8801711111111"
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const plus = trimmed.startsWith("+") ? "+" : "";
  const digits = trimmed.replace(/\D+/g, "");
  if (!digits) return null;
  return `${plus}${digits}`;
}

/** Normalize a displayed phone; collapse surrounding labels like "Phone: ". */
export function normalizePhoneList(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const parts = raw
    .split(/[;,]/)
    .map((p) => normalizePhone(p))
    .filter((p): p is string => Boolean(p));
  return parts.length ? Array.from(new Set(parts)).join("; ") : null;
}

/** Turn a display phone into a stable alt-dedupe key (normalized or null). */
export function phoneKey(phone: string | null): string | null {
  const n = normalizePhone(phone);
  return n ? n : null;
}

/**
 * Derive a stable dedupe key for a Maps place.
 * Prefers Google's own ids embedded in the place URL (cid / data cid), then
 * falls back to a normalized "name|address" composite.
 */
export function derivePlaceId(url: string | null, name: string | null, address: string | null): string {
  if (url) {
    const cid = url.match(/!1s12!5e[0-9]!3m2!1s([^/!]+)/) || url.match(/cid=0x[0-9a-fA-F]+:0x([0-9a-fA-F]+)/);
    if (cid && cid[1]) return `cid:${cid[1].toLowerCase()}`;
    const decoded = safeDecode(url);
    const marker = decoded.match(/\/maps\/place\/([^/]+)/);
    const coord = decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (marker) {
      const label = marker[1].replace(/\+/g, " ").trim().toLowerCase();
      if (coord) return `place:${label}@${coord[1]},${coord[2]}`;
      if (label) return `place:${label}`;
    }
  }
  const n = (name ?? "").trim().toLowerCase();
  const a = (address ?? "").trim().toLowerCase();
  if (n || a) return `nm:${n}|${a}`;
  return url ? `url:${safeDecode(url)}` : `id:${Date.now()}`;
}

/** An alternate identity used to catch the same business across layouts. */
export function altKey(b: Business): string | null {
  const n = (b.businessName ?? "").trim().toLowerCase();
  const p = phoneKey(b.phone);
  if (n && p) return `np:${n}|${p}`;
  const a = (b.address ?? "").trim().toLowerCase();
  if (n && a) return `na:${n}|${a}`;
  return null;
}

/**
 * Merge a freshly parsed record into an existing one: fill only fields that are
 * still empty, so a later, richer page-load never erases earlier data. The
 * existing record's provenance (placeId, first-seen search query) is preserved.
 */
export function mergeBusiness(base: Business, patch: Partial<Business>): Business {
  const out: Business = { ...base };
  const target = out as unknown as Record<string, unknown>;
  (Object.keys(patch) as Array<keyof Business>).forEach((key) => {
    if (key === "placeId" || key === "source") return;
    const incoming = patch[key];
    if (incoming === null || incoming === undefined || incoming === "") return;
    const existing = target[key];
    if (existing === null || existing === undefined || existing === "") {
      target[key] = incoming;
    }
  });
  out.extractedAt = new Date().toISOString();
  return out;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
