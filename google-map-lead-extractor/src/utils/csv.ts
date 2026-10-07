import { CSV_COLUMNS, isExportable } from "./columns";
import type { Business } from "../shared/types";

/**
 * Escape a single CSV cell per RFC 4180 and neutralize spreadsheet formula
 * injection. Publicly scraped text can begin with = + - @ or a tab/CR, which
 * Excel would otherwise evaluate as a formula; prefixing with an apostrophe
 * keeps it as literal text without altering normal values.
 */
export function escapeCsv(value: string): string {
  let v = value ?? "";
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return `"${v.replace(/"/g, '""')}"`;
}

/**
 * Build a UTF-8 CSV string (with BOM so Excel reads Bangla/Unicode correctly).
 * The 24 columns follow CSV_COLUMNS order exactly; rows without a business name
 * are skipped. Missing fields are exported as empty cells, never placeholders.
 */
export function toCsv(records: Business[]): string {
  const header = CSV_COLUMNS.map((c) => escapeCsv(c.header)).join(",");
  const lines = records
    .filter(isExportable)
    .map((b) => CSV_COLUMNS.map((c) => escapeCsv(c.get(b))).join(","));
  return `\uFEFF${[header, ...lines].join("\r\n")}\r\n`;
}
