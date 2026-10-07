# Lead Extractor for Google Maps

A production-ready **Chrome Extension (Manifest V3)** that collects the business
information **already visible in Google Maps search results** you are looking at,
and lets you download it as **CSV**, **Excel (.xlsx)**, or **JSON**.

It needs **no API key, no Google Cloud account, no billing, and no server.** It
only automates normal interactions with the Maps page you already have open. It
never bypasses CAPTCHAs, logins, or access controls, and never uploads anything.

> **Note on branding:** this extension is an independent tool. It is **not
> affiliated with, endorsed by, or sponsored by Google** and uses no Google
> trademarks or logo.

---

## Privacy & Security

- ✅ Runs **only** on `https://www.google.com/maps/` and `https://maps.google.com/`
- ✅ **No backend**, **no database**, **no analytics, no tracking**
- ✅ Collected rows live in `chrome.storage.local` **on your device only**
- ✅ Nothing is ever transmitted; exports are saved through Chrome's download API
- ✅ No remote JavaScript, no `eval`, Manifest V3 CSP-compliant
- ✅ Optional website lookup is **off by default** and requires an explicit
  permission grant before any business site is opened
- ✅ Only exports information a user can already see in the public Maps UI

If a field isn't shown by Google Maps, the extension leaves it **blank**. It
never invents data and never attempts to reveal hidden information.

---

## How the collector window works (important)

When you click **Start Extraction**, the extension does **not** touch the tab
you are working in. Instead the background service worker opens a **separate,
unfocused Google Maps window** — the *collector window* — and runs the crawl
there.

- Your current Maps tab stays exactly as it was; keep browsing normally.
- Only the designated collector tab is allowed to crawl. Every page load the
  content script asks the background `AM_I_COLLECTOR`; if this tab isn't the
  collector (or no active session is running), it stays completely idle. This is
  what prevents your own tab from being hijacked.
- A separate window (rather than a background tab) is used on purpose so the
  crawl isn't throttled by Chrome's invisible-tab timer limits.
- If you close the collector window mid-run, the crawl stops gracefully and the
  rows collected so far remain exportable.

### Two-phase crawl (batch system)

Google Maps uses an infinite-scroll results panel, not numbered pages, so the
extension works in two phases:

1. **LIST phase** — it overlap-scrolls the results panel (the left `div[role="feed"]`),
   reading each newly rendered result card. Each "batch" is a scroll + settle
   cycle. It de-duplicates as it goes and stops when the **batch limit** is
   reached, the **business cap** is hit, no new cards appear after several
   scrolls, or you press Stop.
2. **DETAILS phase** (optional) — it then opens each collected place **one page
   load at a time** to read phone, address, hours, rating, etc. The current
   position (cursor) is persisted, so a reload or an accidental tab-close
   **resumes** where it left off instead of restarting.

---

## Features

- Detects the search query from a Maps URL (`/maps/search/...` or `?q=`), or lets you type one / paste a URL
- **Batch scrolling** with a configurable cap (default **5 batches**, max **500 businesses**)
- Optional **per-business details** pass for the full 24-field record
- Optional **website enrichment** (email + Facebook/Instagram/LinkedIn/YouTube/TikTok) — off by default, permission-gated, limited to homepage + up to 2 contact/about pages
- **Live progress** in a standalone window: Found / Processed / New / Dupes + progress bar
- **Pause / Resume / Stop** that preserve data and keep partial results exportable
- **Mandatory de-duplication** by place ID, and by name+phone / name+address, with field **merging** (a later, richer record fills gaps without erasing)
- **Phone normalization** into `Phone` + `Phone Original` columns (e.g. `09666-787807` → `09666787807`); multiple numbers joined with `;`
- **Real Excel export** — dependency-free OOXML `.xlsx` writer (styled frozen header, per-column widths)
- CSV with **UTF-8 BOM** so Bangla/Unicode (e.g. `ঢাকা মিরপুর হাসপাতাল`) opens correctly in Excel
- **Results table** page — filter, sort, delete-row, clear-all, and CSV export of what's visible
- **Timeout protection** so a crawl can never hang forever
- Robust **ordered-fallback selectors** (aria-label / role / data-item-id / href / text) instead of one fragile class

---

## Installation (load into Chrome)

1. Make sure you have **Node.js 18+** installed.
2. From the project root:

   ```bash
   npm install
   npm run build
   ```

   (Icons are already generated. To regenerate them: `npm run icons`.)

3. Open Chrome and go to:

   ```text
   chrome://extensions
   ```

4. Enable **Developer mode** (top-right toggle).
5. Click **Load unpacked**.
6. Select the **`dist`** folder produced by the build.

---

## Development

```bash
npm run build      # one-shot production build → dist/
npm run watch      # rebuild TypeScript on change
npm run typecheck  # tsc --noEmit
npm run clean      # remove dist/
npm run icons      # regenerate extension icons (gen-icons.mjs)
npm run package    # build + produce store-ready google-map-lead-extractor.zip
```

> `npm run watch` rebuilds TypeScript automatically. If you edit
> `src/manifest.json`, HTML, or CSS, re-run `npm run build` to copy them across.

---

## Usage

1. Go to **Google Maps** and run a search, e.g.
   `https://www.google.com/maps/search/dhaka+mirpur+hospital`.
2. Click the extension icon — the extractor opens in its own window that stays
   available while Maps loads.
3. The search is auto-detected. Adjust **Batches**, **Max**, and the
   **Details / Website / Dedupe** toggles if you want.
4. Click **Start Extraction**. A separate collector window opens and the crawl
   runs there — watch Found / Processed / New / Dupes update live.
5. Use **Pause / Resume / Stop** at any time.
6. When finished (or after Stop), click **CSV**, **Excel**, or **JSON** to
   export, or **View results** to inspect the table first.
7. **Clear** wipes stored records; **Settings** tunes delays and limits.

### Enabling website extraction

Turn on the **Website** toggle (popup) or **Visit each business's public
website…** (Options). The first time, Chrome shows a permission prompt to access
business websites. If you decline, the toggle reverts and website lookup is
skipped — the Maps-only crawl still works.

---

## Export columns (24)

Every export uses this exact order (see `src/utils/columns.ts`, the single
source of truth shared by CSV, Excel, JSON, and the results table):

`Business Name, Category, Phone, Phone Original, Email, Website, Facebook,
Instagram, LinkedIn, YouTube, TikTok, Rating, Review Count, Business Status,
Opening Hours, Services, Description, Address, Plus Code, Latitude, Longitude,
Google Maps URL, Search Query, Extraction Date`

Missing values are left blank — never fabricated.

---

## Project Structure

```text
google-map-lead-extractor/
├── package.json
├── tsconfig.json
├── build.mjs               # esbuild bundling + static asset copy
├── gen-icons.mjs           # dependency-free PNG icon generator (neutral art)
│
├── src/
│   ├── manifest.json
│   ├── background/service-worker.ts  # collector-window orchestrator + resume handshake + opt-in website fetch
│   ├── content/
│   │   ├── content.ts       # handshake boot + control listeners
│   │   ├── extractor.ts     # two-phase LIST + DETAILS state machine
│   │   ├── parsers.ts       # result-card + place-panel DOM parsing (fallbacks)
│   │   ├── maps-detector.ts # is-maps / page-kind / wait-for-maps
│   │   └── dom-utils.ts     # wait/scroll/click/text helpers
│   ├── popup/     (popup.html/ts/css)   # standalone dashboard window
│   ├── options/   (options.html/ts/css) # full settings + clear data
│   ├── results/   (results.html/ts/css) # sortable/filterable table + CSV
│   ├── shared/    (types.ts, messages.ts, constants.ts)
│   └── utils/     (columns.ts, csv.ts, excel.ts, json.ts, filename.ts, normalize.ts, storage.ts)
│
├── icons/         (icon16/32/48/128.png)
├── docs/          (Chrome Web Store guide, privacy policy)
└── dist/          (build output — load this in Chrome)
```

---

## Architecture Notes

- **One collector, resumable:** the crawl state (`Session`) — status, search,
  `collectorTabId`, the queued place URLs, and the DETAILS **cursor** — is
  persisted in `chrome.storage.local`. The content script re-asserts itself on
  every Maps load via the `AM_I_COLLECTOR` handshake, so reloads and navigation
  between place pages continue from the stored cursor.
- **Clean ownership split:** the **content script** owns crawl persistence
  (upserting records + updating the session), while the **background worker**
  owns tab/window lifecycle, status relay, and the cross-origin **website fetch**
  (a content-script `fetch` would be CORS-blocked; the service worker has the
  granted host permission). This avoids double-writer races.
- **Selector resilience:** every Google Maps selector lives in
  `src/shared/constants.ts` as an **ordered fallback array**, preferring
  `aria-label`, `role`, `data-item-id`, and `href`/`tel:` patterns over hashed
  class names. Update them there without touching the crawler.
- **Dedup/merge:** `utils/normalize.ts` derives a stable place key and merges a
  richer record into an existing one field-by-field, filling only blanks.
- **Persistent window:** the manifest has no `default_popup`; the service worker
  opens `popup.html` via `chrome.windows.create`, so the dashboard survives Maps
  navigation.
- **XSS-safe UI:** the results table builds every cell with `textContent` /
  `setAttribute`, so scraped text can never inject markup. CSV export guards
  against formula injection (leading `= + - @` are neutralized).

---

## Limitations

- **Google Maps' DOM changes frequently.** The selector arrays are best-effort
  and must be re-verified against the live DOM; when Google ships a new layout
  you may need to update `src/shared/constants.ts`.
- Google Maps caps how many results a single search exposes; scrolling stops
  when the feed reports "You've reached the end of the list."
- Emails are rarely shown in Maps directly — the **Email** column stays blank
  unless website enrichment finds a publicly displayed address.
- Website enrichment is slow and best-effort; many sites block automated
  requests, and any that do are simply skipped (blank fields).
- Lat/Long and Plus Code are captured when present in the page/URL, not from a
  Places API (there is none).
- This extension does **not** and will **not** bypass any login, CAPTCHA, or
  privacy restriction.

---

## Testing Checklist

Test with queries such as `dhaka mirpur hospital`, `dhaka diagnostic center`,
`mirpur restaurant`, and `dhaka dental clinic`.

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Type a plain query, Start | Builds a Maps search URL, opens collector window |
| 2 | User's current tab | Untouched; still browsable during a run |
| 3 | Small search | All visible results collected, no duplicates |
| 4 | Details on | Phone/address/hours filled where visible |
| 5 | Details off | Only list-level fields; noticeably faster |
| 6 | Website on + allow | Email/social populated where public |
| 7 | Website on + deny | Toggle reverts; crawl continues, email blank |
| 8 | Same business, richer detail | Fields merged, never erased |
| 9 | Pause then Resume | Crawl continues from where it stopped |
| 10 | Close collector mid-run | Stops gracefully; partial results exportable |
| 11 | Bangla query/names | CSV opens correctly in Excel (BOM) |
| 12 | Excel output | Opens in Excel/LibreOffice with styled header |
| 13 | Reload during DETAILS | Resumes from stored cursor |

---

## Publishing to the Chrome Web Store

See [`docs/CHROME-WEB-STORE-GUIDE.md`](./docs/CHROME-WEB-STORE-GUIDE.md) and the
hostable [`docs/PRIVACY-POLICY.md`](./docs/PRIVACY-POLICY.md).

---

## License

MIT — provided as-is for legitimate export of data you can already access.
Respect Google's Terms of Service and the applicable laws in your region.
