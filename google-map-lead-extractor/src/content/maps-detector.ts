import { SELECTORS, extractSearchQuery, log } from "../shared/constants";
import { waitForElement } from "./dom-utils";

/**
 * Detects where in Google Maps the collector tab currently is, and whether the
 * relevant surface has rendered yet. Maps rewrites the URL as it routes, so we
 * classify pages by pathname rather than trusting one query string.
 */

export type MapsPageKind = "search" | "place" | "other";

/** True when the URL is a Google Maps document (either canonical host). */
export function isMapsUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const hostOk =
      u.hostname === "www.google.com" ||
      u.hostname === "maps.google.com" ||
      u.hostname === "maps.app.goo.gl" ||
      u.hostname.endsWith(".google.com");
    return hostOk && (u.pathname.startsWith("/maps") || u.pathname.startsWith("/search") || u.hostname === "maps.google.com");
  } catch {
    return false;
  }
}

/** Classify the current document. */
export function pageKind(url: string = location.href): MapsPageKind {
  if (!isMapsUrl(url)) return "other";
  if (url.includes("/maps/place/")) return "place";
  if (url.includes("/maps/search/") || /[?&]q=/.test(url)) return "search";
  return "other";
}

/** Best-effort search query from the URL, or null. */
export function detectSearchQuery(url: string = location.href): string | null {
  return extractSearchQuery(url);
}

/** Wait until a Maps results or place surface is present in the DOM. */
export async function waitForMaps(timeoutMs: number): Promise<boolean> {
  const el = await waitForElement(SELECTORS.mapsReady, timeoutMs);
  if (!el) {
    log("maps surface did not become ready in time");
    return false;
  }
  return true;
}
