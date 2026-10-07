import type { Message, StatusResponse } from "../shared/messages";
import type { ExtractResult, ExtractState, Lead } from "../shared/types";
import { toCsv } from "../utils/csv";
import { toJson } from "../utils/json";
import { toXlsxBytes } from "../utils/excel";
import { buildFilename } from "../utils/filename";

/**
 * Popup-window controller. Implements a small state machine, mirrors live
 * progress from the content script, and performs CSV/Excel/JSON downloads
 * locally. No data ever leaves the browser.
 */

const TELEGRAM_ORIGIN = "https://web.telegram.org/*";

const els = {
  statusDot: document.getElementById("statusDot") as HTMLElement,
  statusText: document.getElementById("statusText") as HTMLElement,
  groupName: document.getElementById("groupName") as HTMLElement,
  count: document.getElementById("count") as HTMLElement,
  progress: document.getElementById("progress") as HTMLElement,
  progressText: document.getElementById("progressText") as HTMLElement,
  message: document.getElementById("message") as HTMLElement,
  extractBtn: document.getElementById("extractBtn") as HTMLButtonElement,
  stopBtn: document.getElementById("stopBtn") as HTMLButtonElement,
  csvBtn: document.getElementById("csvBtn") as HTMLButtonElement,
  excelBtn: document.getElementById("excelBtn") as HTMLButtonElement,
  jsonBtn: document.getElementById("jsonBtn") as HTMLButtonElement,
  clearBtn: document.getElementById("clearBtn") as HTMLButtonElement,
  optionsLink: document.getElementById("optionsLink") as HTMLAnchorElement,
};

let state: ExtractState = "IDLE";
let results: Lead[] = [];
let groupName: string | null = null;

function setState(next: ExtractState): void {
  state = next;
  render();
}

/**
 * Find the Telegram Web tab by URL rather than by "active tab". This keeps the
 * window working even when the user focuses another tab, and lets an extraction
 * running in the Telegram tab be observed after the window reopens.
 */
function getTelegramTabId(): Promise<number | null> {
  return new Promise((resolve) => {
    chrome.tabs.query({ url: TELEGRAM_ORIGIN }, (tabs) => {
      const usable = tabs.find((t) => t.id !== undefined);
      resolve(usable?.id ?? null);
    });
  });
}

async function sendToContent(message: Message): Promise<unknown> {
  const tabId = await getTelegramTabId();
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
  const extracting = state === "EXTRACTING";

  els.extractBtn.hidden = extracting;
  els.stopBtn.hidden = !extracting;
  els.extractBtn.disabled = state === "CHECKING";
  els.extractBtn.textContent = state === "CHECKING" ? "Checking…" : "Extract Members";

  els.csvBtn.disabled = !hasResults || extracting;
  els.excelBtn.disabled = !hasResults || extracting;
  els.jsonBtn.disabled = !hasResults || extracting;
  els.clearBtn.disabled = extracting || !hasResults;

  els.progress.hidden = !extracting;
  els.count.textContent = String(results.length);
}

function setTelegramStatus(ready: boolean, isExtractable: boolean): void {
  if (!ready) {
    els.statusDot.className = "status__dot status__dot--warn";
    els.statusText.textContent = "⚠ Open Telegram Web first";
  } else if (!isExtractable) {
    els.statusDot.className = "status__dot status__dot--warn";
    els.statusText.textContent = "⚠ No group detected — open a group or channel";
  } else {
    els.statusDot.className = "status__dot status__dot--ok";
    els.statusText.textContent = "● Telegram Web detected";
  }
  els.groupName.textContent = isExtractable && groupName ? groupName : "—";
}

async function refreshStatus(): Promise<void> {
  setState("CHECKING");
  const res = (await sendToContent({ type: "GET_STATUS" })) as StatusResponse | null;
  clearMessage();

  if (!res) {
    setTelegramStatus(false, false);
    setState("IDLE");
    return;
  }

  groupName = res.groupName;
  setTelegramStatus(res.telegramReady, res.isExtractable);

  if (res.extracting) {
    setState("EXTRACTING");
    return;
  }

  if (res.count > 0) {
    // There are cached results on the content script; pull them so export works
    // even if the window was closed and reopened.
    const cached = (await sendToContent({ type: "GET_RESULTS" })) as
      | { leads: Lead[]; groupName: string | null }
      | null;
    if (cached) {
      results = cached.leads;
      groupName = cached.groupName ?? groupName;
    }
    setState("COMPLETED");
  } else {
    setState(res.isExtractable && res.telegramReady ? "READY" : "IDLE");
  }
}

function onProgress(count: number, phase: string): void {
  els.count.textContent = String(count);
  els.progressText.textContent =
    phase === "scrolling"
      ? `Scrolling member list… Found ${count}`
      : `Extracting members… Found ${count}`;
}

function applyResult(payload: ExtractResult): void {
  results = payload.leads;
  groupName = payload.groupName ?? groupName;
  els.count.textContent = String(results.length);

  if (!payload.completed) {
    const reason = payload.stopReason;
    if (reason === "timeout") {
      showMessage(`Stopped at the time limit. ${results.length} members found — you can still export.`, "info");
      setState("STOPPED");
      return;
    }
    if (reason === "group-changed") {
      showMessage("The open chat changed. The extraction was stopped to avoid mixing members.", "error");
      setState("ERROR");
      return;
    }
    if (reason === "list-unavailable") {
      showMessage(
        "Could not locate the member list. Open the group/channel info → Members, then try again.",
        "error",
      );
      setState("ERROR");
      return;
    }
    if (reason === "user-stopped") {
      showMessage(`Stopped. ${results.length} members found — you can still export.`, "info");
      setState("STOPPED");
      return;
    }
  }

  setState(results.length ? "COMPLETED" : "ERROR");
  if (results.length) {
    showMessage(`Done. ${results.length} members found.`, "info");
  } else {
    showMessage("No members found. Open the member list panel and try again.", "error");
  }
}

/** Handle a runtime message broadcast by the content script. */
function onRuntimeMessage(message: Message): void {
  switch (message.type) {
    case "EXTRACT_PROGRESS":
      onProgress(message.count, message.phase);
      break;
    case "EXTRACT_COMPLETE":
      applyResult(message.payload);
      break;
    case "EXTRACT_ERROR":
      clearMessage();
      showMessage(message.message, "error");
      setState("ERROR");
      break;
    default:
      break;
  }
}

function triggerDownload(blob: Blob, filename: string): void {
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

function downloadText(content: string, filename: string, mime: string): void {
  triggerDownload(new Blob([content], { type: mime }), filename);
}

function exportCsv(): void {
  if (!results.length) return;
  downloadText(toCsv(results), buildFilename(groupName, "csv"), "text/csv;charset=utf-8");
}

function exportJson(): void {
  if (!results.length) return;
  downloadText(toJson(groupName, results), buildFilename(groupName, "json"), "application/json");
}

function exportExcel(): void {
  if (!results.length) return;
  const bytes = toXlsxBytes(results);
  // Copy into a fresh ArrayBuffer-backed view so Blob owns a stable buffer.
  const buffer = bytes.slice().buffer;
  triggerDownload(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    buildFilename(groupName, "xlsx"),
  );
}

function clearResults(): void {
  results = [];
  clearMessage();
  setState(groupName ? "READY" : "IDLE");
  els.count.textContent = "0";
}

function wire(): void {
  els.extractBtn.addEventListener("click", () => {
    clearMessage();
    results = [];
    setState("CHECKING");
    els.progressText.textContent = "Extracting members…";
    void (async () => {
      const ack = (await sendToContent({ type: "START_EXTRACT" })) as { accepted?: boolean } | null;
      if (!ack || !ack.accepted) {
        // No reachable Telegram tab / content script: do not show a fake spinner.
        showMessage(
          "Telegram Web tab not found or not ready. Open web.telegram.org, refresh it once (F5), open a group, then try again.",
          "error",
        );
        setState("IDLE");
        return;
      }
      setState("EXTRACTING");
    })();
  });

  els.stopBtn.addEventListener("click", () => {
    void sendToContent({ type: "STOP_EXTRACT" });
  });

  els.csvBtn.addEventListener("click", exportCsv);
  els.excelBtn.addEventListener("click", exportExcel);
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
