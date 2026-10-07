import { LIMITS, SELECTORS, log } from "../shared/constants";
import type { Message, WebsiteInfo } from "../shared/messages";
import type { Business, ExtractPhase, QueuedPlace, Session, Settings, Stats } from "../shared/types";
import { emptyBusiness } from "../utils/normalize";
import { upsertRecords, updateSession } from "../utils/storage";
import { isAtBottom, scrollContainerByStep, findScrollable, wait, waitForElement, waitForMutation } from "./dom-utils";
import { waitForMaps } from "./maps-detector";
import { parsePlacePanel, parseResultCards } from "./parsers";

/**
 * The crawl state machine. It is deliberately split into two phases that
 * survive Google Maps' instability:
 *
 *   LIST    one page-load: scroll the results feed, capture every place card,
 *           and persist a partial (seed) record per unique business.
 *   DETAILS one page-load PER place: navigate the collector tab to a queued
 *           place URL, enrich the record from the place panel (and, only if
 *           opted in, its public website), then advance the cursor.
 *
 * Because each DETAILS step is its own document load, the cursor + queue live
 * in chrome.storage and are re-read on every boot — closing or reloading the
 * collector tab can never lose what has already been collected.
 */
export interface ExtractorDeps {
  emit(message: Message): void;
  requestWebsite(url: string): Promise<WebsiteInfo | null>;
  navigate(url: string): void;
}

export class Extractor {
  private session: Session;
  private control = { paused: false, stopped: false };
  private newCount = 0;
  private duplicates = 0;
  private lastProgressAt = 0;
  private readonly deadline: number;

  constructor(
    session: Session,
    private readonly settings: Settings,
    private readonly deps: ExtractorDeps,
  ) {
    this.session = session;
    const startedAt = session.startedAt ?? Date.now();
    this.deadline = startedAt + this.settings.maxScanTimeSec * 1000;
  }

  /* ------------------------------------------------------------- controls */

  pause(): void {
    this.control.paused = true;
  }

  stop(): void {
    this.control.stopped = true;
    this.control.paused = false;
  }

  /** Continue after a PAUSE, entering the correct phase. */
  async resume(): Promise<void> {
    this.control.paused = false;
    const phase: ExtractPhase = this.session.resumePhase === "DETAILS" ? "DETAILS" : "LIST";
    await this.patch({ status: phase, resumePhase: phase });
    if (phase === "DETAILS") {
      this.advanceDetailsOrFinish();
    } else {
      await this.runList();
    }
  }

  /* -------------------------------------------------------------- LIST */

  async runList(): Promise<void> {
    this.control = { paused: false, stopped: this.control.stopped };
    const feed = await waitForElement(SELECTORS.resultsFeed, LIMITS.FEED_WAIT_TIMEOUT);
    if (!feed) {
      await this.fail("Could not find the results list. Open a Google Maps search and try again.");
      return;
    }
    const scroller = findScrollable(feed);

    const seen = new Map<string, QueuedPlace>(this.session.placeUrls.map((p) => [p.placeId, p]));
    let batches = 0;
    let stable = 0;
    let previousSize = seen.size;

    while (!this.control.stopped) {
      if (this.control.paused) {
        await this.setPaused("LIST");
        return;
      }
      if (Date.now() > this.deadline) {
        await this.finish(false, "Reached the time limit — your results are ready to export.");
        return;
      }

      const cards = parseResultCards();
      const fresh: Business[] = [];
      let newThisStep = 0;
      for (const card of cards) {
        if (seen.has(card.placeId)) {
          this.duplicates += 1;
          continue;
        }
        seen.set(card.placeId, card);
        fresh.push(seedFromPlace(card, this.session.searchQuery));
        newThisStep += 1;
        if (seen.size >= this.settings.maxBusinesses || seen.size >= LIMITS.MAX_PLACE_URLS) break;
      }
      this.newCount = newThisStep;

      if (fresh.length) {
        await upsertRecords(fresh, { removeDuplicates: this.settings.removeDuplicates });
      }
      const places = Array.from(seen.values());
      await this.patch({ placeUrls: places, stats: this.buildStats(places.length) });
      this.emit("Scanning results…", "LIST");

      if (newThisStep > 0) {
        batches += 1;
        stable = 0;
      } else if (seen.size !== previousSize) {
        stable = 0;
      } else {
        stable += 1;
      }
      previousSize = seen.size;

      if (batches >= this.settings.maxBatches) break;
      if (places.length >= this.settings.maxBusinesses) break;
      if (stable >= LIMITS.MAX_STABLE_SCROLLS && isAtBottom(scroller)) break;

      scrollContainerByStep(scroller, LIMITS.SCROLL_RATIO);
      await waitForMutation(scroller, LIMITS.FEED_WAIT_TIMEOUT);
      await wait(this.settings.delayMs);
    }

    if (this.control.stopped) {
      await this.finish(false, "Stopped — your results are ready to export.");
      return;
    }
    await this.afterList();
  }

  private async afterList(): Promise<void> {
    const places = this.session.placeUrls;
    if (!places.length) {
      await this.fail("No businesses were found for this search.");
      return;
    }
    if (!this.settings.extractDetails) {
      await this.finish(true, null);
      return;
    }
    await this.patch({ status: "DETAILS", resumePhase: "DETAILS", cursor: 0, stats: this.buildStats(places.length) });
    this.deps.navigate(places[0].url);
  }

  /* ----------------------------------------------------------- DETAILS */

  /** Enrich exactly one place for the current document load, then advance. */
  async runDetailStep(): Promise<void> {
    const places = this.session.placeUrls;
    const index = this.session.cursor;
    if (index >= places.length) {
      await this.finish(true, null);
      return;
    }
    if (this.control.stopped) {
      await this.finish(false, "Stopped — your results are ready to export.");
      return;
    }

    const place = places[index];
    await waitForMaps(LIMITS.PLACE_WAIT_TIMEOUT);
    // Ensure the place heading has rendered before parsing the panel.
    await waitForElement(SELECTORS.placeName, LIMITS.PLACE_WAIT_TIMEOUT);

    const parsed = parsePlacePanel(location.href, this.session.searchQuery);
    const record = buildDetailRecord(place, parsed, this.session.searchQuery);

    if (this.settings.extractWebsite && record.website) {
      const info = await this.deps.requestWebsite(record.website);
      if (info) Object.assign(record, compact(info));
    }

    await upsertRecords(record, { removeDuplicates: this.settings.removeDuplicates });

    await this.patch({ cursor: index + 1, stats: this.buildStats(places.length) });
    this.emit(place.name ?? "business", "DETAILS");

    this.advanceDetailsOrFinish();
  }

  private advanceDetailsOrFinish(): void {
    if (this.control.stopped) {
      void this.finish(false, "Stopped — your results are ready to export.");
      return;
    }
    if (this.control.paused) {
      void this.setPaused("DETAILS");
      return;
    }
    if (Date.now() > this.deadline) {
      void this.finish(false, "Reached the time limit — your results are ready to export.");
      return;
    }
    const next = this.session.cursor;
    if (next < this.session.placeUrls.length) {
      this.deps.navigate(this.session.placeUrls[next].url);
    } else {
      void this.finish(true, null);
    }
  }

  /* ------------------------------------------------------------ helpers */

  private buildStats(total: number): Stats {
    return {
      found: total,
      processed: this.session.cursor,
      newCount: this.newCount,
      duplicates: this.duplicates,
      total,
    };
  }

  /** Persist a session patch (read-modify-write) and mirror it locally. */
  private async patch(fields: Partial<Session>): Promise<void> {
    this.session = { ...this.session, ...fields };
    await updateSession(fields);
  }

  private emit(current: string, phase: ExtractPhase): void {
    const now = Date.now();
    if (now - this.lastProgressAt < LIMITS.PROGRESS_THROTTLE_MS) return;
    this.lastProgressAt = now;
    this.deps.emit({ type: "EXTRACT_PROGRESS", stats: this.session.stats, current, phase });
  }

  private async setPaused(from: ExtractPhase): Promise<void> {
    await this.patch({ status: "PAUSED", resumePhase: from });
    this.deps.emit({ type: "EXTRACT_PROGRESS", stats: this.session.stats, current: "Paused", phase: "PAUSED" });
    log("paused during", from);
  }

  private async finish(completed: boolean, note: string | null): Promise<void> {
    await this.patch({ status: "COMPLETED", finishedAt: Date.now() });
    log(completed ? "crawl complete" : `crawl ended: ${note ?? "stopped"}`);
    this.deps.emit({ type: "EXTRACT_COMPLETE", stats: this.session.stats });
    if (note) {
      // Surfaced by the popup as an informational message; results still export.
      this.deps.emit({ type: "EXTRACT_PROGRESS", stats: this.session.stats, current: note, phase: "COMPLETED" });
    }
  }

  private async fail(message: string): Promise<void> {
    await this.patch({ status: "ERROR", finishedAt: Date.now() });
    this.deps.emit({ type: "EXTRACT_ERROR", message });
  }
}

/** Turn a LIST-phase card into a minimal seed record. */
function seedFromPlace(place: QueuedPlace, searchQuery: string | null): Business {
  const base = emptyBusiness(place.placeId);
  base.businessName = place.name;
  base.category = place.category;
  base.rating = place.rating;
  base.reviewCount = place.reviewCount;
  base.mapsUrl = place.url;
  base.searchQuery = searchQuery;
  return base;
}

/** Layer a freshly parsed panel onto a place's known identity. */
function buildDetailRecord(place: QueuedPlace, parsed: Partial<Business>, searchQuery: string | null): Business {
  const base = seedFromPlace(place, searchQuery);
  return { ...base, ...compact(parsed), placeId: place.placeId, source: "google-maps" };
}

/** Drop null / undefined / empty entries so merges never erase good data. */
function compact<T extends object>(value: T): Partial<T> {
  const out: Partial<T> = {};
  (Object.keys(value) as Array<keyof T>).forEach((k) => {
    const v = value[k];
    if (v !== null && v !== undefined && v !== "") {
      (out as Record<string, unknown>)[k as string] = v;
    }
  });
  return out;
}
