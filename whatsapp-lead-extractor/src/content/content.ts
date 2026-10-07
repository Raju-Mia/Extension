import { log } from "../shared/constants";
import type { Message, StatusResponse } from "../shared/messages";
import type { ScanResult } from "../shared/types";
import { loadSettings } from "../utils/storage";
import { ParticipantScanner } from "./participant-scanner";
import { detectGroup, isWhatsAppReady, waitForWhatsApp } from "./whatsapp-detector";

/**
 * Content-script orchestrator. Owns a single active scanner, responds to popup
 * messages, and streams progress back over runtime messaging. It never sends
 * participant data anywhere except back to this extension's own popup.
 */

let scanner: ParticipantScanner | null = null;
let lastResult: ScanResult | null = null;

function send(message: Message): void {
  // Popup may be closed; swallow connection errors quietly.
  chrome.runtime.sendMessage(message).catch(() => undefined);
}

async function handleStartScan(): Promise<void> {
  if (scanner) return; // already running

  const ready = await waitForWhatsApp(6000);
  if (!ready) {
    send({ type: "SCAN_ERROR", message: "Please open WhatsApp Web first." });
    return;
  }

  const ctx = detectGroup();
  if (!ctx.isGroup) {
    send({ type: "SCAN_ERROR", message: "No WhatsApp group detected. Open a group and try again." });
    return;
  }

  const settings = await loadSettings();
  scanner = new ParticipantScanner({
    scrollDelay: settings.scrollDelay,
    maxScanTimeMs: settings.maxScanTimeSec * 1000,
    autoOpenGroupInfo: settings.autoOpenGroupInfo,
    includeSelf: settings.includeSelf,
    onProgress: (count, phase) => send({ type: "SCAN_PROGRESS", count, phase }),
  });

  const activeScanner = scanner;
  try {
    const result = await activeScanner.start(ctx.name);
    lastResult = result;
    send({ type: "SCAN_COMPLETE", payload: result });
  } catch {
    send({ type: "SCAN_ERROR", message: "The scan stopped unexpectedly. WhatsApp Web may have changed its interface." });
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
      const ctx = detectGroup();
      const response: StatusResponse = {
        whatsappReady: isWhatsAppReady(),
        isGroup: ctx.isGroup,
        groupName: ctx.name,
        scanning: scanner !== null,
        count: lastResult?.participants.length ?? 0,
      };
      sendResponse(response);
      break;
    }
    case "START_SCAN":
      void handleStartScan();
      sendResponse({ accepted: true });
      break;
    case "STOP_SCAN":
      scanner?.stop();
      sendResponse({ accepted: true });
      break;
    case "GET_RESULTS":
      sendResponse({
        participants: lastResult?.participants ?? [],
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
  const ctx = detectGroup();
  return ctx.isGroup ? ctx.identifier : null;
}

watchNavigation();
log("content script loaded");
