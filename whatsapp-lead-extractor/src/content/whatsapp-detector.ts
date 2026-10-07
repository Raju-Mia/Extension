import { GROUP_SUBTITLE_PATTERN, GROUP_TEXT_MARKERS, SELECTORS, log } from "../shared/constants";
import type { GroupContext } from "../shared/types";
import { queryFirst, visibleText, waitForElement } from "./dom-utils";

/**
 * Detects WhatsApp Web readiness and whether the active chat is a group, using
 * several independent UI signals rather than one fragile selector.
 */

/** True when the main WhatsApp Web panes exist (logged in and loaded). */
export function isWhatsAppReady(): boolean {
  return queryFirst(SELECTORS.appReady) !== null;
}

/** Wait (bounded) for WhatsApp Web to finish loading its main UI. */
export async function waitForWhatsApp(timeout: number): Promise<boolean> {
  if (isWhatsAppReady()) return true;
  const el = await waitForElement(SELECTORS.appReady, timeout);
  return el !== null;
}

/** Read the active chat header title, if any. */
export function getChatTitle(): string | null {
  const header = queryFirst(SELECTORS.chatHeader) ?? queryFirst(SELECTORS.chatHeader, document.body);
  if (!header) return null;

  // The header's [title] attribute is the most stable source of the chat name.
  const titled = header.querySelector<HTMLElement>("[title]");
  const titleAttr = (titled?.getAttribute("title") ?? "").trim();
  if (titleAttr) return titleAttr;

  const title = queryFirst(SELECTORS.chatHeaderTitle, header);
  const text = visibleText(title) || (title?.getAttribute("title") ?? "").trim();
  return text || null;
}

/**
 * Decide whether the open chat is a group using several independent,
 * resilient signals. We scan the WHOLE document because the group-info drawer
 * ("Group admin", "See member changes", member list) renders OUTSIDE the chat
 * pane, and WhatsApp's generated class names change frequently.
 */
export function detectGroup(): GroupContext {
  const name = getChatTitle();
  const header = queryFirst(SELECTORS.chatHeader) ?? queryFirst(SELECTORS.chatHeader, document.body);

  // Signal 1: group-only text markers anywhere on the page (drawer open, etc.).
  const bodyText = visibleText(document.body);
  const hasGroupMarker = GROUP_TEXT_MARKERS.some((re) => re.test(bodyText));

  // Signal 2: header subtitle previews members ("A, B, You").
  const headerText = visibleText(header);
  const hasMemberPreview = headerText ? GROUP_SUBTITLE_PATTERN.test(headerText) : false;

  // Signal 3: accessibility labels that mention participants/group info.
  const hasAriaSignal =
    document.querySelector('[aria-label*="articipants" i]') !== null ||
    document.querySelector('[aria-label*="group info" i]') !== null;

  const isGroup = hasGroupMarker || hasMemberPreview || hasAriaSignal;
  const identifier = name ? buildIdentifier(name) : null;

  log("detectGroup", { isGroup, hasName: Boolean(name), hasGroupMarker, hasMemberPreview, hasAriaSignal });
  return { isGroup, name, identifier };
}

/**
 * Build a lightweight identifier for group-switch detection. We cannot read
 * WhatsApp's internal JIDs without private APIs, so we key off the visible
 * header title. This catches the common case of the user opening another chat.
 */
function buildIdentifier(name: string): string {
  return name.trim().toLowerCase();
}

/** Snapshot used by the scanner to detect that the user navigated away. */
export function currentGroupSignature(): string | null {
  const ctx = detectGroup();
  return ctx.isGroup ? ctx.identifier : null;
}
