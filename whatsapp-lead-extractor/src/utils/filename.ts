/** Replace characters that are invalid in filenames with underscores. */
export function sanitizeForFilename(input: string): string {
  return input.replace(/[/\\:*?"<>|]/g, "_").replace(/\s+/g, "_").trim();
}

/** ISO date (YYYY-MM-DD) for today. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Build a sensible export filename, e.g.
 *   WhatsApp_My_Group_Friends_2026-09-23.csv
 */
export function buildFilename(groupName: string | null, extension: "csv" | "json"): string {
  const base = sanitizeForFilename(groupName && groupName.trim() ? groupName : "Group");
  return `WhatsApp_${base}_${today()}.${extension}`;
}
