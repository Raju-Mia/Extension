import { log } from "../shared/constants";
import type { Message, StatusResponse } from "../shared/messages";
import type { ExtractResult } from "../shared/types";
import { loadSettings } from "../utils/storage";
import { detectChat, isTelegramReady, waitForTelegram } from "./telegram-detector";
import { MemberScanner } from "./member-scanner";

/**
 * Content-script orchestrator. Owns a single active scanner, responds to popup
 * messages, and streams progress back over runtime messaging. It never sends
 * member data anywhere except back to this extension's own popup window.
 */

let scanner: MemberScanner | null = null;
let lastResult: ExtractResult | null = null;

function send(message: Message): void {
  // Popup window may be closed; swallow connection errors quietly.
  chrome.runtime.sendMessage(message).catch(() => undefined);
}

async function handleStartExtract(): Promise<void> {
  if (scanner) return; // already running

  const ready = await waitForTelegram(6000);
  if (!ready) {
    send({ type: "EXTRACT_ERROR", message: "Please open Telegram Web first." });
    return;
  }

  const ctx = detectChat();
  if (!ctx.isExtractable) {
    send({ type: "EXTRACT_ERROR", message: "No group or channel detected. Open one and try again." });
    return;
  }

  const settings = await loadSettings();
  scanner = new MemberScanner({
    scrollDelay: settings.scrollDelay,
    maxScanTimeMs: settings.maxScanTimeSec * 1000,
    autoOpenMemberList: settings.autoOpenMemberList,
    includeSelf: settings.includeSelf,
    onProgress: (count, phase) => send({ type: "EXTRACT_PROGRESS", count, phase }),
  });

  const activeScanner = scanner;
  try {
    const result = await activeScanner.start(ctx.name);
    lastResult = result;
    send({ type: "EXTRACT_COMPLETE", payload: result });
  } catch {
    send({ type: "EXTRACT_ERROR", message: "The extraction stopped unexpectedly. Telegram Web may have changed its interface." });
  } finally {
    scanner = null;
  }
}

async function onMessage(
  message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
): Promise<void> {
  switch (message.type) {
    case "GET_STATUS": {
      const ctx = detectChat();
      const response: StatusResponse = {
        telegramReady: isTelegramReady(),
        isExtractable: ctx.isExtractable,
        groupName: ctx.name,
        extracting: scanner !== null,
        count: lastResult?.leads.length ?? 0,
      };
      sendResponse(response);
      break;
    }
    case "START_EXTRACT":
      void handleStartExtract();
      sendResponse({ accepted: true });
      break;
    case "STOP_EXTRACT":
      scanner?.stop();
      sendResponse({ accepted: true });
      break;
    case "GET_RESULTS":
      sendResponse({
        leads: lastResult?.leads ?? [],
        groupName: lastResult?.groupName ?? null,
      });
      break;
    default:
      break;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void onMessage(message as Message, sender, sendResponse);
  return true; // keep the channel open for async sendResponse
});

// Reset cached results when the user navigates to a different chat so a stale
// group is never accidentally exported.
function watchNavigation(): void {
  let signature = currentSig();
  const check = () => {
    const next = currentSig();
    if (next !== signature) {
      signature = next;
      if (!scanner) lastResult = null;
    }
  };
  // Lightweight interval; no full-DOM scanning happens here.
  setInterval(check, 1000);
}

function currentSig(): string | null {
  const ctx = detectChat();
  return ctx.isExtractable ? ctx.identifier : null;
}

watchNavigation();
log("content script loaded");
