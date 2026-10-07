import { CHANNEL_TEXT_MARKERS, GROUP_TEXT_MARKERS, SELECTORS, log } from "../shared/constants";
import type { ChatContext, ChatType } from "../shared/types";
import { queryFirst, visibleText, waitForElement } from "./dom-utils";

/**
 * Detects Telegram Web readiness and whether an extractable chat (group or
 * channel with a member list) is open, using several independent UI signals
 * rather than one fragile selector.
 */

/** True when the Telegram Web main UI exists (logged in and loaded). */
export function isTelegramReady(): boolean {
  return queryFirst(SELECTORS.appReady) !== null;
}

/** Wait (bounded) for Telegram Web to finish loading its main UI. */
export async function waitForTelegram(timeout: number): Promise<boolean> {
  if (isTelegramReady()) return true;
  const el = await waitForElement(SELECTORS.appReady, timeout);
  return el !== null;
}

/** Read the active chat header title, if any. */
export function getChatTitle(): string | null {
  const header = queryFirst(SELECTORS.chatHeader) ?? queryFirst(SELECTORS.chatHeader, document.body);
  const scope: ParentNode = header ?? document.body;

  const title = queryFirst(SELECTORS.chatTitle, scope);
  const text = visibleText(title) || (title?.getAttribute("title") ?? "").trim();
  if (text) return text;

  // Fallback: any titled element inside the header.
  const titled = header?.querySelector<HTMLElement>("[title]");
  const attr = (titled?.getAttribute("title") ?? "").trim();
  return attr || null;
}

/** Classify the open chat using visible markers and wording. */
function classifyChat(bodyText: string): ChatType {
  const isChannel = CHANNEL_TEXT_MARKERS.some((re) => re.test(bodyText));
  const isGroup = GROUP_TEXT_MARKERS.some((re) => re.test(bodyText));
  if (isChannel) return "channel";
  if (isGroup) return "group";
  return "unknown";
}

/**
 * Decide whether the open chat is extractable. We scan the whole document
 * because the member list renders as a modal/sidebar outside the chat pane, and
 * Telegram's generated class names change frequently.
 */
export function detectChat(): ChatContext {
  const name = getChatTitle();
  const bodyText = visibleText(document.body);
  const type = classifyChat(bodyText);

  // A member list container already present is the strongest signal.
  const hasMemberList = queryFirst(SELECTORS.membersList) !== null;
  const hasMembersAria =
    document.querySelector('[aria-label*="Member" i]') !== null ||
    document.querySelector('[aria-label*="Subscriber" i]') !== null;

  const isExtractable = type !== "unknown" || hasMemberList || hasMembersAria;
  const identifier = buildIdentifier(name);

  log("detectChat", { isExtractable, type, hasName: Boolean(name), hasMemberList, hasMembersAria });
  return { isExtractable, type, name, identifier };
}

/**
 * Build a lightweight identifier for chat-switch detection. We avoid private
 * APIs, so we key off the visible title (plus a normalized form). This catches
 * the common case of the user opening another chat mid-extraction.
 */
function buildIdentifier(name: string | null): string | null {
  if (!name) return null;
  return name.trim().toLowerCase();
}

/** Snapshot used by the scanner to detect that the user navigated away. */
export function currentChatSignature(): string | null {
  const ctx = detectChat();
  return ctx.isExtractable ? ctx.identifier : null;
}
