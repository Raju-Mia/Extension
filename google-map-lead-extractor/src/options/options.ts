import { DEFAULT_SETTINGS, SETTINGS_RANGES } from "../shared/constants";
import type { Settings } from "../shared/types";
import { clearRecords, loadRecords, loadSettings, saveSettings } from "../utils/storage";

/** Options page controller: hydrate the form, persist on submit, clear data. */

const form = document.getElementById("settingsForm") as HTMLFormElement;
const saved = document.getElementById("saved") as HTMLElement;
const clearBtn = document.getElementById("clearData") as HTMLButtonElement;

function num(name: string): number {
  const el = form.elements.namedItem(name) as HTMLInputElement;
  return Number(el.value);
}

function bool(name: string): boolean {
  const el = form.elements.namedItem(name) as HTMLInputElement;
  return el.checked;
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizeFormat(value: string): Settings["preferredFormat"] {
  if (value === "excel" || value === "json" || value === "csv") return value;
  return "csv";
}

function hydrate(s: Settings): void {
  (form.elements.namedItem("maxBatches") as HTMLInputElement).value = String(s.maxBatches);
  (form.elements.namedItem("maxBusinesses") as HTMLInputElement).value = String(s.maxBusinesses);
  (form.elements.namedItem("extractDetails") as HTMLInputElement).checked = s.extractDetails;
  (form.elements.namedItem("extractWebsite") as HTMLInputElement).checked = s.extractWebsite;
  (form.elements.namedItem("removeDuplicates") as HTMLInputElement).checked = s.removeDuplicates;
  (form.elements.namedItem("delayMs") as HTMLInputElement).value = String(s.delayMs);
  (form.elements.namedItem("maxScanTimeSec") as HTMLInputElement).value = String(s.maxScanTimeSec);
  const format = form.querySelector<HTMLInputElement>(`input[name="preferredFormat"][value="${s.preferredFormat}"]`);
  if (format) format.checked = true;
}

async function onSubmit(e: SubmitEvent): Promise<void> {
  e.preventDefault();

  // Website extraction is opt-in and needs an extra host permission.
  const websiteEl = form.elements.namedItem("extractWebsite") as HTMLInputElement;
  if (websiteEl.checked) {
    const granted = await chrome.permissions.request({ origins: ["<all_urls>"] }).catch(() => false);
    if (!granted) {
      websiteEl.checked = false;
      flash("Website access was declined — that option stayed off.", true);
    }
  }

  const settings: Settings = {
    maxBatches: clamp(num("maxBatches"), SETTINGS_RANGES.maxBatches.min, SETTINGS_RANGES.maxBatches.max, DEFAULT_SETTINGS.maxBatches),
    maxBusinesses: clamp(num("maxBusinesses"), SETTINGS_RANGES.maxBusinesses.min, SETTINGS_RANGES.maxBusinesses.max, DEFAULT_SETTINGS.maxBusinesses),
    extractDetails: bool("extractDetails"),
    extractWebsite: websiteEl.checked,
    removeDuplicates: bool("removeDuplicates"),
    delayMs: clamp(num("delayMs"), SETTINGS_RANGES.delayMs.min, SETTINGS_RANGES.delayMs.max, DEFAULT_SETTINGS.delayMs),
    maxScanTimeSec: clamp(num("maxScanTimeSec"), SETTINGS_RANGES.maxScanTimeSec.min, SETTINGS_RANGES.maxScanTimeSec.max, DEFAULT_SETTINGS.maxScanTimeSec),
    preferredFormat: normalizeFormat((form.elements.namedItem("preferredFormat") as RadioNodeList | HTMLInputElement).value),
  };
  await saveSettings(settings);
  flash("Saved ✓", false);
}

function flash(text: string, isError: boolean): void {
  saved.textContent = text;
  saved.style.color = isError ? "#d92d20" : "";
  saved.hidden = false;
  setTimeout(() => (saved.hidden = true), 2600);
}

async function updateClearLabel(): Promise<void> {
  const records = await loadRecords();
  clearBtn.textContent = records.length
    ? `Clear all collected records (${records.length})`
    : "Clear all collected records";
}

async function onClear(): Promise<void> {
  const records = await loadRecords();
  if (!records.length) {
    flash("Nothing to clear.", false);
    return;
  }
  if (!window.confirm(`Delete all ${records.length} collected records from this browser?`)) return;
  await clearRecords();
  await updateClearLabel();
  flash("Cleared ✓", false);
}

form.addEventListener("submit", (e) => void onSubmit(e));
clearBtn.addEventListener("click", () => void onClear());

void loadSettings().then(hydrate);
void updateClearLabel();
