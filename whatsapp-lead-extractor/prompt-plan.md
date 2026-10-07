# Build a Production-Ready Chrome Extension: Lead Extractor for WhatsApp Web

You are a senior Chrome Extension engineer specializing in Manifest V3, JavaScript/TypeScript, DOM automation, browser security, and robust UI scraping.

Build a complete, production-ready Chrome Extension that works on `https://web.whatsapp.com/`.

The extension's purpose is:

> When the user opens a WhatsApp group in WhatsApp Web and clicks "Export Members", collect participant information that is visibly accessible through the WhatsApp Web UI and allow the user to download the collected data as CSV or JSON.

Do NOT attempt to access hidden/private WhatsApp data or bypass WhatsApp security.

---

# 1. Core Requirements

The extension must:

1. Run only on WhatsApp Web.
2. Detect whether the user currently has a WhatsApp group open.
3. Allow the user to start/stop an export.
4. Open/read the group's participant list using normal UI interactions where necessary.
5. Collect participant information that is actually exposed in the WhatsApp Web interface.
6. Handle large groups by scrolling through the participant list.
7. Deduplicate participants.
8. Show live progress.
9. Allow export as:

   * CSV
   * JSON
10. Automatically generate a sensible filename.
11. Never collect information from chats/groups that the user has not opened.
12. Never send collected data to an external server.
13. Store collected data locally only while needed.
14. Work without any backend.
15. Use Manifest V3.

---

# 2. Important Privacy/Security Restrictions

The extension MUST NOT:

* bypass WhatsApp authentication
* access WhatsApp session tokens
* read cookies for authentication
* intercept WhatsApp WebSocket traffic
* access WhatsApp's private/internal APIs
* reverse engineer private endpoints
* access IndexedDB/private databases
* access localStorage/sessionStorage for authentication purposes
* bypass UI restrictions
* access participant information that is not exposed to the user through the WhatsApp Web UI
* send collected participant data to any external server
* use analytics/tracking by default
* inject remote JavaScript
* download or execute remote code

The extension should only automate normal UI interactions and read information that the user can access through WhatsApp Web.

---

# 3. Technology

Use:

* Chrome Extension Manifest V3
* TypeScript preferred
* Vanilla HTML/CSS or lightweight framework if genuinely useful
* No backend
* No database
* No unnecessary dependencies

Recommended architecture:

```text
whatsapp-lead-extractor/
│
├── manifest.json
├── package.json
├── tsconfig.json
├── README.md
│
├── src/
│   ├── background/
│   │   └── service-worker.ts
│   │
│   ├── content/
│   │   ├── content.ts
│   │   ├── whatsapp-detector.ts
│   │   ├── participant-scanner.ts
│   │   ├── participant-parser.ts
│   │   └── dom-utils.ts
│   │
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.ts
│   │   └── popup.css
│   │
│   ├── options/
│   │   ├── options.html
│   │   ├── options.ts
│   │   └── options.css
│   │
│   ├── shared/
│   │   ├── types.ts
│   │   ├── messages.ts
│   │   └── constants.ts
│   │
│   └── utils/
│       ├── csv.ts
│       ├── json.ts
│       ├── filename.ts
│       └── storage.ts
│
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
│
└── dist/
```

If TypeScript/build tooling creates unnecessary complexity, a clean JavaScript implementation is also acceptable.

---

# 4. Manifest V3

Create a valid Manifest V3 manifest.

Example structure:

```json
{
  "manifest_version": 3,
  "name": "Lead Extractor for WhatsApp Web",
  "version": "1.0.0",
  "description": "Export participant information visible in WhatsApp Web groups.",
  "permissions": [
    "downloads",
    "storage"
  ],
  "host_permissions": [
    "https://web.whatsapp.com/*"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "Lead Extractor for WhatsApp Web"
  },
  "background": {
    "service_worker": "service-worker.js"
  },
  "content_scripts": [
    {
      "matches": [
        "https://web.whatsapp.com/*"
      ],
      "js": [
        "content.js"
      ],
      "run_at": "document_idle"
    }
  ],
  "options_page": "options.html"
}
```

Only request permissions that are actually necessary.

---

# 5. Popup UI

Create a clean modern popup.

Popup should contain:

## Header

```text
Lead Extractor for WhatsApp Web
```

Subtitle:

```text
Export participant information from the currently open group.
```

## Status

Show:

```text
● WhatsApp Web detected
```

or:

```text
⚠ Open WhatsApp Web first
```

## Group Information

Display:

```text
Group:
My Friends Group

Participants found:
128
```

If no group is detected:

```text
No WhatsApp group detected.

Open a WhatsApp group and try again.
```

## Controls

Buttons:

```text
Scan Members
Stop
Download CSV
Download JSON
Clear
```

Initially:

```text
Scan Members
```

is enabled.

During scanning:

```text
Scanning...
Stop
```

After scan:

```text
Download CSV
Download JSON
Clear
```

---

# 6. Live Progress

While scanning, show:

```text
Scanning participants...

Found: 37
Progress: 37
```

If the participant list is being scrolled:

```text
Scanning...
Scrolling participant list...
Found 72 participants
```

Use a progress indicator/spinner.

Do not pretend to know an exact percentage unless the UI exposes a reliable total.

Prefer:

```text
Found 72 participants
```

over a fake:

```text
72%
```

---

# 7. Group Detection

The extension should determine whether the current WhatsApp Web view represents a group.

Do not rely on one fragile CSS selector.

Create a detection strategy with multiple signals.

Possible signals:

* current chat header
* participant/group metadata visible in the UI
* group information panel
* presence of multiple participants
* accessible labels
* DOM structure

Use semantic/accessibility attributes where possible.

Example conceptual logic:

```ts
function detectGroup(): GroupContext | null {
    // inspect visible WhatsApp UI
    // identify current chat
    // determine whether it is a group
    // extract visible group name if available

    return {
        isGroup: true,
        name: "Example Group"
    };
}
```

Do not use private WhatsApp internal object structures.

---

# 8. Opening Group Information

When the user clicks:

```text
Scan Members
```

the content script should:

1. Verify WhatsApp Web is available.
2. Verify a group is open.
3. Locate the group header/info area.
4. Open the group information UI if necessary.
5. Locate the participant/member section.
6. Open the participant list if it is collapsed or shown in a dialog.

Use normal click events.

Do NOT simulate hidden API calls.

---

# 9. Participant List Scanner

Implement a robust participant scanner.

The scanner should:

1. Locate the participant container.
2. Read all currently rendered participant entries.
3. Extract available information.
4. Add them to an in-memory collection.
5. Scroll the participant container.
6. Wait for DOM updates.
7. Read newly rendered participants.
8. Continue until the bottom is reached.
9. Detect when no new participants appear.
10. Stop safely.

Pseudo-code:

```ts
async function scanParticipants() {
    const participants = new Map<string, Participant>();

    let previousCount = 0;
    let stableIterations = 0;

    while (stableIterations < MAX_STABLE_ITERATIONS) {

        const visible = readVisibleParticipants();

        for (const participant of visible) {
            const key = createParticipantKey(participant);

            if (!participants.has(key)) {
                participants.set(key, participant);
            }
        }

        if (participants.size === previousCount) {
            stableIterations++;
        } else {
            stableIterations = 0;
        }

        previousCount = participants.size;

        const moved = await scrollParticipantContainer();

        if (!moved) {
            break;
        }

        await waitForDomUpdate();
    }

    return Array.from(participants.values());
}
```

---

# 10. Infinite/Virtualized Lists

Assume WhatsApp may use a virtualized list.

This means:

* not every participant exists in the DOM simultaneously
* scrolling can replace DOM nodes
* DOM count does not necessarily equal participant count

Therefore:

DO NOT simply run:

```js
document.querySelectorAll(...)
```

once.

Instead:

```text
read visible entries
↓
store them
↓
scroll
↓
wait
↓
read new entries
↓
deduplicate
↓
repeat
```

---

# 11. Participant Data Model

Create a TypeScript interface:

```ts
interface Participant {
    name: string | null;
    phone: string | null;
    role: string | null;
    source: "visible-ui";
}
```

Only populate fields that are genuinely available.

Example:

```json
{
  "name": "John Doe",
  "phone": "+8801712345678",
  "role": "Admin",
  "source": "visible-ui"
}
```

If phone number is not exposed in the UI:

```json
{
  "name": "John Doe",
  "phone": null,
  "role": "Admin",
  "source": "visible-ui"
}
```

Never try to infer or reconstruct a hidden phone number.

---

# 12. Phone Number Extraction

If the WhatsApp Web UI visibly exposes a phone number for a participant, extract it.

Potential sources may include:

* visible text
* accessible labels
* user-visible profile information
* normal UI elements

Normalize phone numbers.

Example:

```text
01712345678
+8801712345678
8801712345678
```

Do not blindly convert numbers unless the UI context clearly establishes the country/format.

Store the number as displayed when normalization would risk changing its meaning.

Recommended fields:

```ts
{
    rawPhone: string | null,
    normalizedPhone: string | null
}
```

But only include `normalizedPhone` when normalization is reliable.

---

# 13. Name Extraction

Extract the participant display name if visibly available.

Possible fallback order:

1. visible participant name
2. visible phone number
3. accessible label
4. null

Do not use private contact databases.

---

# 14. Admin Detection

If the UI visibly indicates:

```text
Admin
Group admin
You
```

store the role.

Example:

```json
{
  "name": "John",
  "phone": "+880...",
  "role": "Admin"
}
```

Otherwise:

```json
"role": null
```

Do not infer admin status from anything other than visible UI.

---

# 15. Deduplication

Participants may appear multiple times during scrolling.

Implement a stable deduplication key.

Preferred:

```text
phone number
```

Fallback:

```text
normalized name
```

If both are unavailable, create a safe temporary fingerprint based on visible fields.

Example:

```ts
function createParticipantKey(p: Participant): string {
    if (p.phone) {
        return `phone:${normalizePhone(p.phone)}`;
    }

    return `name:${normalizeName(p.name ?? "")}`;
}
```

Do not merge two different participants merely because their names are similar.

---

# 16. Stop Button

The user must be able to stop scanning.

Use an abort mechanism:

```ts
let scanning = false;

function stopScan() {
    scanning = false;
}
```

Or preferably:

```ts
const controller = new AbortController();
```

The scanner should check cancellation between scrolling operations.

When stopped:

```text
Scan stopped.

Found 84 participants.
```

The user should still be able to export the participants found so far.

---

# 17. Timeout Protection

Never allow the extension to get stuck indefinitely.

Create configurable limits:

```ts
MAX_SCAN_TIME = 120000
MAX_STABLE_ITERATIONS = 5
SCROLL_DELAY = 500
DOM_UPDATE_TIMEOUT = 3000
```

If scanning exceeds the maximum:

```text
Scanning stopped because the time limit was reached.

84 participants found.
```

Allow the user to export the partial results.

---

# 18. DOM Stability

WhatsApp Web is a dynamic SPA.

Implement helper functions:

```ts
wait(ms)
waitForElement(selector, timeout)
waitForDomChange(...)
```

Prefer MutationObserver when useful.

Example:

```ts
function waitForMutation(
    container: HTMLElement,
    timeout = 3000
): Promise<void> {
    return new Promise(resolve => {
        const observer = new MutationObserver(() => {
            observer.disconnect();
            resolve();
        });

        observer.observe(container, {
            childList: true,
            subtree: true
        });

        setTimeout(() => {
            observer.disconnect();
            resolve();
        }, timeout);
    });
}
```

---

# 19. Avoid Fragile Selectors

Do NOT build the entire extension around one selector such as:

```css
div._abc123
```

WhatsApp can change generated class names.

Prefer:

* accessibility attributes
* semantic roles
* visible text
* DOM relationships
* stable attributes
* multiple fallback strategies

Create a selector abstraction:

```ts
const selectors = {
    groupHeader: [...],
    groupInfoButton: [...],
    participantsSection: [...],
    participantRow: [...]
};
```

Make it easy to update selectors later.

---

# 20. CSV Export

Create a proper CSV generator.

Columns:

```text
Name,Phone,Role
```

Example:

```csv
Name,Phone,Role
John Doe,+8801712345678,Admin
Rahim,+8801812345678,
Karim,+8801912345678,
```

Correctly escape:

* commas
* quotes
* line breaks

Example:

```ts
function escapeCsv(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
}
```

Add UTF-8 BOM so Excel opens Bengali/Unicode text correctly:

```text
\uFEFF
```

---

# 21. JSON Export

Generate clean formatted JSON:

```json
{
  "group": {
    "name": "Example Group"
  },
  "exportedAt": "2026-09-23T10:00:00.000Z",
  "count": 120,
  "participants": [
    {
      "name": "John Doe",
      "phone": "+8801712345678",
      "role": "Admin"
    }
  ]
}
```

Use:

```js
JSON.stringify(data, null, 2)
```

---

# 22. Filename

Automatically generate:

```text
WhatsApp_Group_Name_2026-09-23.csv
```

Sanitize invalid filename characters:

```text
/ \ : * ? " < > |
```

Replace them with `_`.

Example:

```text
My/Group:Friends
```

becomes:

```text
My_Group_Friends_2026-09-23.csv
```

---

# 23. Downloads

Use Chrome's downloads API.

Example:

```ts
chrome.downloads.download({
    url: blobUrl,
    filename,
    saveAs: true
});
```

Revoke object URLs after download where appropriate.

Do not upload the file anywhere.

---

# 24. Local Storage

Use `chrome.storage.local` only for settings/preferences if needed.

Possible settings:

```text
Export format preference
Auto-open group info
Scan delay
```

Do not store participant information permanently unless the user explicitly chooses a local history feature.

Default behavior:

```text
participant data exists only for the current scan/session
```

---

# 25. Popup ↔ Content Script Communication

Use Chrome runtime messaging.

Example:

```ts
chrome.tabs.sendMessage(tabId, {
    type: "START_SCAN"
});
```

Content script sends:

```ts
chrome.runtime.sendMessage({
    type: "SCAN_PROGRESS",
    count: participants.length
});
```

Popup receives:

```ts
chrome.runtime.onMessage.addListener(message => {
    if (message.type === "SCAN_PROGRESS") {
        updateProgress(message.count);
    }
});
```

Define all message types centrally.

Example:

```ts
type Message =
    | { type: "GET_STATUS" }
    | { type: "START_SCAN" }
    | { type: "STOP_SCAN" }
    | { type: "EXPORT_CSV" }
    | { type: "EXPORT_JSON" }
    | { type: "SCAN_PROGRESS"; count: number }
    | { type: "SCAN_COMPLETE"; participants: Participant[] }
    | { type: "SCAN_ERROR"; message: string };
```

---

# 26. Error Handling

Handle:

### WhatsApp not open

```text
Please open WhatsApp Web first.
```

### No active chat

```text
Please open a WhatsApp group first.
```

### Individual chat

```text
The current chat is not a group.
```

### Group info unavailable

```text
Could not open the group information panel.

Please open the group info manually and try again.
```

### Participant list unavailable

```text
Could not locate the participant list.

WhatsApp Web may have changed its interface.
```

### Scan timeout

```text
The scan timed out.

You can export the participants found so far.
```

### User stopped

```text
Scan stopped.

84 participants found.
```

---

# 27. UI States

Implement a clear state machine:

```text
IDLE
  ↓
CHECKING
  ↓
READY
  ↓
SCANNING
  ↓
COMPLETED
```

Error state:

```text
ERROR
```

Stopped state:

```text
STOPPED
```

Example:

```ts
type ScanState =
    | "IDLE"
    | "CHECKING"
    | "READY"
    | "SCANNING"
    | "COMPLETED"
    | "STOPPED"
    | "ERROR";
```

---

# 28. Modern Popup Design

Make the popup approximately:

```text
Width: 360px
```

Use:

* clean typography
* rounded cards
* accessible contrast
* clear buttons
* disabled states
* progress indicator
* participant count
* error messages

Example:

```text
┌──────────────────────────────────┐
│ WhatsApp Group Exporter          │
│ Export visible group members     │
│                                  │
│ ● WhatsApp Web                   │
│                                  │
│ Group                            │
│ ┌──────────────────────────────┐ │
│ │ Family Group                 │ │
│ └──────────────────────────────┘ │
│                                  │
│ Participants                     │
│ 128                              │
│                                  │
│ [       Scan Members           ] │
│                                  │
│ CSV        JSON                  │
└──────────────────────────────────┘
```

---

# 29. Options Page

Create an options page with:

```text
Settings

Scan delay
[ 500 ms ]

Maximum scan time
[ 120 seconds ]

Automatically open group information
[ ON ]

Preferred export format
( ) CSV
( ) JSON

Save scan history
[ OFF ]
```

Default:

```text
Save scan history = OFF
```

Explain:

```text
Participant information is processed locally in your browser.
```

---

# 30. Accessibility

Support:

* keyboard navigation
* visible focus states
* ARIA labels
* semantic buttons
* readable text
* disabled states

Example:

```html
<button aria-label="Start scanning participants">
    Scan Members
</button>
```

---

# 31. Performance

The extension should remain lightweight.

Avoid:

```text
setInterval(() => scanEntireDOM(), 50)
```

Avoid repeated full-document scans.

Instead:

* identify the relevant container
* observe only relevant DOM
* scan visible rows
* throttle operations
* debounce mutation events

---

# 32. WhatsApp SPA Navigation

WhatsApp Web does not perform normal page reloads for every chat.

Therefore detect navigation changes.

Possible strategy:

```ts
MutationObserver
```

plus lightweight periodic state checks if required.

When user changes group:

```text
reset current scan
clear participant state
update popup status
```

Do not accidentally export participants from the previous group.

---

# 33. Group Change Protection

Store a group context:

```ts
interface GroupContext {
    name: string | null;
    identifier: string | null;
}
```

Before every major scan step verify that the current group is still the same.

If the user changes groups during scanning:

```text
The active group changed.

The scan has been stopped.
```

---

# 34. Duplicate Protection

Example:

Input:

```text
John
John
+8801712345678
+8801712345678
Rahim
```

Output should contain each participant only once.

But:

```text
John Smith
John Rahman
```

must remain separate.

---

# 35. Data Validation

Validate participant objects before exporting.

Example:

```ts
function isValidParticipant(p: Participant): boolean {
    return Boolean(
        p.name ||
        p.phone
    );
}
```

Do not export empty rows.

---

# 36. No External Network

The extension should not make requests to:

```text
your-server.com
api.example.com
analytics.example.com
```

No backend is required.

All processing occurs locally.

---

# 37. Content Security Policy

Follow Manifest V3 CSP.

Do not use:

```html
<script>
```

inline JavaScript.

Do not use:

```js
eval()
```

Do not load remote scripts.

---

# 38. Build System

Provide complete build instructions.

Preferred:

```bash
npm install
npm run build
```

Output:

```text
dist/
```

The final extension must be loadable through:

```text
chrome://extensions
```

Then:

```text
Developer mode → Load unpacked → select dist/
```

---

# 39. README

Create a complete README containing:

## Installation

1. Clone/download project.
2. Run:

```bash
npm install
npm run build
```

3. Open:

```text
chrome://extensions
```

4. Enable Developer Mode.
5. Click Load unpacked.
6. Select `dist`.

## Usage

1. Open WhatsApp Web.
2. Open a group.
3. Click extension.
4. Click Scan Members.
5. Wait for scan.
6. Download CSV or JSON.

## Privacy

Explain:

```text
The extension processes only information exposed through the WhatsApp Web interface and does not send participant information to a remote server.
```

## Limitations

Explain that:

* WhatsApp UI can change.
* Some participant phone numbers may not be visible.
* Only UI-accessible information can be exported.
* Large groups may take longer.
* WhatsApp Web virtualization may affect scanning.
* The extension does not bypass privacy restrictions.

---

# 40. Testing

Create a testing checklist.

Test:

### Test 1

Individual chat.

Expected:

```text
Not a group
```

### Test 2

Small group.

Expected:

```text
All visible participants collected
```

### Test 3

Large group.

Expected:

```text
Scrolling works
No duplicates
```

### Test 4

Group with admins.

Expected:

```text
Admin roles captured when visible
```

### Test 5

Participant without visible phone.

Expected:

```text
phone = null
```

### Test 6

Duplicate rendering during scroll.

Expected:

```text
one participant record
```

### Test 7

User clicks Stop.

Expected:

```text
scan stops safely
partial results remain exportable
```

### Test 8

User changes group during scan.

Expected:

```text
scan stops
```

### Test 9

WhatsApp Web interface changes.

Expected:

```text
graceful error instead of crash
```

### Test 10

Bengali participant names.

Expected:

```text
CSV opens correctly in Excel
```

---

# 41. Logging / Debug Mode

Implement a simple development logger:

```ts
const DEBUG = false;

function log(...args: unknown[]) {
    if (DEBUG) {
        console.log("[WhatsApp Exporter]", ...args);
    }
}
```

Do not log participant data in production.

When `DEBUG = false`, avoid printing names or phone numbers to console.

---

# 42. Security Review

Before finalizing, verify:

* No private WhatsApp APIs.
* No token extraction.
* No cookie extraction.
* No WebSocket interception.
* No IndexedDB scraping.
* No credential collection.
* No external upload.
* No remote JavaScript.
* No hidden participant discovery.
* No bypass of WhatsApp privacy controls.

The extension must operate only through user-visible WhatsApp Web UI.

---

# 43. Code Quality

Use:

* strict TypeScript where applicable
* small reusable functions
* meaningful names
* comments for complex DOM logic
* centralized constants
* centralized selectors
* error boundaries
* no dead code
* no unnecessary dependencies

Do not put everything into one 1000+ line file.

Separate:

```text
UI
Messaging
Scanning
Parsing
Export
Storage
Utilities
```

---

# 44. Important WhatsApp DOM Strategy

Because WhatsApp's DOM may change frequently, implement the participant parser as an isolated module.

For example:

```ts
class ParticipantParser {

    parse(container: HTMLElement): Participant[] {
        // multiple fallback strategies
    }

    parseName(element: HTMLElement): string | null {
        // ...
    }

    parsePhone(element: HTMLElement): string | null {
        // only visible UI information
    }

    parseRole(element: HTMLElement): string | null {
        // ...
    }
}
```

Make selector changes possible without rewriting the scanner.

---

# 45. Scanner Architecture

Implement:

```ts
class ParticipantScanner {

    private participants = new Map<string, Participant>();

    async start(): Promise<Participant[]> {
        // find participant container
        // scan visible entries
        // scroll
        // wait
        // scan again
        // deduplicate
        // stop at bottom
        // return results
    }

    stop(): void {
        // abort scan
    }

    getResults(): Participant[] {
        return Array.from(this.participants.values());
    }
}
```

---

# 46. Export Architecture

Implement:

```ts
class ExportManager {

    exportCSV(
        groupName: string,
        participants: Participant[]
    ): void {}

    exportJSON(
        groupName: string,
        participants: Participant[]
    ): void {}
}
```

Keep export logic independent from WhatsApp scraping logic.

---

# 47. Final Deliverables

Produce all source files.

At minimum:

```text
manifest.json
package.json
tsconfig.json

src/background/service-worker.ts

src/content/content.ts
src/content/whatsapp-detector.ts
src/content/participant-scanner.ts
src/content/participant-parser.ts
src/content/dom-utils.ts

src/popup/popup.html
src/popup/popup.ts
src/popup/popup.css

src/options/options.html
src/options/options.ts
src/options/options.css

src/shared/types.ts
src/shared/messages.ts
src/shared/constants.ts

src/utils/csv.ts
src/utils/json.ts
src/utils/filename.ts
src/utils/storage.ts

README.md
```

---

# 48. Final Acceptance Criteria

The project is considered complete only if:

1. `npm install` works.
2. `npm run build` works.
3. Manifest V3 is valid.
4. Extension loads into Chrome.
5. Popup opens correctly.
6. WhatsApp Web is detected.
7. Group detection works.
8. Participant scanning works through the visible UI.
9. Scrolling works for large/virtualized lists.
10. Duplicate participants are removed.
11. Stop button works.
12. CSV export works.
13. JSON export works.
14. Unicode/Bengali names work.
15. Filename generation works.
16. Errors are handled gracefully.
17. No participant data is sent externally.
18. No private WhatsApp APIs are accessed.
19. No authentication/session data is accessed.
20. README contains complete installation and usage instructions.

---

# 49. Development Process

Do NOT just provide pseudo-code.

Actually implement the complete project.

Work in this order:

### Phase 1

Create project structure and Manifest V3.

### Phase 2

Implement popup UI.

### Phase 3

Implement WhatsApp Web detection.

### Phase 4

Implement group detection.

### Phase 5

Implement group info/participant-list navigation.

### Phase 6

Implement participant parser.

### Phase 7

Implement scrolling and virtualized-list handling.

### Phase 8

Implement deduplication.

### Phase 9

Implement messaging.

### Phase 10

Implement CSV/JSON export.

### Phase 11

Implement settings.

### Phase 12

Implement error handling.

### Phase 13

Run a code review.

### Phase 14

Fix TypeScript/build errors.

### Phase 15

Provide final installation instructions.

---

# 50. Critical Instruction

Do not claim that the extension can extract phone numbers that WhatsApp Web does not expose in the UI.

If WhatsApp shows:

```text
John Doe
```

but does not expose a phone number to the user, export:

```json
{
  "name": "John Doe",
  "phone": null
}
```

Do not attempt to discover the hidden number through private APIs, internal databases, network interception, or any other bypass.

The final implementation must prioritize:

```text
Reliability
Privacy
Security
Maintainability
User-visible UI automation
Clean architecture
```

Now build the complete extension source code and provide every required file with exact contents, followed by setup/build instructions and a testing checklist.
