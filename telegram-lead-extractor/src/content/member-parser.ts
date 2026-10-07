import { ROLE_MARKERS, SELECTORS, log } from "../shared/constants";
import type { Lead, MemberRole } from "../shared/types";
import { queryFirst, visibleText } from "./dom-utils";

/**
 * Parses member rows into Lead records using ONLY information visibly rendered
 * in the Telegram Web UI. Kept isolated so DOM changes are absorbed here without
 * touching the scanning loop.
 */
export class MemberParser {
  /** Parse every currently rendered member row in the container. */
  parse(container: HTMLElement): Lead[] {
    const rows = this.findRows(container);
    const results: Lead[] = [];
    for (const row of rows) {
      const parsed = this.parseRow(row);
      if (parsed && isValidLead(parsed)) results.push(parsed);
    }
    log("parsed rows", rows.length, "->", results.length);
    return results;
  }

  private findRows(container: HTMLElement): HTMLElement[] {
    const rows = Array.from(container.querySelectorAll<HTMLElement>(SELECTORS.memberRow.join(",")));
    // Keep only rows that look like real members (have a name and/or peer id).
    return rows.filter((row) => !isSectionHeader(row));
  }

  private parseRow(row: HTMLElement): Lead | null {
    const name = this.parseName(row);
    const username = this.parseUsername(row);
    const phone = this.parsePhone(row);
    const telegramId = this.parseTelegramId(row);
    const role = this.parseRole(row);

    if (!name && !username && !telegramId) return null;

    return {
      name: name ?? null,
      username,
      phone,
      telegramId,
      role,
      source: "visible-ui",
    };
  }

  /** Name priority: peer-title element > aria-label > first meaningful text. */
  parseName(element: HTMLElement): string | null {
    const titled = queryFirst([".peer-title", '[class*="peer-title"]', "[title]"], element);
    const fromTitle = (titled?.getAttribute("title") ?? "").trim() || visibleText(titled);
    if (fromTitle) return cleanName(fromTitle);

    const aria = element.getAttribute("aria-label");
    if (aria && aria.trim()) return cleanName(aria);

    return null;
  }

  /** Username from a dedicated element, an @token in text, or a profile link. */
  parseUsername(element: HTMLElement): string | null {
    const userEl = queryFirst([".peer-name", ".username", '[class*="user-name"]'], element);
    const fromEl = extractUsername(visibleText(userEl));
    if (fromEl) return fromEl;

    // Links sometimes carry the handle (e.g. t.me/username or #username).
    const link = element.querySelector<HTMLElement>("a[href]");
    const fromLink = link ? extractUsername(link.getAttribute("href") ?? "") : null;
    if (fromLink) return fromLink;

    return extractUsername(visibleText(element));
  }

  /** Phone only when actually rendered as visible text (rare in Telegram). */
  parsePhone(element: HTMLElement): string | null {
    const phoneEl = queryFirst([".phone", '[class*="phone"]'], element);
    const text = phoneEl ? visibleText(phoneEl) : "";
    return text ? extractPhone(text) : null;
  }

  /** Numeric peer/user id from data attributes or href patterns. */
  parseTelegramId(element: HTMLElement): string | null {
    const direct = element.getAttribute("data-peer-id") || element.getAttribute("data-id");
    if (direct && /^\d+$/.test(direct)) return direct;

    const inner = element.querySelector<HTMLElement>("[data-peer-id], [data-id]");
    const innerVal = inner?.getAttribute("data-peer-id") || inner?.getAttribute("data-id");
    if (innerVal && /^\d+$/.test(innerVal)) return innerVal;

    const link = element.querySelector<HTMLElement>("a[href]");
    const href = link?.getAttribute("href") ?? "";
    const m = href.match(/(?:openPeer=[^,]*,|\/)(\d{3,})/);
    return m ? m[1] : null;
  }

  /** Role from visible badges/labels. Defaults to "member" for valid rows. */
  parseRole(element: HTMLElement): MemberRole {
    const text = `${element.getAttribute("aria-label") ?? ""} ${visibleText(element)}`;
    for (const marker of ROLE_MARKERS) {
      if (marker.pattern.test(text)) return marker.role as MemberRole;
    }
    return "member";
  }
}

/** Section headers / "Add member" rows are not members. */
function isSectionHeader(row: HTMLElement): boolean {
  const text = visibleText(row).toLowerCase();
  if (/^(add (member|people|users)|admins?|bots?|all members|no results)\b/.test(text)) return true;
  // Rows with an input/button but no peer name are controls, not members.
  const hasPeer = row.matches("[data-peer-id]") || row.querySelector("[data-peer-id], .peer-title, [class*='peer-title']");
  if (!hasPeer && /add member|invite|search/.test(text)) return true;
  return false;
}

/** Strip role/username suffixes that leak into a name label. */
function cleanName(value: string): string | null {
  let out = value.replace(/\s*[•·|]\s*(admin|owner|bot|creator)\b/gi, "").trim();
  out = out.replace(/,\s*(admin|owner|bot|creator)\b/gi, "").trim();
  return out || null;
}

/** Extract and normalize a @username (no leading '@'); validate shape. */
export function extractUsername(text: string): string | null {
  if (!text) return null;
  const m = text.match(/(^|\s)@([A-Za-z][A-Za-z0-9_]{4,31})/);
  if (m) return m[2];
  const tme = text.match(/(?:t\.me\/|openPeer=[^,]*,|[/?#])([A-Za-z][A-Za-z0-9_]{4,31})(?:\b)/);
  if (tme && !/^\d+$/.test(tme[1])) return tme[1];
  return null;
}

/**
 * Extract the first phone-like token from visible text. Conservative: requires
 * 7+ digits with an optional leading +. Returns null when none is present.
 */
export function extractPhone(text: string): string | null {
  if (!text) return null;
  const match = text.match(/(\+?\d[\d\s().-]{6,}\d)/);
  if (!match) return null;
  const candidate = match[1].trim();
  const digits = candidate.replace(/\D/g, "");
  return digits.length >= 7 ? candidate : null;
}

/** A lead is exportable if it has a name and at least one identifier. */
export function isValidLead(p: Lead): boolean {
  const hasName = Boolean(p.name && p.name.length);
  const hasId = Boolean(p.username || p.phone || p.telegramId);
  return hasName && hasId;
}

/**
 * Stable dedupe key. Telegram id is preferred; then username; then phone; then
 * a name fingerprint so distinct people never merge.
 */
export function createLeadKey(p: Lead): string {
  if (p.telegramId) return `id:${p.telegramId}`;
  if (p.username) return `user:${p.username.toLowerCase()}`;
  if (p.phone) {
    const digits = p.phone.replace(/\D/g, "");
    if (digits.length >= 7) return `phone:${digits}`;
  }
  return `name:${(p.name ?? "").trim().toLowerCase()}`;
}
