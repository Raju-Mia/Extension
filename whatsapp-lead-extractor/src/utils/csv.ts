import type { Participant } from "../shared/types";

/** A participant is exportable when it has at least a name or a phone. */
function isValid(p: Participant): boolean {
  return Boolean((p.name && p.name.length) || (p.phone && p.phone.length));
}

/** Escape a single CSV cell per RFC 4180. */
export function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function cell(value: string | null): string {
  return escapeCsv(value ?? "");
}

/**
 * Build a UTF-8 CSV string (with BOM so Excel reads Bengali/Unicode correctly).
 * Columns: Name, Phone, Role. Empty/invalid rows are skipped.
 */
export function toCsv(participants: Participant[]): string {
  const header = ["Name", "Phone", "Role"].map(escapeCsv).join(",");
  const lines = participants
    .filter(isValid)
    .map((p) => [cell(p.name), cell(p.phone ?? p.normalizedPhone), cell(p.role)].join(","));
  return `\uFEFF${[header, ...lines].join("\r\n")}\r\n`;
}
