import { LIMITS, SELECTORS, log } from "../shared/constants";
import type { ExtractResult, ExtractStopReason, Lead } from "../shared/types";
import {
  findScrollable,
  isAtBottom,
  queryFirst,
  scrollContainerByStep,
  simulateClick,
  wait,
  waitForElement,
  waitForMutation,
} from "./dom-utils";
import { createLeadKey, MemberParser } from "./member-parser";
import { currentChatSignature } from "./telegram-detector";

export interface ScanOptions {
  scrollDelay: number;
  maxScanTimeMs: number;
  autoOpenMemberList: boolean;
  includeSelf: boolean;
  onProgress?: (count: number, phase: string) => void;
}

/**
 * Drives the extraction: opens the member list, scrolls the (virtualized)
 * container, and collects deduplicated leads. It checks cancellation, timeouts,
 * and chat changes between every scroll step.
 */
export class MemberScanner {
  private readonly parser = new MemberParser();
  private readonly leads = new Map<string, Lead>();
  private scanning = false;
  private chatSignature: string | null = null;

  constructor(private readonly opts: ScanOptions) {}

  stop(): void {
    this.scanning = false;
  }

  getResults(): Lead[] {
    return Array.from(this.leads.values());
  }

  private reset(): void {
    this.leads.clear();
  }

  private ingest(rows: Lead[]): void {
    for (const p of rows) {
      if (!this.opts.includeSelf && isSelf(p)) continue;
      const key = createLeadKey(p);
      if (!this.leads.has(key)) this.leads.set(key, p);
    }
  }

  /** Full scan lifecycle. Always resolves to an ExtractResult (never throws). */
  async start(groupName: string | null): Promise<ExtractResult> {
    this.reset();
    this.scanning = true;
    this.chatSignature = currentChatSignature();
    const deadline = Date.now() + this.opts.maxScanTimeMs;

    const finish = (completed: boolean, stopReason: ExtractStopReason | null): ExtractResult => ({
      leads: this.getResults(),
      groupName,
      completed,
      stopReason,
    });

    let container: HTMLElement | null = null;
    try {
      container = await this.locateMemberContainer();
      if (!container) {
        log("member container not found");
        return finish(false, "list-unavailable");
      }
    } catch {
      return finish(false, "list-unavailable");
    }

    const scrollTarget = findScrollable(container);
    let previousCount = 0;
    let stableIterations = 0;
    let lastProgressAt = 0;

    // Emit progress at most every PROGRESS_THROTTLE_MS so a huge list does not
    // flood the extension runtime with messages.
    const emit = (phase: string, force = false) => {
      const now = Date.now();
      if (force || now - lastProgressAt >= LIMITS.PROGRESS_THROTTLE_MS) {
        lastProgressAt = now;
        this.opts.onProgress?.(this.leads.size, phase);
      }
    };

    while (this.scanning) {
      // Guard: user navigated to another chat mid-scan.
      if (currentChatSignature() !== this.chatSignature) {
        return finish(false, "group-changed");
      }
      // Guard: hard time limit.
      if (Date.now() > deadline) {
        return finish(false, "timeout");
      }

      const visible = this.parser.parse(container);
      this.ingest(visible);
      emit("reading");

      if (this.leads.size === previousCount) {
        stableIterations += 1;
      } else {
        stableIterations = 0;
      }
      previousCount = this.leads.size;

      const atBottom = isAtBottom(scrollTarget);
      if (atBottom && stableIterations >= LIMITS.MAX_STABLE_ITERATIONS) {
        break;
      }

      emit("scrolling");
      const moved = scrollContainerByStep(scrollTarget, LIMITS.SCROLL_OVERLAP_RATIO);
      await waitForMutation(scrollTarget, LIMITS.DOM_UPDATE_TIMEOUT);
      await wait(this.opts.scrollDelay);

      if (!moved && atBottom && stableIterations >= LIMITS.MAX_STABLE_ITERATIONS) {
        break;
      }
    }

    // Final authoritative count for the UI.
    this.opts.onProgress?.(this.leads.size, "reading");

    if (!this.scanning) {
      return finish(false, this.timeoutReached(deadline) ? "timeout" : "user-stopped");
    }
    return finish(true, null);
  }

  private timeoutReached(deadline: number): boolean {
    return Date.now() > deadline;
  }

  /**
   * Find the scrollable member list. Tries, in order: an already-open list, the
   * info-panel "Members" row click, and a header click to open the profile.
   */
  private async locateMemberContainer(): Promise<HTMLElement | null> {
    // 1) Already open.
    const open = queryFirst(SELECTORS.membersList);
    if (open) return open;

    // 2) Click the "Members" affordance if present.
    const membersButton = queryFirst(SELECTORS.membersOpenButton);
    if (membersButton) {
      simulateClick(membersButton);
      const found = await waitForElement(SELECTORS.membersList, LIMITS.ELEMENT_WAIT_TIMEOUT);
      if (found) return found;
    }

    // 3) Open the chat profile via the header, then retry the members button.
    const infoButton = queryFirst(SELECTORS.chatInfoButton);
    if (infoButton) {
      simulateClick(infoButton);
      await wait(400);
      const membersButton2 = queryFirst(SELECTORS.membersOpenButton);
      if (membersButton2) {
        simulateClick(membersButton2);
        const found = await waitForElement(SELECTORS.membersList, LIMITS.ELEMENT_WAIT_TIMEOUT);
        if (found) return found;
      }
    }

    // 4) Last resort: treat the densest cluster of member rows as the container.
    const rows = Array.from(document.querySelectorAll<HTMLElement>(SELECTORS.memberRow.join(",")));
    const container = pickDensestContainer(rows);
    if (container) return container;

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
 * Telegram labels the self row's name "You" in some locales.
 */
function isSelf(p: Lead): boolean {
  const name = (p.name ?? "").trim().toLowerCase();
  return name === "you" || name === "you (you)";
}
