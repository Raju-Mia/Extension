import type { Settings } from "../shared/constants";
import { DEFAULT_SETTINGS, SETTINGS_RANGES } from "../shared/constants";
import { loadSettings, saveSettings } from "../utils/storage";

/** Options page controller: hydrate the form, persist on submit. */

const form = document.getElementById("settingsForm") as HTMLFormElement;
const saved = document.getElementById("saved") as HTMLElement;

function num(name: string): number {
  const el = form.elements.namedItem(name) as HTMLInputElement;
  return Number(el.value);
}

function bool(name: string): boolean {
  const el = form.elements.namedItem(name) as HTMLInputElement;
  return el.checked;
}

function str(name: string): string {
  const el = form.elements.namedItem(name) as HTMLInputElement;
  const radio = form.elements.namedItem(name) as RadioNodeList | HTMLInputElement;
  return "value" in radio ? String(radio.value) : el.value;
}

function hydrate(s: Settings): void {
  (form.elements.namedItem("scrollDelay") as HTMLInputElement).value = String(s.scrollDelay);
  (form.elements.namedItem("maxScanTimeSec") as HTMLInputElement).value = String(s.maxScanTimeSec);
  (form.elements.namedItem("autoOpenGroupInfo") as HTMLInputElement).checked = s.autoOpenGroupInfo;
  (form.elements.namedItem("includeSelf") as HTMLInputElement).checked = s.includeSelf;
  (form.elements.namedItem("saveHistory") as HTMLInputElement).checked = s.saveHistory;
  const format = form.querySelector<HTMLInputElement>(`input[name="preferredFormat"][value="${s.preferredFormat}"]`);
  if (format) format.checked = true;
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

async function onSubmit(e: SubmitEvent): Promise<void> {
  e.preventDefault();
  const settings: Settings = {
    scrollDelay: clamp(num("scrollDelay"), SETTINGS_RANGES.scrollDelay.min, SETTINGS_RANGES.scrollDelay.max, DEFAULT_SETTINGS.scrollDelay),
    maxScanTimeSec: clamp(num("maxScanTimeSec"), SETTINGS_RANGES.maxScanTimeSec.min, SETTINGS_RANGES.maxScanTimeSec.max, DEFAULT_SETTINGS.maxScanTimeSec),
    autoOpenGroupInfo: bool("autoOpenGroupInfo"),
    includeSelf: bool("includeSelf"),
    preferredFormat: str("preferredFormat") === "json" ? "json" : "csv",
    saveHistory: bool("saveHistory"),
  };
  await saveSettings(settings);
  saved.hidden = false;
  setTimeout(() => (saved.hidden = true), 1800);
}

form.addEventListener("submit", (e) => void onSubmit(e));
void loadSettings().then(hydrate);
