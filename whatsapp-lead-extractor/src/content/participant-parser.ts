import { ROLE_MARKERS, SELECTORS, log } from "../shared/constants";
import type { Participant } from "../shared/types";
import { queryAll, queryFirst, visibleText } from "./dom-utils";

/**
 * Parses participant rows into Participant records using ONLY information that
 * is visibly rendered. Kept isolated so WhatsApp DOM changes are absorbed here
 * without touching the scanning loop.
 */
export class ParticipantParser {
  /** Parse every currently rendered participant row in the container. */
  parse(container: HTMLElement): Participant[] {
    const rows = this.findRows(container);
    const results: Participant[] = [];
    for (const row of rows) {
      const parsed = this.parseRow(row);
      if (parsed && isValidParticipant(parsed)) results.push(parsed);
    }
    log("parsed rows", rows.length, "->", results.length);
    return results;
  }

  private findRows(container: HTMLElement): HTMLElement[] {
    // Preferred: explicit list items. Fallback: buttons with aria-labels that
    // represent contacts. We pick the strategy that yields the most rows.
    const byRole = queryAll(SELECTORS.participantRow, container);
    // Drop chat-message rows ("Image from X", "You: ...", stickers, etc.) that
    // also use role="listitem" but are NOT group members.
    return byRole.filter((row) => !isMessageRow(row));
  }

  private parseRow(row: HTMLElement): Participant | null {
    const name = this.parseName(row);
    const phone = this.parsePhone(row);
    const role = this.parseRole(row);

    if (!name && !phone) return null;

    const normalized = phone ? normalizePhone(phone) : null;
    return {
      name: name ?? null,
      phone: phone ?? null,
      // Only trust normalization when a clear international format exists.
      normalizedPhone: normalized && normalized !== phone ? normalized : null,
      role,
      source: "visible-ui",
    };
  }

  /** Name priority: aria-label > title attr > visible span text. */
  parseName(element: HTMLElement): string | null {
    const aria = element.getAttribute("aria-label");
    if (aria) {
      const cleaned = stripRoleSuffix(aria);
      if (cleaned) return cleaned;
    }

    const titled = queryFirst(['[title]'], element);
    const title = titled?.getAttribute("title");
    if (title && title.trim()) return title.trim();

    // WhatsApp often renders the display name in a dir="auto" span.
    const nameSpan = queryFirst(['span[dir="auto"]', '[dir="auto"]'], element);
    const text = visibleText(nameSpan);
    if (text) return stripRoleSuffix(text);

    return null;
  }

  /**
   * Phone is only present when WhatsApp renders it as visible text. We do NOT
   * reconstruct hidden numbers. We scan row text for a phone-like token.
   */
  parsePhone(element: HTMLElement): string | null {
    const text = visibleText(element);
    return extractPhone(text);
  }

  /** Role from visible markers ("Admin", "You"). Never inferred otherwise. */
  parseRole(element: HTMLElement): string | null {
    const aria = element.getAttribute("aria-label") ?? "";
    const text = `${aria} ${visibleText(element)}`;
    for (const marker of ROLE_MARKERS) {
      if (marker.pattern.test(text)) return marker.role;
    }
    return null;
  }
}

/**
 * Detect chat-message rows (media, stickers, "You: ..." bubbles) that share
 * role="listitem" with real member rows. Their aria-label/text reveals them.
 */
const MESSAGE_ROW_PATTERN =
  /^(image|video|sticker|audio|document|gif|photo|voice|pasted|missed|you\b|group change|you:)/i;

function isMessageRow(row: HTMLElement): boolean {
  const label = (row.getAttribute("aria-label") ?? "").trim();
  if (MESSAGE_ROW_PATTERN.test(label)) return true;
  // Media captions render as "Image from <name>" - never a member entry.
  if (/\b(image|video|sticker|audio|document|photo|gif)\s+from\b/i.test(label)) return true;
  return false;
}

/** Remove trailing role words from an aria-label like "Rahim, Admin". */
function stripRoleSuffix(value: string): string {
  let out = value.replace(/,\s*(group admin|admin|you)\b/gi, "").trim();
  out = out.replace(/\b(group admin|admin)\b/gi, "").trim();
  return out;
}

/**
 * Extract the first phone-like token from a string. Conservative: requires 7+
 * digits, allowing a leading + and common separators.
 */
export function extractPhone(text: string): string | null {
  if (!text) return null;
  const match = text.match(/(\+?\d[\d\s().-]{6,}\d)/);
  if (!match) return null;
  const candidate = match[1].trim();
  const digits = candidate.replace(/\D/g, "");
  return digits.length >= 7 ? candidate : null;
}

/**
 * Normalize to E.164-ish only when confident: keeps a leading + if present and
 * strips separators. Ambiguous local numbers are left as-is (returns raw).
 */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  const hadPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (hadPlus) return `+${digits}`;
  // Without an explicit country code we cannot safely convert; return raw form.
  return trimmed;
}

/** A participant is exportable if it has at least a name or a phone. */
export function isValidParticipant(p: Participant): boolean {
  return Boolean((p.name && p.name.length) || (p.phone && p.phone.length));
}

/**
 * Stable dedupe key. Phone is preferred; otherwise a normalized name; last
 * resort a fingerprint of all visible fields so distinct people never merge.
 */
export function createParticipantKey(p: Participant): string {
  if (p.phone) {
    const digits = p.phone.replace(/\D/g, "");
    if (digits.length >= 7) return `phone:${digits}`;
  }
  if (p.name) {
    return `name:${p.name.trim().toLowerCase()}`;
  }
  return `fp:${p.name ?? ""}|${p.phone ?? ""}`.toLowerCase();
}
