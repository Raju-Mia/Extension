import { SETTINGS_RANGES, extractSearchQuery, log } from "../shared/constants";
import type { Message } from "../shared/messages";
import type { Session, Settings } from "../shared/types";
import { toCsv } from "../utils/csv";
import { toXlsxBytes } from "../utils/excel";
import { buildFilename } from "../utils/filename";
import { toJson } from "../utils/json";
import { loadRecords, loadSettings, saveSettings } from "../utils/storage";

/**
 * Popup-window controller. It is a thin, local dashboard: it asks the background
 * to drive the collector window, mirrors live progress from broadcast messages,
 * and produces CSV / Excel / JSON downloads entirely in the browser.
 */

const els = {
  statusDot: document.getElementById("statusDot") as HTMLElement,
  statusText: document.getElementById("statusText") as HTMLElement,
  searchInput: document.getElementById("searchInput") as HTMLInputElement,
  detectBtn: document.getElementById("detectBtn") as HTMLButtonElement,
  maxBatches: document.getElementById("maxBatches") as HTMLInputElement,
  maxBusinesses: document.getElementById("maxBusinesses") as HTMLInputElement,
  extractDetails: document.getElementById("extractDetails") as HTMLInputElement,
  extractWebsite: document.getElementById("extractWebsite") as HTMLInputElement,
  removeDuplicates: document.getElementById("removeDuplicates") as HTMLInputElement,
  stats: document.getElementById("stats") as HTMLElement,
  statFound: document.getElementById("statFound") as HTMLElement,
  statProcessed: document.getElementById("statProcessed") as HTMLElement,
  statNew: document.getElementById("statNew") as HTMLElement,
  statDupes: document.getElementById("statDupes") as HTMLElement,
  current: document.getElementById("current") as HTMLElement,
  barFill: document.getElementById("barFill") as HTMLElement,
  progressText: document.getElementById("progressText") as HTMLElement,
  message: document.getElementById("message") as HTMLElement,
  startBtn: document.getElementById("startBtn") as HTMLButtonElement,
  runRow: document.getElementById("runRow") as HTMLElement,
  pauseBtn: document.getElementById("pauseBtn") as HTMLButtonElement,
  resumeBtn: document.getElementById("resumeBtn") as HTMLButtonElement,
  stopBtn: document.getElementById("stopBtn") as HTMLButtonElement,
  csvBtn: document.getElementById("csvBtn") as HTMLButtonElement,
  excelBtn: document.getElementById("excelBtn") as HTMLButtonElement,
  jsonBtn: document.getElementById("jsonBtn") as HTMLButtonElement,
  resultsBtn: document.getElementById("resultsBtn") as HTMLButtonElement,
  clearBtn: document.getElementById("clearBtn") as HTMLButtonElement,
  optionsLink: document.getElementById("optionsLink") as HTMLAnchorElement,
};

let activeSearch: string | null = null;

function send(message: Message): Promise<any> {
  return chrome.runtime.sendMessage(message).catch(() => undefined);
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
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

/* ----------------------------------------------------------- quick config */

async function hydrateQuick(): Promise<void> {
  const s = await loadSettings();
  els.maxBatches.value = String(s.maxBatches);
  els.maxBusinesses.value = String(s.maxBusinesses);
  els.extractDetails.checked = s.extractDetails;
  els.extractWebsite.checked = s.extractWebsite;
  els.removeDuplicates.checked = s.removeDuplicates;
}

async function persistQuick(): Promise<Settings> {
  const cur = await loadSettings();
  const next: Settings = {
    ...cur,
    maxBatches: clamp(Number(els.maxBatches.value), SETTINGS_RANGES.maxBatches.min, SETTINGS_RANGES.maxBatches.max, cur.maxBatches),
    maxBusinesses: clamp(Number(els.maxBusinesses.value), SETTINGS_RANGES.maxBusinesses.min, SETTINGS_RANGES.maxBusinesses.max, cur.maxBusinesses),
    extractDetails: els.extractDetails.checked,
    extractWebsite: els.extractWebsite.checked,
    removeDuplicates: els.removeDuplicates.checked,
  };
  await saveSettings(next);
  return next;
}

/** Enabling website extraction needs an extra host permission (opt-in). */
async function onWebsiteToggle(): Promise<void> {
  if (!els.extractWebsite.checked) {
    await persistQuick();
    return;
  }
  const granted = await chrome.permissions.request({ origins: ["<all_urls>"] }).catch(() => false);
  if (!granted) {
    els.extractWebsite.checked = false;
    await persistQuick();
    showMessage("Website extraction needs permission to visit business sites. It stays off.", "error");
    return;
  }
  await persistQuick();
  showMessage("Website extraction on: it also reads each business's public site for email & social.", "info");
}

/* --------------------------------------------------------------- rendering */

function setStatus(kind: "unknown" | "ok" | "run" | "warn", text: string): void {
  els.statusDot.className = `status__dot status__dot--${kind}`;
  els.statusText.textContent = text;
}

function isRunning(status?: string): boolean {
  return status === "LIST" || status === "DETAILS" || status === "PAUSED";
}

function renderSession(s: Session | null): void {
  const status = s?.status ?? "IDLE";
  if (s?.searchQuery) activeSearch = s.searchQuery;

  els.runRow.hidden = !isRunning(status);
  els.startBtn.hidden = isRunning(status);
  els.startBtn.textContent = status === "COMPLETED" || status === "STOPPED" ? "Start new extraction" : "Start Extraction";
  els.pauseBtn.hidden = status === "PAUSED";
  els.resumeBtn.hidden = status !== "PAUSED";

  if (s && (s.stats.total > 0 || s.stats.found > 0)) showStats();

  switch (status) {
    case "LIST":
      setStatus("run", "Extracting — collecting results…");
      break;
    case "DETAILS":
      setStatus("run", "Extracting — reading business details…");
      break;
    case "PAUSED":
      setStatus("warn", "Paused");
      break;
    case "COMPLETED":
      setStatus("ok", "Extraction complete");
      break;
    case "STOPPED":
      setStatus("warn", "Stopped");
      break;
    case "ERROR":
      setStatus("warn", "Error");
      break;
    default:
      setStatus("unknown", "Ready");
  }

  if (s) paintStats(s.stats, status);
  showCompletionNote(status, s?.stats ?? null);
}

/**
 * A single clear sentence in the existing banner so the user instantly knows the
 * run finished and what to do next. No new popup — it reuses the message strip.
 */
function showCompletionNote(status: string, stats: Session["stats"] | null): void {
  const hasData = !!stats && stats.found > 0;
  if (!hasData || (status !== "COMPLETED" && status !== "STOPPED")) return;
  const unique = stats!.found;
  const dupNote = stats!.duplicates > 0 ? ` (${stats!.duplicates} duplicate${stats!.duplicates === 1 ? "" : "s"} removed)` : "";
  if (status === "COMPLETED") {
    showMessage(`Done! Collected ${unique} business${unique === 1 ? "" : "es"}${dupNote}. Download CSV/Excel/JSON or view results below.`, "info");
  } else {
    showMessage(`Stopped. ${unique} business${unique === 1 ? "" : "es"} saved so far${dupNote} — you can still export them below.`, "info");
  }
}

function showStats(): void {
  els.stats.hidden = false;
}

function paintStats(stats: Session["stats"], status: string): void {
  els.statFound.textContent = String(stats.found);
  els.statProcessed.textContent = String(stats.processed);
  els.statNew.textContent = String(stats.newCount);
  els.statDupes.textContent = String(stats.duplicates);

  const cap = clamp(Number(els.maxBusinesses.value) || stats.total || 1, 1, 100000, 1);
  if (status === "COMPLETED") {
    els.barFill.style.width = "100%";
    els.progressText.textContent = "Done";
    return;
  }
  const ratio = status === "DETAILS" && stats.total ? stats.processed / stats.total : Math.min(stats.found / cap, 1);
  els.barFill.style.width = `${Math.round(Math.min(ratio, 1) * 100)}%`;
}

function enableExportButtons(count: number): void {
  const disabled = count === 0;
  els.csvBtn.disabled = disabled;
  els.excelBtn.disabled = disabled;
  els.jsonBtn.disabled = disabled;
  els.resultsBtn.disabled = disabled;
  els.clearBtn.disabled = disabled;
}

/* ------------------------------------------------------------- downloads */

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

async function download(kind: "csv" | "xlsx" | "json"): Promise<void> {
  const records = await loadRecords();
  if (!records.length) return;
  const filename = buildFilename(activeSearch, kind);
  if (kind === "csv") triggerDownload(new Blob([toCsv(records)], { type: "text/csv;charset=utf-8" }), filename);
  else if (kind === "json") triggerDownload(new Blob([toJson(activeSearch, records)], { type: "application/json" }), filename);
  else {
    const buffer = toXlsxBytes(records).slice().buffer;
    triggerDownload(
      new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      filename,
    );
  }
}

/* ----------------------------------------------------------- operations */

function resolveSearch(raw: string): { searchUrl: string; searchQuery: string | null } | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return { searchUrl: v, searchQuery: extractSearchQuery(v) };
  return { searchUrl: `https://www.google.com/maps/search/${encodeURIComponent(v)}`, searchQuery: v };
}

async function onStart(): Promise<void> {
  await persistQuick();
  const resolved = resolveSearch(els.searchInput.value);
  if (!resolved) {
    showMessage("Enter a search term or paste a Google Maps URL first.", "error");
    return;
  }
  activeSearch = resolved.searchQuery;
  clearMessage();
  const ack = await send({ type: "START", searchUrl: resolved.searchUrl, searchQuery: resolved.searchQuery });
  if (!ack?.ok) {
    showMessage(ack?.error ?? "Could not start the extraction.", "error");
    return;
  }
  showStats();
  setStatus("run", "Opening the collector window…");
}

async function refresh(): Promise<void> {
  const session = (await send({ type: "GET_SESSION" })) as Session | null;
  renderSession(session);
  const records = await loadRecords();
  enableExportButtons(records.length);
}

/* -------------------------------------------------------------- runtime */

function onBroadcast(message: Message): void {
  switch (message.type) {
    case "EXTRACT_PROGRESS":
      showStats();
      paintStats(message.stats, message.phase);
      els.current.textContent = `Current: ${message.current ?? "—"}`;
      if (message.current && /export|limit|ready/i.test(message.current)) {
        showMessage(message.current, "info");
      }
      break;
    case "EXTRACT_COMPLETE":
      showStats();
      paintStats(message.stats, "COMPLETED");
      setStatus("ok", "Extraction complete");
      showCompletionNote("COMPLETED", message.stats);
      void refresh();
      break;
    case "EXTRACT_ERROR":
      showMessage(message.message, "error");
      void refresh();
      break;
    default:
      break;
  }
}

function wire(): void {
  els.startBtn.addEventListener("click", () => void onStart());
  els.pauseBtn.addEventListener("click", () => void send({ type: "PAUSE" }).then(refresh));
  els.resumeBtn.addEventListener("click", () => void send({ type: "RESUME" }).then(refresh));
  els.stopBtn.addEventListener("click", () => void send({ type: "STOP" }).then(refresh));
  els.csvBtn.addEventListener("click", () => void download("csv"));
  els.excelBtn.addEventListener("click", () => void download("xlsx"));
  els.jsonBtn.addEventListener("click", () => void download("json"));
  els.resultsBtn.addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL("results.html") }));
  els.clearBtn.addEventListener("click", () => {
    if (!window.confirm("Delete all collected records from this browser?")) return;
    void send({ type: "CLEAR_RESULTS" }).then(() => {
      clearMessage();
      showMessage("Cleared.", "info");
      void refresh();
    });
  });

  els.detectBtn.addEventListener("click", () => {
    void (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url && /google\./.test(tab.url) && /\/maps|search\?q=/.test(tab.url)) {
        els.searchInput.value = tab.url;
      } else {
        showMessage("Switch to a Google Maps tab first, then click again.", "error");
      }
    })();
  });

  els.extractWebsite.addEventListener("change", () => void onWebsiteToggle());
  for (const el of [els.maxBatches, els.maxBusinesses, els.extractDetails, els.removeDuplicates]) {
    el.addEventListener("change", () => void persistQuick());
  }

  els.optionsLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

chrome.runtime.onMessage.addListener((message: Message) => onBroadcast(message));

async function init(): Promise<void> {
  await hydrateQuick();
  wire();
  await refresh();
  // Poll so the dashboard stays correct even if a broadcast is missed while
  // the window is unfocused, or the crawl is controlled from another context.
  setInterval(() => void refresh(), 1800);
  log("popup ready");
}

void init();
