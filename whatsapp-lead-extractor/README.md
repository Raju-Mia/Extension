# Lead Extractor for WhatsApp Web

A production-ready **Chrome Extension (Manifest V3)** that exports the
participant information **already visible in the WhatsApp Web interface** for the
group you currently have open, and lets you download it as **CSV** or **JSON**.

> **Note on branding:** this extension is an independent tool. It is **not
> affiliated with, endorsed by, or sponsored by WhatsApp** and uses no
> WhatsApp trademarks or logo.

It only automates normal UI interactions. It never touches WhatsApp
authentication, session tokens, cookies, WebSockets, private databases, or any
hidden API.

---

## Privacy & Security

- ✅ Runs **only** on `https://web.whatsapp.com/`
- ✅ **No backend**, **no database**, **no network requests**
- ✅ Participant data lives **in memory for the current scan only**
- ✅ Data is never uploaded; downloads happen through the browser locally
- ✅ No analytics or tracking
- ✅ No remote JavaScript, no `eval`, Manifest V3 CSP-compliant
- ✅ Only exports information a user can already see in the WhatsApp Web UI

If WhatsApp does not display a participant's phone number, the extension
exports `phone: null`. It **never** attempts to reveal hidden information.

---

## Features

- Detects whether a group (not an individual chat) is open
- Opens the group info / participant list through normal clicks
- Handles **large, virtualized** participant lists by scrolling + de-duplicating
- **Live progress** ("Found N participants") — no fake percentages
- **Stop** button that keeps partial results exportable
- **Timeout protection** so it can never hang forever
- **Group-change protection** — a stale group can't be exported accidentally
- CSV export with **UTF-8 BOM** so Bengali/Unicode names open correctly in Excel
- Clean, pretty-printed JSON export
- Sensible auto-generated filenames
- Options page for scan delay, max time, and export preferences

---

## Installation (load into Chrome)

1. Make sure you have **Node.js 18+** installed.
2. From the project root:

   ```bash
   npm install
   npm run build
   ```

   (Icons are already generated. To regenerate them: `node gen-icons.mjs`.)

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
npm run clean      # remove dist/
node gen-icons.mjs # regenerate extension icons
```

> Note: `npm run watch` rebuilds TypeScript automatically. If you edit
> `src/manifest.json`, HTML, or CSS, re-run `npm run build` to copy them across.

---

## Usage

1. Open **WhatsApp Web** (`https://web.whatsapp.com/`) and log in normally.
2. Open a **group** chat.
3. Click the extension icon in the toolbar.
4. The popup shows whether WhatsApp Web and a group were detected.
5. Click **Scan Members** and wait — progress updates live.
6. When finished (or after **Stop**), click **Download CSV** or **Download JSON**.
7. Use **Clear** to reset, or the **Settings** link to tune behavior.

---

## Data Model

Each exported participant contains only genuinely visible fields:

```json
{
  "name": "John Doe",
  "phone": "+8801712345678",
  "role": "Admin"
}
```

If the phone is not shown by WhatsApp:

```json
{ "name": "John Doe", "phone": null, "role": "Admin" }
```

CSV columns are `Name, Phone, Role`. JSON is wrapped with group name,
`exportedAt`, and `count`.

---

## Project Structure

```text
whatsapp-lead-extractor/
├── manifest.json           # (source lives in src/, copied to dist/)
├── package.json
├── tsconfig.json
├── build.mjs               # esbuild bundling + static asset copy
├── gen-icons.mjs           # dependency-free PNG icon generator
│
├── src/
│   ├── manifest.json
│   ├── background/service-worker.ts
│   ├── content/
│   │   ├── content.ts             # messaging + scan orchestration
│   │   ├── whatsapp-detector.ts   # WhatsApp + group detection
│   │   ├── participant-scanner.ts   # scroll loop, dedupe, guards
│   │   ├── participant-parser.ts    # isolated DOM parsing
│   │   └── dom-utils.ts             # wait/scroll/click helpers
│   ├── popup/     (popup.html/ts/css)
│   ├── options/   (options.html/ts/css)
│   ├── shared/    (types.ts, messages.ts, constants.ts)
│   └── utils/     (csv.ts, json.ts, filename.ts, storage.ts)
│
├── icons/         (icon16/32/48/128.png)
└── dist/          (build output — load this in Chrome)
```

---

## Architecture Notes

- **Selector resilience:** WhatsApp's class names are generated and change
  often. All selectors live in `src/shared/constants.ts` as ordered arrays. The
  extension prefers `aria-label`s, roles, and visible text over hashed classes,
  and tries each strategy in order. Update selectors there without touching the
  scanner.
- **Parser isolation:** `participant-parser.ts` absorbs DOM changes so the scan
  loop (`participant-scanner.ts`) stays stable.
- **Export independence:** CSV/JSON generation (`src/utils/`) never imports
  scraping logic.

---

## Limitations

- The WhatsApp Web UI can change at any time; selectors may need updating.
- Some participants' phone numbers are **not** exposed in the UI and cannot be
  exported (and never will be).
- Only UI-accessible information can be exported.
- Very large groups may take longer and are bounded by the max-scan timeout.
- WhatsApp's virtualized list can re-render rows; de-duplication handles it but
  is ultimately limited by what the UI renders.
- This extension does **not** and will **not** bypass any privacy restriction.

---

## Testing Checklist

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Individual chat | "Not a group" message |
| 2 | Small group | All visible participants collected |
| 3 | Large group | Scrolling works, no duplicates |
| 4 | Group with admins | Admin role captured when visible |
| 5 | Participant w/o visible phone | `phone = null` |
| 6 | Duplicate rows during scroll | Single record per participant |
| 7 | Click Stop | Scan stops; partial results exportable |
| 8 | Change group mid-scan | Scan stops |
| 9 | UI changes | Graceful error, no crash |
| 10 | Bengali names | CSV opens correctly in Excel (BOM) |

---

## License

MIT — provided as-is for legitimate export of data you can already access.
Respect WhatsApp's Terms of Service and the privacy of group members.
