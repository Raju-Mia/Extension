import type { Business } from "../shared/types";

/**
 * Single source of truth for the export column order. CSV, XLSX, and the
 * results table all derive their layout from this list so the 24 columns can
 * never drift between exporters. Order matches the product plan exactly.
 *
 * Every getter returns "" for a missing field — missing data is always blank,
 * never fabricated.
 */
export const CSV_COLUMNS: ReadonlyArray<{ header: string; get: (b: Business) => string }> = [
  { header: "Business Name", get: (b) => b.businessName ?? "" },
  { header: "Category", get: (b) => b.category ?? "" },
  { header: "Phone", get: (b) => b.phone ?? "" },
  { header: "Phone Original", get: (b) => b.phoneOriginal ?? "" },
  { header: "Email", get: (b) => b.email ?? "" },
  { header: "Website", get: (b) => b.website ?? "" },
  { header: "Facebook", get: (b) => b.facebook ?? "" },
  { header: "Instagram", get: (b) => b.instagram ?? "" },
  { header: "LinkedIn", get: (b) => b.linkedin ?? "" },
  { header: "YouTube", get: (b) => b.youtube ?? "" },
  { header: "TikTok", get: (b) => b.tiktok ?? "" },
  { header: "Rating", get: (b) => b.rating ?? "" },
  { header: "Review Count", get: (b) => b.reviewCount ?? "" },
  { header: "Business Status", get: (b) => b.businessStatus ?? "" },
  { header: "Opening Hours", get: (b) => b.openingHours ?? "" },
  { header: "Services", get: (b) => b.services ?? "" },
  { header: "Description", get: (b) => b.description ?? "" },
  { header: "Address", get: (b) => b.address ?? "" },
  { header: "Plus Code", get: (b) => b.plusCode ?? "" },
  { header: "Latitude", get: (b) => b.latitude ?? "" },
  { header: "Longitude", get: (b) => b.longitude ?? "" },
  { header: "Google Maps URL", get: (b) => b.mapsUrl ?? "" },
  { header: "Search Query", get: (b) => b.searchQuery ?? "" },
  { header: "Extraction Date", get: (b) => b.extractedAt ?? "" },
];

/** A record is exportable once it has at least a real business name. */
export function isExportable(b: Business): boolean {
  return Boolean(b.businessName && b.businessName.trim().length);
}
