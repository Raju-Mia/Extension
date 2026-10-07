import type { Business } from "../shared/types";
import { toCsv } from "../utils/csv";
import { buildFilename } from "../utils/filename";
import { clearRecords, loadRecords, loadSession, saveRecords } from "../utils/storage";

/**
 * Results table. Reads records from chrome.storage, and supports filter,
 * column sort, per-row delete, clear-all, and CSV export of what's visible.
 * All cells are built with textContent / setAttribute so scraped text can never
 * inject markup.
 */

const els = {
  rows: document.getElementById("rows") as HTMLTableSectionElement,
  head: document.getElementById("head") as HTMLTableRowElement,
  count: document.getElementById("count") as HTMLElement,
  search: document.getElementById("search") as HTMLInputElement,
  exportCsv: document.getElementById("exportCsv") as HTMLButtonElement,
  clearAll: document.getElementById("clearAll") as HTMLButtonElement,
  empty: document.getElementById("empty") as HTMLElement,
};

interface Column {
  key: keyof Business;
  numeric?: boolean;
}

const COLUMNS: Column[] = [
  { key: "businessName" },
  { key: "category" },
  { key: "phone" },
  { key: "email" },
  { key: "website" },
  { key: "facebook" },
  { key: "rating", numeric: true },
  { key: "reviewCount", numeric: true },
  { key: "address" },
  { key: "businessStatus" },
];

let records: Business[] = [];
let sortKey: keyof Business | null = null;
let sortDir: 1 | -1 = 1;
let filter = "";
let activeSearch: string | null = null;

function textCell(value: string | null): HTMLTableCellElement {
  const td = document.createElement("td");
  if (value) td.textContent = value;
  else {
    td.textContent = "—";
    td.className = "muted";
  }
  return td;
}

function linkCell(url: string | null, label: string): HTMLTableCellElement {
  const td = document.createElement("td");
  if (!url) {
    td.textContent = "—";
    td.className = "muted";
    return td;
  }
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = label;
  td.appendChild(a);
  return td;
}

function matches(b: Business): boolean {
  if (!filter) return true;
  const hay = [b.businessName, b.category, b.phone, b.email, b.address]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(filter);
}

function compare(a: Business, b: Business): number {
  if (!sortKey) return 0;
  const col = COLUMNS.find((c) => c.key === sortKey);
  const av = a[sortKey] ?? "";
  const bv = b[sortKey] ?? "";
  if (col?.numeric) {
    const an = parseFloat(String(av)) || 0;
    const bn = parseFloat(String(bv)) || 0;
    return (an - bn) * sortDir;
  }
  return String(av).localeCompare(String(bv), undefined, { numeric: true }) * sortDir;
}

function render(): void {
  els.rows.textContent = "";
  let list = records.filter(matches);
  if (sortKey) list = [...list].sort(compare);

  els.count.textContent = String(filter ? list.length : records.length);
  els.empty.hidden = list.length > 0;

  for (const b of list) {
    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    if (b.mapsUrl) {
      const a = document.createElement("a");
      a.href = b.mapsUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = b.businessName ?? "(unnamed)";
      nameTd.appendChild(a);
    } else {
      nameTd.textContent = b.businessName ?? "(unnamed)";
    }
    tr.appendChild(nameTd);

    tr.appendChild(textCell(b.category));
    tr.appendChild(textCell(b.phone));
    tr.appendChild(textCell(b.email));
    tr.appendChild(linkCell(b.website, hostLabel(b.website)));
    tr.appendChild(linkCell(b.facebook, "Facebook"));

    const ratingTd = textCell(b.rating);
    ratingTd.className = "num";
    tr.appendChild(ratingTd);
    const reviewsTd = textCell(b.reviewCount);
    reviewsTd.className = "num";
    tr.appendChild(reviewsTd);

    tr.appendChild(textCell(b.address));
    tr.appendChild(textCell(b.businessStatus));

    const actionTd = document.createElement("td");
    const del = document.createElement("button");
    del.className = "del";
    del.type = "button";
    del.textContent = "Delete";
    del.addEventListener("click", () => void removeRow(b.placeId));
    actionTd.appendChild(del);
    tr.appendChild(actionTd);

    els.rows.appendChild(tr);
  }
}

function hostLabel(url: string | null): string {
  if (!url) return "Open";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Open";
  }
}

async function removeRow(placeId: string): Promise<void> {
  records = records.filter((r) => r.placeId !== placeId);
  await saveRecords(records);
  render();
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

function exportCsv(): void {
  const visible = records.filter(matches);
  if (!visible.length) return;
  const list = sortKey ? [...visible].sort(compare) : visible;
  triggerDownload(new Blob([toCsv(list)], { type: "text/csv;charset=utf-8" }), buildFilename(activeSearch, "csv"));
}

async function onClearAll(): Promise<void> {
  if (!records.length) return;
  if (!window.confirm(`Delete all ${records.length} collected records from this browser?`)) return;
  await clearRecords();
  records = [];
  render();
}

function wireHead(): void {
  Array.from(els.head.querySelectorAll<HTMLTableCellElement>("th[data-key]")).forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.key as keyof Business;
      if (sortKey === key) sortDir = sortDir === 1 ? -1 : 1;
      else {
        sortKey = key;
        sortDir = 1;
      }
      Array.from(els.head.querySelectorAll("th")).forEach((h) => (h.className = h.className.replace(/\s*\b(sorted|asc|desc)\b/g, "").trim()));
      th.classList.add("sorted", sortDir === 1 ? "asc" : "desc");
      render();
    });
  });
}

async function reload(): Promise<void> {
  records = await loadRecords();
  render();
}

chrome.runtime.onMessage.addListener((message: { type: string }) => {
  if (message.type === "EXTRACT_PROGRESS" || message.type === "EXTRACT_COMPLETE") void reload();
});

function init(): void {
  wireHead();
  els.search.addEventListener("input", () => {
    filter = els.search.value.trim().toLowerCase();
    render();
  });
  els.exportCsv.addEventListener("click", exportCsv);
  els.clearAll.addEventListener("click", () => void onClearAll());
  void loadSession().then((s) => {
    activeSearch = s?.searchQuery ?? null;
  });
  void reload();
}

init();
