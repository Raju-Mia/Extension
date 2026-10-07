import type { Message, StatusResponse } from "../shared/messages";
import type { Participant, ScanResult, ScanState } from "../shared/types";
import { toCsv } from "../utils/csv";
import { toJson } from "../utils/json";
import { buildFilename } from "../utils/filename";

/**
 * Popup controller. Implements a small state machine, mirrors live progress
 * from the content script, and performs CSV/JSON downloads locally.
 */

const els = {
  statusDot: document.getElementById("statusDot") as HTMLElement,
  statusText: document.getElementById("statusText") as HTMLElement,
  groupName: document.getElementById("groupName") as HTMLElement,
  count: document.getElementById("count") as HTMLElement,
  progress: document.getElementById("progress") as HTMLElement,
  progressText: document.getElementById("progressText") as HTMLElement,
  message: document.getElementById("message") as HTMLElement,
  scanBtn: document.getElementById("scanBtn") as HTMLButtonElement,
  stopBtn: document.getElementById("stopBtn") as HTMLButtonElement,
  csvBtn: document.getElementById("csvBtn") as HTMLButtonElement,
  jsonBtn: document.getElementById("jsonBtn") as HTMLButtonElement,
  clearBtn: document.getElementById("clearBtn") as HTMLButtonElement,
  optionsLink: document.getElementById("optionsLink") as HTMLAnchorElement,
};

let state: ScanState = "IDLE";
let results: Participant[] = [];
let groupName: string | null = null;

function setState(next: ScanState): void {
  state = next;
  render();
}

/**
 * Find the WhatsApp Web tab by URL rather than by "active tab". This keeps the
 * popup working even when the user has focused another tab, and lets a scan
 * that is running in the WhatsApp tab be observed after the popup reopens.
 */
function getWhatsAppTabId(): Promise<number | null> {
  return new Promise((resolve) => {
    chrome.tabs.query({ url: "https://web.whatsapp.com/*" }, (tabs) => {
      // Prefer a visible, fully-loaded WhatsApp tab; otherwise take the first.
      const usable = tabs.find((t) => t.id !== undefined);
      resolve(usable?.id ?? null);
    });
  });
}

async function sendToContent(message: Message): Promise<unknown> {
  const tabId = await getWhatsAppTabId();
  if (tabId === null || tabId === undefined) return null;
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    return null; // content script not present (tab needs a refresh)
  }
}

function showMessage(text: string, kind: "info" | "error"): void {
  els.message.hidden = false;
  els.message.textContent = text;
  els.message.className = `message message--${kind}`;
}

function clearMessage(): void {
  els.message.hidden = true;
  els.message.textContent = "";
}

/** Reflect the current state on the buttons/labels. */
function render(): void {
  const hasResults = results.length > 0;
  const scanning = state === "SCANNING";

  els.scanBtn.hidden = scanning;
  els.stopBtn.hidden = !scanning;
  els.scanBtn.disabled = state === "CHECKING";
  els.scanBtn.textContent = state === "CHECKING" ? "Checking…" : "Scan Members";

  els.csvBtn.disabled = !hasResults || scanning;
  els.jsonBtn.disabled = !hasResults || scanning;
  els.clearBtn.disabled = scanning || !hasResults;

  els.progress.hidden = !scanning;
  els.count.textContent = String(results.length);
}

function setWhatsAppStatus(ready: boolean, isGroup: boolean): void {
  if (!ready) {
    els.statusDot.className = "status__dot status__dot--warn";
    els.statusText.textContent = "⚠ Open WhatsApp Web first";
  } else if (!isGroup) {
    els.statusDot.className = "status__dot status__dot--warn";
    els.statusText.textContent = "⚠ No group detected — open a WhatsApp group";
  } else {
    els.statusDot.className = "status__dot status__dot--ok";
    els.statusText.textContent = "● WhatsApp Web detected";
  }
  els.groupName.textContent = isGroup && groupName ? groupName : "—";
}

async function refreshStatus(): Promise<void> {
  setState("CHECKING");
  const res = (await sendToContent({ type: "GET_STATUS" })) as StatusResponse | null;
  clearMessage();

  if (!res) {
    setWhatsAppStatus(false, false);
    setState("IDLE");
    return;
  }

  groupName = res.groupName;
  setWhatsAppStatus(res.whatsappReady, res.isGroup);

  if (res.scanning) {
    setState("SCANNING");
    return;
  }

  if (res.count > 0) {
    // There are cached results on the content script; pull them so export works
    // even if the popup was closed and reopened.
    const cached = (await sendToContent({ type: "GET_RESULTS" })) as
      | { participants: Participant[]; groupName: string | null }
      | null;
    if (cached) {
      results = cached.participants;
      groupName = cached.groupName ?? groupName;
    }
    setState("COMPLETED");
  } else {
    setState(res.isGroup && res.whatsappReady ? "READY" : "IDLE");
  }
}

function onScanProgress(count: number, phase: string): void {
  els.count.textContent = String(count);
  els.progressText.textContent =
    phase === "scrolling"
      ? `Scrolling participant list… Found ${count} participants`
      : `Scanning participants… Found ${count}`;
}

function applyResult(payload: ScanResult): void {
  results = payload.participants;
  groupName = payload.groupName ?? groupName;
  els.count.textContent = String(results.length);

  if (!payload.completed) {
    const reason = payload.stopReason;
    if (reason === "timeout") {
      showMessage(`Scanning stopped because the time limit was reached. ${results.length} participants found.`, "info");
      setState("STOPPED");
      return;
    }
    if (reason === "group-changed") {
      showMessage("The active group changed. The scan has been stopped.", "error");
      setState("ERROR");
      return;
    }
    if (reason === "list-unavailable") {
      showMessage(
        "Could not locate the participant list. WhatsApp Web may have changed its interface. Try opening the group info manually.",
        "error",
      );
      setState("ERROR");
      return;
    }
    if (reason === "user-stopped") {
      showMessage(`Scan stopped. ${results.length} participants found.`, "info");
      setState("STOPPED");
      return;
    }
  }

  setState(results.length ? "COMPLETED" : "ERROR");
  if (results.length) {
    showMessage(`Done. ${results.length} participants found.`, "info");
  } else {
    showMessage("No participants found. Open the group info panel and try again.", "error");
  }
}

/** Handle a runtime message broadcast by the content script. */
function onRuntimeMessage(message: Message): void {
  switch (message.type) {
    case "SCAN_PROGRESS":
      onScanProgress(message.count, message.phase);
      break;
    case "SCAN_COMPLETE":
      applyResult(message.payload);
      break;
    case "SCAN_ERROR":
      clearMessage();
      showMessage(message.message, "error");
      setState("ERROR");
      break;
    default:
      break;
  }
}

function download(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename, saveAs: true }, (downloadId) => {
    const revoke = () => URL.revokeObjectURL(url);
    if (chrome.runtime.lastError || downloadId === undefined) {
      revoke();
      return;
    }
    const listener = (delta: chrome.downloads.DownloadDelta) => {
      if (delta.id === downloadId && (delta.state?.current === "complete" || delta.state?.current === "interrupted")) {
        URL.revokeObjectURL(url);
        chrome.downloads.onChanged.removeListener(listener);
      }
    };
    chrome.downloads.onChanged.addListener(listener);
  });
}

function exportCsv(): void {
  if (!results.length) return;
  download(toCsv(results), buildFilename(groupName, "csv"), "text/csv;charset=utf-8");
}

function exportJson(): void {
  if (!results.length) return;
  download(toJson(groupName, results), buildFilename(groupName, "json"), "application/json");
}

function clearResults(): void {
  results = [];
  clearMessage();
  setState(groupName ? "READY" : "IDLE");
  els.count.textContent = "0";
}

function wire(): void {
  els.scanBtn.addEventListener("click", () => {
    clearMessage();
    results = [];
    setState("CHECKING");
    els.progressText.textContent = "Scanning participants…";
    void (async () => {
      const ack = (await sendToContent({ type: "START_SCAN" })) as { accepted?: boolean } | null;
      if (!ack || !ack.accepted) {
        // No reachable WhatsApp tab / content script: do not show a fake spinner.
        showMessage(
          "WhatsApp Web tab not found or not ready. Open web.whatsapp.com, refresh it once (F5), open a group, then try again.",
          "error",
        );
        setState("IDLE");
        return;
      }
      setState("SCANNING");
    })();
  });

  els.stopBtn.addEventListener("click", () => {
    void sendToContent({ type: "STOP_SCAN" });
  });

  els.csvBtn.addEventListener("click", exportCsv);
  els.jsonBtn.addEventListener("click", exportJson);
  els.clearBtn.addEventListener("click", clearResults);

  els.optionsLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

chrome.runtime.onMessage.addListener((message: Message) => {
  onRuntimeMessage(message);
});

wire();
void refreshStatus();
