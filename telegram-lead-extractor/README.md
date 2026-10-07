# Lead Extractor for Telegram Web

A production-ready **Chrome Extension (Manifest V3)** that exports the member
information **already visible in the Telegram Web interface** for the group or
channel you currently have open, and lets you download it as **CSV**, **Excel
(.xlsx)**, or **JSON**.

It only automates normal UI interactions. It never touches Telegram
authentication, session tokens, cookies, WebSockets, MTProto, or any hidden API.

> **Note on branding:** this extension is an independent tool. It is **not
> affiliated with, endorsed by, or sponsored by Telegram** and uses no
> Telegram trademarks or logo.

---

## Privacy & Security

- ✅ Runs **only** on `https://web.telegram.org/`
- ✅ **No backend**, **no database**, **no network requests**
- ✅ Member data lives **in memory for the current scan only**
- ✅ Data is never uploaded; downloads happen through the browser locally
- ✅ No analytics or tracking
- ✅ No remote JavaScript, no `eval`, Manifest V3 CSP-compliant
- ✅ Only exports information a user can already see in the Telegram Web UI

Telegram almost never displays phone numbers in member lists. If a number is
not shown on screen, the extension exports `phone: null`. It **never** attempts
to reveal hidden information.

---

## Features

- Detects whether a group/channel (not a DM) is open, on both `/a/` and `/k/` clients
- Opens the member list through normal UI clicks (falls back to the visible list)
- Handles **large, virtualized** member lists by overlap-scrolling + de-duplicating
- Captures **Name, @username, Phone (only if visible), Telegram ID, Role**
- **Live progress** ("Found N members") — no fake percentages
- **Stop** button that keeps partial results exportable
- **Timeout protection** so it can never hang forever
- **Group-change protection** — a stale group can't be exported accidentally
- **Real Excel export** — dependency-free OOXML `.xlsx` writer (bold frozen header, proper column widths)
- CSV export with **UTF-8 BOM** so Bengali/Unicode names open correctly in Excel
- Persistent **standalone window** UI — clicking other tabs never kills a running scan
- Options page for scroll delay, max scan time, self-inclusion, and default format

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
npm run package    # build + produce store-ready telegram-lead-extractor.zip
```

> Note: `npm run watch` rebuilds TypeScript automatically. If you edit
> `src/manifest.json`, HTML, or CSS, re-run `npm run build` to copy them across.

---

## Usage

1. Open **Telegram Web** (`https://web.telegram.org/`) and log in normally.
2. Open a **group** or **channel**.
3. Click the extension icon in the toolbar — the extractor opens in its own
   window that stays visible while you navigate.
4. The window shows whether Telegram Web and an extractable chat were detected.
5. Click **Extract Members** and wait — progress updates live.
6. When finished (or after **Stop**), click **Download CSV**, **Download
   Excel**, or **Download JSON**.
7. Use **Clear** to reset, or the **Settings** link to tune behavior.

---

## Data Model

Each exported member contains only genuinely visible fields:

```json
{
  "name": "John Doe",
  "username": "@johndoe",
  "phone": null,
  "telegramId": "123456789",
  "role": "admin"
}
```

CSV columns are `Name, Username, Phone, Telegram ID, Role`. The Excel file uses
the same five columns. JSON is wrapped with group name, `exportedAt`, and `count`.

---

## Project Structure

```text
telegram-lead-extractor/
├── package.json
├── tsconfig.json
├── build.mjs               # esbuild bundling + static asset copy
├── gen-icons.mjs           # dependency-free PNG icon generator (neutral art)
│
├── src/
│   ├── manifest.json
│   ├── background/service-worker.ts
│   ├── content/
│   │   ├── content.ts           # messaging + scan orchestration
│   │   ├── telegram-detector.ts # Telegram Web + group/channel detection
│   │   ├── member-scanner.ts    # scroll loop, dedupe, guards
│   │   ├── member-parser.ts     # isolated DOM parsing
│   │   └── dom-utils.ts         # wait/scroll/click helpers
│   ├── popup/     (popup.html/ts/css)
│   ├── options/   (options.html/ts/css)
│   ├── shared/    (types.ts, messages.ts, constants.ts)
│   └── utils/     (csv.ts, excel.ts, json.ts, filename.ts, storage.ts)
│
├── icons/         (icon16/32/48/128.png)
├── docs/          (Chrome Web Store guide, privacy policy)
└── dist/          (build output — load this in Chrome)
```

---

## Architecture Notes

- **Selector resilience:** Telegram's class names change between builds. All
  selectors live in `src/shared/constants.ts` as ordered arrays. The extension
  prefers `aria-label`s, `data-peer-id`, roles, and visible text over hashed
  classes, and tries each strategy in order. Update selectors there without
  touching the scanner.
- **Parser isolation:** `member-parser.ts` absorbs DOM changes so the scan loop
  (`member-scanner.ts`) stays stable.
- **Export independence:** CSV/Excel/JSON generation (`src/utils/`) never
  imports scraping logic.
- **Persistent window:** the manifest has no `default_popup`; the service
  worker opens `popup.html` via `chrome.windows.create` so scans survive tab
  switches.

---

## Limitations

- The Telegram Web UI can change at any time; selectors may need updating.
- Phone numbers are almost never exposed in Telegram's member list and
  therefore cannot be exported (and never will be).
- Only UI-accessible information can be exported.
- Very large groups may take longer and are bounded by the max-scan timeout.
- Telegram's virtualized list can re-render rows; de-duplication handles it but
  is ultimately limited by what the UI renders.
- This extension does **not** and will **not** bypass any privacy restriction.

---

## Testing Checklist

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Direct chat (DM) | "Not a group/channel" message |
| 2 | Small group | All visible members collected |
| 3 | Large group (10k+) | Overlap scrolling works, no duplicates |
| 4 | Channel | Subscriber list extracted |
| 5 | Admins/bots | Role captured when visible |
| 6 | Member w/o visible phone | `phone = null` |
| 7 | Duplicate rows during scroll | Single record per member |
| 8 | Click Stop | Scan stops; partial results exportable |
| 9 | Change chat mid-scan | Scan stops |
| 10 | UI changes | Graceful error, no crash |
| 11 | Bengali names | CSV opens correctly in Excel (BOM) |
| 12 | Excel output | Opens in Excel/LibreOffice with header row |

---

## Publishing to the Chrome Web Store

See [`docs/CHROME-WEB-STORE-GUIDE.md`](./docs/CHROME-WEB-STORE-GUIDE.md) and the
hostable [`docs/PRIVACY-POLICY.md`](./docs/PRIVACY-POLICY.md).

---

## License

MIT — provided as-is for legitimate export of data you can already access.
Respect Telegram's Terms of Service and the privacy of group members.
