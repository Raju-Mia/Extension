# Build a Production-Ready Chrome Extension: Telegram Lead Extractor

You are a senior Chrome Extension engineer specializing in Manifest V3, TypeScript, DOM automation, browser security, and robust UI scraping of virtualized web apps.

Build a complete, production-ready Chrome Extension that works on `https://web.telegram.org/`.

The extension's purpose is:

> When the user opens a Telegram group (or channel) in Telegram Web and clicks "Extract Members", collect member information that is visibly accessible through the Telegram Web UI — display name, @username, phone number (only when shown), Telegram user ID (only when present in the UI), and role — and let the user download the collected data as **CSV** and **Excel (.xlsx)**.

This project is modeled on the already-completed `WhatsApp-Group-Exporter` (reuse its architecture, discipline, and quality bar). Do **not** modify that project; it is only a reference example.

Do NOT attempt to access hidden/private Telegram data or bypass Telegram security.

---

# 1. Core Requirements

The extension must:

1. Run only on Telegram Web (`https://web.telegram.org/*`).
2. Detect whether the user currently has a Telegram group/channel open.
3. Allow the user to start/stop an extraction.
4. Open/read the member list using normal UI interactions where necessary.
5. Collect member information that is actually exposed in the Telegram Web interface.
6. Handle large groups by scrolling through the (virtualized) member list.
7. Deduplicate members.
8. Show live progress (count found, phase, elapsed).
9. Allow export as:
   * CSV
   * Excel (.xlsx)
   * JSON (bonus, same pipeline)
10. Automatically generate a sensible filename.
11. Never collect information from chats/groups the user has not opened.
12. Never send collected data to an external server.
13. Store collected data locally only while needed.
14. Work without any backend.
15. Use Manifest V3.

---

# 2. Important Privacy / Security Restrictions

The extension MUST NOT:

* bypass Telegram authentication or login
* access Telegram session tokens, `tdata`, or auth keys
* read cookies used for authentication
* intercept Telegram WebSocket / MTProto traffic
* call Telegram's private API (MTProto) or Web API endpoints (`api.telegram.org`, `/api/...`)
* reverse engineer private endpoints
* access IndexedDB / local databases used by Telegram for message storage
* read localStorage/sessionStorage for authentication purposes
* bypass UI restrictions to reveal hidden phone numbers or data
* collect member information not exposed through the Telegram Web UI
* send collected member data to any external server
* use analytics/tracking by default
* inject remote JavaScript or download/execute remote code

The extension only automates normal UI interactions and reads what the logged-in user can already see.

### 2.1 Reality note on phone numbers
Telegram rarely exposes phone numbers in a group member list. A member's phone is visible **only** if that member has chosen to share it with the user. The parser must therefore treat `phone` as **optional** and never fabricate it. The reliably available fields are: **name**, **@username** (if set), **numeric user ID** (present in DOM data attributes / profile links), and **role**.

---

# 3. Technology

Use:

* Chrome Extension Manifest V3
* TypeScript (strict mode)
* Vanilla HTML/CSS for popup/options (no heavy framework)
* esbuild for bundling (IIFE, target `chrome120`)
* No backend, no database
* Minimal dependencies. For Excel, either:
  * `xlsx` (SheetJS) bundled at build time — recommended for true `.xlsx`, **or**
  * a dependency-free SpreadsheetML 2003 XML writer (documented in §21).

Recommended architecture (mirrors the WhatsApp project):

```text
telegram-lead-extractor/
│
├── manifest.json
├── package.json
├── tsconfig.json
├── build.mjs
├── README.md
│
├── src/
│   ├── manifest.json
│   ├── background/
│   │   └── service-worker.ts        # opens UI as a persistent window
│   ├── content/
│   │   ├── content.ts               # message router + scanner owner
│   │   ├── telegram-detector.ts     # is a group/channel open? name?
│   │   ├── member-scanner.ts        # scroll + collect + guards
│   │   ├── member-parser.ts         # DOM -> Lead model
│   │   └── dom-utils.ts             # waits, clicks, scroll, queries
│   ├── popup/
│   │   ├── popup.html / popup.ts / popup.css
│   ├── options/
│   │   ├── options.html / options.ts / options.css
│   ├── shared/
│   │   ├── types.ts / messages.ts / constants.ts
│   └── utils/
│       ├── csv.ts / json.ts / excel.ts / filename.ts / storage.ts
│
├── icons/  (icon16/32/48/128.png + main.png source, NOT shipped)
└── docs/   (CHROME-WEB-STORE-GUIDE.md, PRIVACY-POLICY.md)
```

---

# 4. Manifest V3

* `manifest_version: 3`
* `permissions`: `downloads`, `storage`
* `host_permissions`: `https://web.telegram.org/*` only
* `content_scripts`: match `https://web.telegram.org/*`, `run_at: document_idle`
* `background.service_worker`: `service-worker.js`
* `action`: title + icons, **no `default_popup`** (UI opens as a window — see §5)
* `options_page`: `options.html`
* Keep permission surface minimal (this is required for store approval).

---

# 5. UI as a Persistent Window (not a dropdown popup)

Chrome closes an action popup the instant it loses focus, which interrupts long
extracts. Follow the WhatsApp project's proven approach:

* No `default_popup` in the manifest.
* `chrome.action.onClicked` → `chrome.windows.create({ url: 'popup.html', type: 'popup', width: 400, height: 700 })`.
* If a window is already open, focus it instead of opening duplicates.
* The extraction runs in the **content script**, so it continues even if the UI is closed; reopening the window reconnects to live state.

---

# 6. Popup / Window UI

Compact, modern panel showing:

* Connection status: "Telegram Web detected" / "Open Telegram Web first"
* Current group/channel name + detected type (group / channel / supergroup)
* "Members found: N" live counter
* Primary button: **Extract Members**
* Secondary buttons: **Download CSV**, **Download Excel**, **Download JSON** (enabled after a scan)
* **Stop** button while running
* **Clear** and a **Settings** link
* Footer trust line: "Data stays in your browser. Nothing is uploaded."

The popup finds the Telegram tab by URL (`chrome.tabs.query({ url })`), not by "active tab", so it keeps working after the user clicks back to Telegram.

---

# 7. Live Progress

* Content script sends `EXTRACT_PROGRESS { count, phase }` (throttled, see §10).
* UI shows a spinner + "Extracting… N found".
* On finish: `EXTRACT_COMPLETE` with the full payload; on abort/timeout: reason.
* Show elapsed time for large groups.

---

# 8. Group / Channel Detection

Detect that a chat with a member list is open:

* Prefer stable signals: the chat header, `data-peer-id` attributes, aria-labels containing "group"/"channel"/"members"/"subscribers".
* Read the chat title from the header (prefer a `[title]` attribute or the header text node).
* Classify type: group, supergroup, channel, or 1:1 chat (1:1 has no member list → not eligible).
* Maintain a `groupSignature` (peer id + title) to detect navigation away (§33).

Telegram Web ships multiple clients (`/a/` React app, `/k/` desktop-style, legacy). Target the default **`/a/`** first; keep selectors abstracted so `/k/` can be added via fallback arrays.

---

# 9. Opening the Member List

* Click the chat header to open the profile/info panel.
* Click the "Members" / "View members" affordance to open the member list modal.
* If the list is already open, proceed directly.
* All clicks use a realistic synthetic event sequence (pointer + mouse) so React handlers fire.

---

# 10. Member List Scanner

* Locate the scrollable member container (virtualized list).
* Loop: parse currently rendered rows → ingest → detect bottom → scroll by a fraction of the viewport (overlap ~0.7 so lazily rendered rows are never skipped) → wait for DOM mutation → short delay.
* Terminate on: at-bottom + N stable iterations, user stop, timeout, or group change.
* Throttle progress messages (e.g. every 250ms) so a 10k-member list doesn't flood the runtime.

---

# 11. Infinite / Virtualized Lists

Telegram renders only visible rows. The scanner must:

* Scroll incrementally with overlap, not full-page jumps.
* Rely on dedup (§15) so re-read rows are harmless.
* Detect the true bottom via `scrollTop + clientHeight >= scrollHeight - tolerance` **and** "no new members for several passes".
* Support very large lists (up to ~200k in giant channels) with a high configurable time budget (§17).

---

# 12. Member Data Model

```ts
interface Lead {
  name: string;            // display name (required)
  username: string | null; // @handle without the leading @, or null
  phone: string | null;    // only if visibly shown; normalized; else null
  telegramId: string | null; // numeric peer id when present in DOM
  role: MemberRole | null; // "admin" | "bot" | "owner" | "member"
  source: "visible-ui";    // always; proves no private API use
}
type MemberRole = "owner" | "admin" | "bot" | "member";
```

---

# 13. Username Extraction

* Usernames appear as `@handle` text or in profile links.
* Normalize: strip leading `@`, lowercase for comparison, validate `^[A-Za-z][A-Za-z0-9_]{4,31}$`.
* Store without `@` in data; CSV/Excel may show `@handle` for readability.
* Absent username → `null` (never guess).

---

# 14. Phone Number Extraction (optional field)

* Only capture numbers actually rendered in the member row/profile (rare).
* Use a tolerant international regex, then normalize digits and country code.
* Reject obvious non-phones (dates, IDs).
* If not visible → `null`. Never call private APIs to obtain it.

---

# 15. Telegram User ID Extraction

* Telegram embeds a numeric peer id in the DOM (e.g. `data-peer-id`, member link `href` like `#<id>` or `openPeer=...`).
* Capture it when present — it is a stable dedup key and a useful lead identifier.
* Absent → `null`.

---

# 16. Role / Admin Detection

* Detect badges/labels: "Admin", "Owner"/"Creator", "Bot".
* Map to `role`; default `member` when a valid member row has no badge.
* Do not treat non-member rows (invites, ads, section headers) as members.

---

# 17. Timeout Protection

* Hard time budget from settings (default 900s, up to 3600s).
* On timeout, deliver what was collected with `stopReason: "timeout"` (partial, not an error).

---

# 18. Stop Button

* `STOP_EXTRACT` message sets a flag checked between every scroll step.
* Returns collected data so far with `stopReason: "user-stopped"`.

---

# 19. DOM Stability

* Use MutationObserver waits bounded by a timeout before each read.
* Retry reads a few times before concluding the list is empty.

---

# 20. Avoid Fragile Selectors

* Never rely on generated/hashed CSS class names.
* Prefer `data-*`, `aria-*`, roles, `href` patterns, and visible text.
* Store every selector as an ordered fallback array in `constants.ts`.

---

# 21. Export Formats

### 21.1 CSV
* UTF-8 **with BOM** (`\uFEFF`) so Excel opens Bengali/Arabic/Cyrillic correctly.
* RFC-4180 quoting. Columns: `Name, Username, Phone, Telegram ID, Role`.

### 21.2 Excel (.xlsx)
* Real `.xlsx` via bundled SheetJS (`xlsx`), single sheet "Leads", bold header, frozen first row, sensible column widths.
* If a dependency must be avoided, emit **SpreadsheetML 2003 XML** (`.xls`) which Excel opens natively — document the tradeoff in README.

### 21.3 JSON (bonus)
* `{ group, exportedAt, count, leads: [{ name, username, phone, telegramId, role }] }`, pretty-printed.

---

# 22. Filename

`Telegram_<group-name>_<YYYY-MM-DD>.<ext>` — sanitize `/ \ : * ? " < > |`, collapse spaces, cap length, fall back to "Members" if the name is unknown.

---

# 23. Downloads

* Build a Blob, `URL.createObjectURL`, `chrome.downloads.download({ saveAs: true })`, revoke on `onChanged` state `complete`/`interrupted`.
* Correct MIME types per format (`text/csv`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/json`).

---

# 24. Local Storage

* Only preferences are persisted (`chrome.storage.local`): scroll delay, max time, include-self toggle, preferred format.
* Never persist extracted leads unless the user opts into history (default off).

---

# 25. UI ↔ Content Script Communication

Message union (typed in `shared/messages.ts`):

* `GET_STATUS` → `{ telegramReady, isGroup, groupName, extracting, count }`
* `START_EXTRACT` → `{ accepted, reason? }` (ack before UI enters EXTRACTING)
* `STOP_EXTRACT`
* `EXTRACT_PROGRESS { count, phase }`
* `EXTRACT_COMPLETE { payload }`
* `EXTRACT_ERROR { message }`
* `GET_RESULTS` → last payload (for reconnecting window)

---

# 26. Error Handling

* No Telegram tab / not logged in → clear message, no spinner.
* Not a group/channel → "Open a group or channel to extract members."
* Member list unavailable → `list-unavailable` with guidance to open the members panel.
* All content-script errors are caught and surfaced as `EXTRACT_ERROR`, never silent.

---

# 27. UI States

IDLE → CHECKING → EXTRACTING → DONE (with export buttons) → ERROR. Reopening the window restores the correct state via `GET_STATUS`/`GET_RESULTS`.

---

# 28. Modern Design

Clean, calm, on-brand-neutral palette (do **not** copy Telegram's logo/colors as branding — see §44). Accessible contrast, clear primary/secondary actions, disabled states, inline hints.

---

# 29. Options Page

* Scroll delay, max extract time (seconds), include-self toggle, preferred format, optional history.
* Validate + clamp against `SETTINGS_RANGES`.

---

# 30. Accessibility

* Semantic buttons, `aria-live` for progress, keyboard operable, focus states, reduced-motion respected.

---

# 31. Performance

* Incremental reads, dedup via `Map`, throttled progress, no full-DOM rescans per tick, memory-safe for 100k+ rows.

---

# 32. SPA Navigation

Telegram is a single-page app. Watch for chat changes (interval/MutationObserver on the header) and reset stale results when the open chat changes.

---

# 33. Group-Change Protection

If `groupSignature` changes mid-extract, stop with `stopReason: "group-changed"` to avoid mixing members from two chats.

---

# 34. Deduplication

Key priority: `telegramId` → normalized `username` → `name|phone` fingerprint. Idempotent ingest so overlapping scroll never duplicates rows.

---

# 35. Data Validation

A row is a valid lead if it has a name **and** at least one of {username, phone, telegramId}. Reject section headers, "Add member", ads, and media rows.

---

# 36. No External Network

Zero `fetch`/XHR to any endpoint. No remote code. CSP forbids remote scripts.

---

# 37. Content Security Policy

`extension_pages: "script-src 'self'; object-src 'self'"`.

---

# 38. Build System

* `build.mjs` bundles each entry (content, popup, options, service-worker) with esbuild, copies static assets + manifest + only the 4 icon sizes (exclude `main.png`).
* Scripts: `build`, `watch`, `clean`, `package` (produces store ZIP with `manifest.json` at root), `typecheck`.

---

# 39. README

Purpose, features, install (load unpacked), usage, build, privacy statement, export formats, limitations (phone numbers rarely visible), and Telegram ToS disclaimer.

---

# 40. Testing

* Unit tests for parsers/normalizers (username, phone, dedup key, filename, CSV escaping).
* Manual matrix: small group, large group, channel with subscribers, mixed admin/bot rows, offline, wrong chat, stop mid-scan, timeout.
* Verify exports open correctly in Excel and Google Sheets.

---

# 41. Logging / Debug Mode

Central `log()` gated by a `DEBUG` flag; silent in production.

---

# 42. Security Review

Confirm: no private API use, no token/cookie access, minimal permissions, no data leaves the device, no remote code.

---

# 43. Code Quality

Strict TypeScript, no unused locals/params, small modules, clear naming, comments explain "why".

---

# 44. Chrome Web Store / Trademark Safety (learned from the WhatsApp project)

To avoid rejection/removal:

* **Do not use the Telegram logo** or a look-alike as the extension icon. Use a neutral "group + export" mark in original colors.
* **Do not lead the name with the trademark.** Prefer: **"Lead Extractor for Telegram Web"** (descriptive), and state **"Not affiliated with Telegram or Telegram FZ-LLC"** in the description.
* Provide a hosted **privacy policy URL** and complete the data-disclosure fields (personal data = yes, cookies/tokens = no, local-only processing).
* Justify each permission (downloads / storage / host) in one line.

---

# 45. Content / Scanner Architecture

`content.ts` owns a single `MemberScanner` instance, routes messages, enforces the ack-before-EXTRACTING rule, and reconnects a reopened window. `MemberScanner` exposes `start()`, `stop()`, `getResults()` and never throws (always resolves to a result with a `stopReason`).

---

# 46. Export Architecture

Export utilities are pure and dependency-light, decoupled from the content script: `csv.ts`, `json.ts`, `excel.ts`, `filename.ts`. The UI calls them with the last `ExtractResult`.

---

# 47. Final Deliverables

1. Full TypeScript source under `src/`.
2. Working `dist/` build + `npm run package` ZIP.
3. Icons (16/32/48/128) — original, non-trademark.
4. README.md.
5. `docs/CHROME-WEB-STORE-GUIDE.md` and `docs/PRIVACY-POLICY.md`.
6. Clean `tsc --noEmit` and successful build.

---

# 48. Final Acceptance Criteria

* Detects an open Telegram group/channel and reads the correct member count.
* Extracts every visible member across a large virtualized list (no skips, no dupes).
* Captures name + @username + telegramId always; phone only when visible.
* Exports CSV (BOM, Unicode-safe) and Excel (.xlsx) that open cleanly.
* Stop, timeout, and group-change all behave correctly.
* No network calls, no private API use, minimal permissions.
* UI survives the user clicking back to Telegram (persistent window).

---

# 49. Development Process

1. Scaffold project + build system (mirror the WhatsApp repo).
2. `constants.ts` selectors/limits; `types.ts`/`messages.ts`.
3. `dom-utils.ts` (waits, clicks, overlap scroll).
4. `telegram-detector.ts` (group/channel + name).
5. `member-parser.ts` (row → Lead) with unit tests.
6. `member-scanner.ts` (scroll loop + guards + dedup + throttle).
7. `content.ts` message router.
8. Export utils (csv/json/excel/filename).
9. Popup window UI + options page.
10. Service worker window launcher.
11. Icons, README, store docs.
12. Typecheck, build, package, manual QA.

---

# 50. Critical Instruction

Implement real, working code — no pseudo-code, no placeholder selectors left as TODO. When Telegram Web's DOM differs from assumptions during QA, inspect the live DOM and update the abstracted selector arrays in `constants.ts` rather than hardcoding fragile paths. Keep the privacy boundary absolute: **only what is visible in the UI, only on web.telegram.org, never uploaded.**
