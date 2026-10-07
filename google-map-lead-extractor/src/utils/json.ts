import { isExportable } from "./columns";
import type { Business } from "../shared/types";

/** Shape written to the JSON export file. */
interface JsonExport {
  source: "google-maps";
  searchQuery: string | null;
  exportedAt: string;
  count: number;
  businesses: Business[];
}

/**
 * Produce a clean, pretty-printed JSON export. Every captured field is kept
 * verbatim (nulls included) so downstream tools can rely on stable keys.
 */
export function toJson(searchQuery: string | null, records: Business[]): string {
  const valid = records.filter(isExportable);
  const payload: JsonExport = {
    source: "google-maps",
    searchQuery,
    exportedAt: new Date().toISOString(),
    count: valid.length,
    businesses: valid,
  };
  return JSON.stringify(payload, null, 2);
}
