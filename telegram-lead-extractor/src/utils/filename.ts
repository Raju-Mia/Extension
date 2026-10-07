/** Replace characters that are invalid in filenames with underscores. */
export function sanitizeForFilename(input: string): string {
  return input.replace(/[/\\:*?"<>|]/g, "_").replace(/\s+/g, "_").trim();
}

/** ISO date (YYYY-MM-DD) for today. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export type ExportExtension = "csv" | "json" | "xlsx";

/**
 * Build a sensible export filename, e.g.
 *   Telegram_My_Group_2026-09-29.csv
 */
export function buildFilename(groupName: string | null, extension: ExportExtension): string {
  const base = sanitizeForFilename(groupName && groupName.trim() ? groupName : "Members");
  const capped = base.length > 60 ? base.slice(0, 60) : base;
  return `Telegram_${capped}_${today()}.${extension}`;
}
