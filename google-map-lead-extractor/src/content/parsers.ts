import { EMAIL_RE, SELECTORS, SOCIAL_PATTERNS, STATUS_MARKERS, log } from "../shared/constants";
import type { Business, QueuedPlace } from "../shared/types";
import { derivePlaceId, normalizePhone, normalizePhoneList } from "../utils/normalize";
import { absoluteHref, queryAll, queryFirst, visibleText } from "./dom-utils";

/**
 * Reads Google Maps' result cards and place panel. Every accessor uses the
 * ordered fallback arrays in SELECTORS and returns null (never a guess) when a
 * field is genuinely absent. Because Maps ships hashed class names that churn,
 * we lean on roles, aria-labels, data-item-id tokens, and href/tel patterns.
 */

/** A partially-filled record; unset fields are dropped before merging. */
type PartialRecord = Partial<Business>;

/** Strip a leading "Label:" prefix that Maps puts in aria-labels. */
function stripLabel(text: string): string {
  return text.replace(/^\s*[A-Z][\w ]*:\s*/i, "").trim();
}

/** Unwrap a Google redirect (/url?q=, /aclk, /a/clk?url=) to the real target host. */
function resolveExternalHref(href: string | null): string | null {
  if (!href) return null;
  try {
    const u = new URL(href, location.href);
    if (/\.google\.(com|[a-z]{2})$/.test(u.hostname) || u.hostname === "google.com") {
      const target = u.searchParams.get("url") || u.searchParams.get("q");
      if (target) {
        const real = new URL(target, location.href);
        if (/\.google\.(com|[a-z]{2})$/.test(real.hostname) || real.hostname === "gstatic.com" || real.hostname === "goo.gl") return null;
        return real.href;
      }
      return null; // internal Maps/Google link, not a business website
    }
    // A genuine external site — accept only http(s).
    if (/^https?:$/.test(u.protocol)) return u.href;
    return null;
  } catch {
    return null;
  }
}

/** Fallback: pull a bare domain out of a "Website: example.com" aria-label. */
function websiteFromLabel(label: string | null): string | null {
  if (!label) return null;
  const m = label.match(/(?:website|url):\s*([\w.-]+\.[a-z]{2,})/i);
  if (!m) return null;
  const host = m[1].toLowerCase();
  if (/google|gstatic|goo\.gl/.test(host)) return null;
  return /^https?:\/\//.test(host) ? host : `https://${host}`;
}

/** Extract lat/lng embedded in a place URL as !3d{lat}!4d{lng}. */
function coordsFromUrl(url: string): { latitude: string | null; longitude: string | null } {
  try {
    const decoded = decodeURIComponent(url);
    const m = decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (m) return { latitude: m[1], longitude: m[2] };
    const at = decoded.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (at) return { latitude: at[1], longitude: at[2] };
  } catch {
    /* ignore */
  }
  return { latitude: null, longitude: null };
}

/** A Plus Code looks like "8FPJ+2CR Dhaka". */
function plusCodeFromText(text: string): string | null {
  const m = text.match(/\b[\p{L}\d]{4}\+[\p{L}\d]{2}\b(?:\s+[\p{L} ]{2,})?/u);
  return m ? m[0].trim() : null;
}

/**
 * Parse every result card currently rendered in the feed. Returns one entry per
 * place link with the fields visible on the card (name, category, rating,
 * reviews). Duplicate cards inside the same snapshot are collapsed by placeId.
 */
export function parseResultCards(): QueuedPlace[] {
  const anchors = queryAll(SELECTORS.resultCardLink).filter(
    (a): a is HTMLAnchorElement => a instanceof HTMLAnchorElement && /\/maps\/place\//.test(a.href),
  );

  const out = new Map<string, QueuedPlace>();
  for (const anchor of anchors) {
    const url = absoluteHref(anchor);
    if (!url) continue;
    const name = (anchor.getAttribute("aria-label") || visibleText(anchor)).trim() || null;
    // Card body sits near the anchor; grab its text for category/rating hints.
    const card = anchor.closest<HTMLElement>('div[jsaction*="mouseover"], div.Nv2PK, div[role="article"], li') ?? anchor.parentElement;
    const cardText = card ? visibleText(card) : "";

    const category = parseCategoryFromCard(cardText, name);
    const rating = parseRatingFromText(cardText);
    const reviewCount = parseReviewsFromText(cardText);
    const placeId = derivePlaceId(url, name, null);

    if (!out.has(placeId)) {
      out.set(placeId, { placeId, url, name, category, rating, reviewCount });
    }
  }
  return Array.from(out.values());
}

function parseCategoryFromCard(cardText: string, name: string | null): string | null {
  if (!cardText) return null;
  // Cards read like "Name · Category · Address"; the token after the name is the category.
  if (name) {
    const idx = cardText.indexOf(name);
    if (idx >= 0) {
      const rest = cardText.slice(idx + name.length);
      const parts = rest.split("·").map((s) => s.trim()).filter(Boolean);
      if (parts.length) return parts[0];
    }
  }
  return null;
}

function parseRatingFromText(text: string): string | null {
  const m = text.match(/(?:^|\s)([0-5](?:\.\d)?)\s*(?:\(|★|star)/i) || text.match(/\b([0-5]\.\d)\b/);
  return m ? m[1] : null;
}

function parseReviewsFromText(text: string): string | null {
  const m = text.match(/\(([\d,.]+)\)/) || text.match(/([\d,.]+)\s*reviews?/i);
  return m ? m[1].replace(/,/g, "") : null;
}

/** Read the currently displayed place panel into a partial Business record. */
export function parsePlacePanel(url: string, searchQuery: string | null): PartialRecord {
  const root = queryFirst(SELECTORS.placePanel) ?? document.body;
  const record: PartialRecord = { source: "google-maps", mapsUrl: url, searchQuery, extractedAt: new Date().toISOString() };

  record.businessName = textOrNull(queryFirst(SELECTORS.placeName, root), (t) => t);

  record.category = textOrNull(queryFirst(SELECTORS.placeCategory, root), (t) => t);

  const { normalized, original } = parsePhone(root);
  record.phone = normalized;
  record.phoneOriginal = original;

  record.website = parseWebsite(root);

  record.address = parseAddress(root);

  // Email + social: check any links the Maps panel exposes directly, then fall
  // back to scanning visible text. Website enrichment (opt-in) later fills gaps.
  const socials = parsePanelSocialLinks(root);
  record.facebook = socials.facebook;
  record.instagram = socials.instagram;
  record.linkedin = socials.linkedin;
  record.youtube = socials.youtube;
  record.tiktok = socials.tiktok;

  const rootText = visibleText(root);
  record.email = parseEmail(root, rootText);

  record.rating = textOrNull(queryFirst(SELECTORS.placeRating, root), (t) => {
    const m = t.match(/[0-5](?:\.\d)?/);
    return m ? m[0] : null;
  });

  record.reviewCount = textOrNull(queryFirst(SELECTORS.placeReviews, root), (t) => {
    const m = t.match(/[\d,.]+/);
    return m ? m[0].replace(/,/g, "") : null;
  });

  record.openingHours = parseHours(root);
  record.services = parseList(queryFirst(SELECTORS.placeServices, root));
  record.description = textOrNull(queryFirst(SELECTORS.placeDescription, root), (t) => t);

  const status = parseStatus(root);
  record.businessStatus = status;

  record.plusCode = textOrNull(null, () => plusCodeFromText(rootText));

  const { latitude, longitude } = coordsFromUrl(url);
  record.latitude = latitude;
  record.longitude = longitude;

  // Strip empty keys so merge() never overwrites good data with a null.
  (Object.keys(record) as Array<keyof Business>).forEach((k) => {
    if (record[k] === null || record[k] === undefined) delete record[k];
  });

  log("parsed place panel", record.businessName);
  return record;
}

function textOrNull(el: HTMLElement | null, map: (t: string) => string | null): string | null {
  if (!el) return null;
  const raw = map(stripLabel(el.getAttribute("aria-label") || "")) || map(visibleText(el));
  return raw && raw.length ? raw : null;
}

function parsePhone(root: ParentNode): { normalized: string | null; original: string | null } {
  const btn = queryFirst(SELECTORS.placePhone, root);
  const itemId = btn?.getAttribute("data-item-id") ?? null; // "phone:tel:+880..."
  let raw: string | null = null;
  if (itemId && itemId.includes("tel:")) raw = itemId.slice(itemId.indexOf("tel:") + 4);
  if (!raw) raw = queryFirst(['a[href^="tel:"]'], root)?.getAttribute("href")?.replace(/^tel:/, "") ?? null;
  const original = btn ? (stripLabel(btn.getAttribute("aria-label") || "") || visibleText(btn) || raw) : raw;
  return { normalized: normalizePhoneList(raw), original: original ? normalizeDisplay(original) : null };
}

function normalizeDisplay(value: string): string | null {
  // Preserve the human-readable spacing, but only if it actually looks like a number.
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed && normalizePhone(trimmed) ? trimmed : null;
}

/** Website: resolve the authority link, then fall back to its aria-label domain. */
function parseWebsite(root: ParentNode): string | null {
  const el = queryFirst(SELECTORS.placeWebsite, root);
  if (!el) return null;
  const href = el.getAttribute("href");
  return resolveExternalHref(href) ?? websiteFromLabel(el.getAttribute("aria-label"));
}

/**
 * Email sources, in priority order: a direct mailto/email affordance shown in
 * Maps, or a valid address embedded in the visible panel text. Never fabricated
 * — blank if none found.
 */
function parseEmail(root: ParentNode, text: string): string | null {
  const el = queryFirst(SELECTORS.placeEmail, root);
  if (el) {
    const href = el.getAttribute("href");
    if (href?.startsWith("mailto:")) {
      const addr = href.slice(7).split("?")[0].trim();
      if (EMAIL_RE.test(addr)) return addr;
    }
    const aria = stripLabel(el.getAttribute("aria-label") || "");
    const inAria = aria.match(EMAIL_RE)?.[0];
    if (inAria) return inAria;
  }
  const found = text.match(EMAIL_RE);
  if (found) {
    const junk = /\.(png|jpe?g|gif|svg|webp|css|js)$/i;
    const clean = Array.from(new Set(found.map((e) => e.toLowerCase()))).filter(
      (e) => !junk.test(e) && !/sentry|wixpress|example\.|schema\.org|@2x|@3x|yourdomain|domain\.com|godaddy/i.test(e),
    );
    if (clean.length) return clean.slice(0, 2).join("; ");
  }
  return null;
}

type SocialMap = Record<"facebook" | "instagram" | "linkedin" | "youtube" | "tiktok", string | null>;

/** Facebook / Instagram etc that some businesses list directly in the Maps panel. */
function parsePanelSocialLinks(root: ParentNode): SocialMap {
  const empty: SocialMap = { facebook: null, instagram: null, linkedin: null, youtube: null, tiktok: null };
  const anchors = queryAll(SELECTORS.placeLinks, root);
  const hrefs = anchors
    .map((a) => a.getAttribute("href"))
    .filter((h): h is string => !!h && /^https?:/i.test(h))
    .map((h) => resolveExternalHref(h) ?? h);
  if (!hrefs.length) return empty;
  const corpus = hrefs.join(" ");
  const out = { ...empty };
  for (const { key, re } of SOCIAL_PATTERNS) {
    const m = corpus.match(re);
    if (m) out[key] = m[0].replace(/[).,;'"]+$/, "");
  }
  return out;
}

function parseAddress(root: ParentNode): string | null {
  const btn = queryFirst(SELECTORS.placeAddress, root);
  if (!btn) return null;
  const aria = btn.getAttribute("aria-label");
  if (aria) {
    const cleaned = stripLabel(aria);
    if (cleaned) return cleaned;
  }
  const itemId = btn.getAttribute("data-item-id");
  if (itemId && itemId.startsWith("address:")) {
    return decodeURIComponent(itemId.slice("address:".length)).trim() || null;
  }
  return visibleText(btn) || null;
}

function parseHours(root: ParentNode): string | null {
  const nodes = queryAll(SELECTORS.placeHours, root);
  for (const n of nodes) {
    const aria = n.getAttribute("aria-label");
    if (aria && /hour/i.test(aria)) return stripLabel(aria);
  }
  const text = nodes.map(visibleText).filter(Boolean).join("; ");
  return text || null;
}

function parseList(el: HTMLElement | null): string | null {
  if (!el) return null;
  const items = Array.from(el.querySelectorAll<HTMLElement>("li, .bsbp, [aria-hidden]")).map(visibleText).filter(Boolean);
  const joined = (items.length ? Array.from(new Set(items)) : [visibleText(el)]).filter(Boolean).join("; ");
  return joined || null;
}

function parseStatus(root: HTMLElement): string | null {
  // Prefer an explicit aria-label, then scan visible text for known markers.
  const labelled = queryFirst(['span[aria-label*="Open" i]', 'span[aria-label*="Closed" i]', 'div[aria-label*="status" i]'], root);
  if (labelled) {
    const aria = labelled.getAttribute("aria-label") || "";
    const m = aria.match(/\b(permanently closed|temporarily closed|closed|open (?:24 hours|now|at .*|until .*)|opens soon|closing soon|closes soon)\b/i);
    if (m) return titleCase(m[0]);
  }
  const text = visibleText(root);
  for (const { pattern, status } of STATUS_MARKERS) {
    if (pattern.test(text)) return status;
  }
  return null;
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}
