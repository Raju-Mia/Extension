import type { Lead } from "../shared/types";

/** A lead is exportable when it has a name and at least one identifier. */
function isValid(p: Lead): boolean {
  const hasName = Boolean(p.name && p.name.length);
  const hasId = Boolean(p.username || p.phone || p.telegramId);
  return hasName && hasId;
}

/** Escape a single CSV cell per RFC 4180. */
export function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function cell(value: string | null): string {
  return escapeCsv(value ?? "");
}

/** Show usernames with a leading @ for readability in the sheet. */
function displayUsername(p: Lead): string | null {
  return p.username ? `@${p.username}` : null;
}

/**
 * Build a UTF-8 CSV string (with BOM so Excel reads Bengali/Unicode correctly).
 * Columns: Name, Username, Phone, Telegram ID, Role. Invalid rows are skipped.
 */
export function toCsv(leads: Lead[]): string {
  const header = ["Name", "Username", "Phone", "Telegram ID", "Role"].map(escapeCsv).join(",");
  const lines = leads
    .filter(isValid)
    .map((p) =>
      [cell(p.name), cell(displayUsername(p)), cell(p.phone), cell(p.telegramId), cell(p.role)].join(","),
    );
  return `\uFEFF${[header, ...lines].join("\r\n")}\r\n`;
}
