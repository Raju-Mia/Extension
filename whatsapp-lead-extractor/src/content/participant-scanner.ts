import { LIMITS, SELECTORS, log } from "../shared/constants";
import type { Participant, ScanResult, ScanStopReason } from "../shared/types";
import {
  findScrollable,
  isAtBottom,
  queryAll,
  queryFirst,
  scrollContainerByStep,
  simulateClick,
  wait,
  waitForElement,
  waitForMutation,
} from "./dom-utils";
import { createParticipantKey, ParticipantParser } from "./participant-parser";
import { currentGroupSignature } from "./whatsapp-detector";

export interface ScanOptions {
  scrollDelay: number;
  maxScanTimeMs: number;
  autoOpenGroupInfo: boolean;
  includeSelf: boolean;
  onProgress?: (count: number, phase: string) => void;
}

/**
 * Drives the scan: opens the participant list, scrolls the (possibly
 * virtualized) container, and collects deduplicated participants. It checks
 * cancellation, timeouts, and group changes between every scroll step.
 */
export class ParticipantScanner {
  private readonly parser = new ParticipantParser();
  private readonly participants = new Map<string, Participant>();
  private scanning = false;
  private groupSignature: string | null = null;

  constructor(private readonly opts: ScanOptions) {}

  stop(): void {
    this.scanning = false;
  }

  getResults(): Participant[] {
    return Array.from(this.participants.values());
  }

  private reset(): void {
    this.participants.clear();
  }

  private ingest(rows: Participant[]): void {
    for (const p of rows) {
      if (!this.opts.includeSelf && isSelf(p)) continue;
      const key = createParticipantKey(p);
      if (!this.participants.has(key)) this.participants.set(key, p);
    }
  }

  /** Full scan lifecycle. Always resolves to a ScanResult (never throws). */
  async start(groupName: string | null): Promise<ScanResult> {
    this.reset();
    this.scanning = true;
    this.groupSignature = currentGroupSignature();
    const deadline = Date.now() + this.opts.maxScanTimeMs;

    const finish = (completed: boolean, stopReason: ScanStopReason | null): ScanResult => ({
      participants: this.getResults(),
      groupName,
      completed,
      stopReason,
    });

    let container: HTMLElement | null = null;
    try {
      container = await this.locateParticipantContainer();
      if (!container) {
        log("participant container not found");
        return finish(false, "list-unavailable");
      }
    } catch {
      return finish(false, "list-unavailable");
    }

    const scrollTarget = findScrollable(container);
    let previousCount = 0;
    let stableIterations = 0;
    let lastProgressAt = 0;

    // Emit progress at most every PROGRESS_THROTTLE_MS so a 10k-member scan
    // does not flood the extension runtime with messages.
    const emit = (phase: string, force = false) => {
      const now = Date.now();
      if (force || now - lastProgressAt >= LIMITS.PROGRESS_THROTTLE_MS) {
        lastProgressAt = now;
        this.opts.onProgress?.(this.participants.size, phase);
      }
    };

    while (this.scanning) {
      // Guard: user navigated to another chat mid-scan.
      if (currentGroupSignature() !== this.groupSignature) {
        return finish(false, "group-changed");
      }
      // Guard: hard time limit.
      if (Date.now() > deadline) {
        return finish(false, "timeout");
      }

      const visible = this.parser.parse(container);
      this.ingest(visible);
      emit("reading");

      // Track growth; a virtualized list is only "done" once scrolling stops
      // revealing new members for several consecutive passes.
      if (this.participants.size === previousCount) {
        stableIterations += 1;
      } else {
        stableIterations = 0;
      }
      previousCount = this.participants.size;

      const atBottom = isAtBottom(scrollTarget);
      if (atBottom && stableIterations >= LIMITS.MAX_STABLE_ITERATIONS) {
        break;
      }

      emit("scrolling");
      const moved = scrollContainerByStep(scrollTarget, LIMITS.SCROLL_OVERLAP_RATIO);
      await waitForMutation(scrollTarget, LIMITS.DOM_UPDATE_TIMEOUT);
      await wait(this.opts.scrollDelay);

      // If the list cannot scroll at all (fully rendered small group) or we are
      // pinned at the bottom with no new rows, allow a few extra reads then stop.
      if (!moved && atBottom && stableIterations >= LIMITS.MAX_STABLE_ITERATIONS) {
        break;
      }
    }

    // Final authoritative count for the UI.
    this.opts.onProgress?.(this.participants.size, "reading");

    if (!this.scanning) {
      // Loop exited because stop() was called.
      return finish(false, this.timeoutReached(deadline) ? "timeout" : "user-stopped");
    }
    return finish(true, null);
  }

  private timeoutReached(deadline: number): boolean {
    return Date.now() > deadline;
  }

  /**
   * Find the participant list, opening group info / expanding the list if the
   * settings allow it. Returns null if the list cannot be surfaced.
   */
  private async locateParticipantContainer(): Promise<HTMLElement | null> {
    // 1. Already present in the DOM.
    let section = queryFirst(SELECTORS.participantsSection);
    if (section) return section;

    if (this.opts.autoOpenGroupInfo) {
      // 2. Open the group info panel via a normal click on the header.
      const infoBtn = queryFirst(SELECTORS.groupInfoButton);
      if (infoBtn) {
        simulateClick(infoBtn);
        await wait(600);
      }

      // 3. Expand an abbreviated list with "View all participants" if present.
      const viewAll = queryFirst(SELECTORS.viewAllParticipants);
      if (viewAll) {
        simulateClick(viewAll);
        await wait(600);
      }

      section = await waitForElement(SELECTORS.participantsSection, LIMITS.ELEMENT_WAIT_TIMEOUT);
      if (section) return section;

      // 4. Last resort: the container holding the most non-message listitem
      //    rows. Message rows ("Image from X") are excluded so we never export
      //    chat bubbles as members.
      const candidates = queryAll(SELECTORS.participantRow).filter(
        (row) => !/^(image|video|sticker|audio|document|gif|photo|voice|pasted|missed|you\b)/i.test(
          (row.getAttribute("aria-label") ?? "").trim(),
        ),
      );
      const container = pickDensestContainer(candidates);
      if (container) return container;
    }

    return null;
  }
}

/**
 * Given a set of row elements, return the ancestor that contains the most of
 * them (i.e. the list container), or null when there is no clear cluster.
 */
function pickDensestContainer(rows: HTMLElement[]): HTMLElement | null {
  if (rows.length < 2) return null;
  const counts = new Map<HTMLElement, number>();
  for (const row of rows) {
    let parent = row.parentElement;
    // Walk up a couple of levels to find the shared list element.
    for (let depth = 0; parent && depth < 4; depth++, parent = parent.parentElement) {
      counts.set(parent, (counts.get(parent) ?? 0) + 1);
    }
  }
  let best: HTMLElement | null = null;
  let bestCount = 0;
  for (const [el, n] of counts) {
    if (n > bestCount) {
      best = el;
      bestCount = n;
    }
  }
  return bestCount >= 2 ? best : null;
}

/**
 * Identify the current user's own entry so it can optionally be excluded.
 * WhatsApp labels the self row as "You" (name) and/or tags role "You".
 */
function isSelf(p: Participant): boolean {
  const name = (p.name ?? "").trim().toLowerCase();
  const role = (p.role ?? "").trim().toLowerCase();
  return name === "you" || role === "you";
}
