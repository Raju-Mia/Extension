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
 *   GoogleMaps_dhaka_mirpur_hospital_2026-10-01.csv
 */
export function buildFilename(searchQuery: string | null, extension: ExportExtension): string {
  const base = sanitizeForFilename(searchQuery && searchQuery.trim() ? searchQuery : "Businesses");
  const capped = base.length > 60 ? base.slice(0, 60) : base;
  return `GoogleMaps_${capped}_${today()}.${extension}`;
}
