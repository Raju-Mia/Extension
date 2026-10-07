I want you to build a completely free Chrome Extension called:

"Google Maps Lead Extractor"

The extension must use only free/open-source technologies and must NOT require any paid API, Google Maps API key, backend server, subscription, or external paid service.

IMPORTANT:
- This is a browser extension for extracting information that is publicly visible in Google Maps.
- Do not bypass CAPTCHA, login restrictions, access controls, anti-bot systems, or other security mechanisms.
- Do not attempt to obtain hidden/private information.
- Do not send scraped data to any external server.
- Everything should run locally inside the user's browser.
- The user should be able to export the collected data locally as CSV.
- Prefer CSV because it is completely free and opens directly in Excel.
- If XLSX export is implemented, use a bundled free/open-source library rather than a paid API.
- Respect normal page loading and avoid aggressive request rates.

==================================================
CORE USER EXPERIENCE
==================================================

Example:

The user is currently on:

https://www.google.com/maps/search/dhaka+mirpur+hospital

Google Maps displays many businesses.

The user clicks the extension icon.

Extension popup/sidebar shows:

Google Maps Lead Extractor

Search detected:
"dhaka mirpur hospital"

[ Start Extraction ]

Settings:
Maximum result batches: 5
Maximum businesses: 100
Extract website information: ON/OFF
Delay between actions: configurable
Duplicate removal: ON

When the user clicks START:

1. Detect the current Google Maps search URL.
2. Open a NEW Google Maps tab/window for the extraction.
3. Do NOT take control of the user's current working tab.
4. The user must be able to continue using their current browser tab normally.
5. The new collector tab performs the extraction.
6. Show extraction progress inside the extension popup/dashboard.

Example:

Current tab:
Google Maps - user continues working

New tab:
Google Maps - automated collection

The extension works only in the collector tab.

==================================================
IMPORTANT: GOOGLE MAPS RESULT COLLECTION
==================================================

Google Maps uses dynamically loaded/infinite-scroll results rather than reliable traditional numbered pages.

Therefore implement a "batch" system.

Default:

Maximum batches = 5

For each batch:

1. Read currently loaded business results from the left-side result list.
2. Extract all businesses currently visible/loaded.
3. Scroll the result panel down.
4. Wait for additional results to load.
5. Detect newly loaded businesses.
6. Continue until another batch is completed.
7. Repeat up to the configured batch limit.
8. Stop earlier if no more results are loading.

Do NOT simply scrape the same DOM repeatedly.

Maintain a Set of unique business IDs/URLs/names+addresses to prevent duplicates.

Allow user settings:

- 1 batch
- 2 batches
- 3 batches
- 5 batches
- 10 batches
- Custom maximum results

Default = 5 batches.

==================================================
DATA TO EXTRACT
==================================================

For every Google Maps business, try to collect:

1. Business Name
2. Category
3. Phone Number
4. Website URL
5. Email Address
6. Facebook URL
7. Instagram URL
8. Other social media URLs if publicly available
9. Google Maps URL
10. Address
11. Rating
12. Review Count
13. Opening Hours
14. Business Status
15. Services if visible
16. Description/short business description if visible
17. Plus Code if visible
18. Latitude
19. Longitude
20. Search keyword
21. Extraction date/time

Additional useful fields:

- Business type
- Price level if available
- Directions URL if available
- Place URL
- Source = Google Maps

If a field is not available, leave it blank.

NEVER put fake data into missing fields.

==================================================
PHONE NUMBER
==================================================

Extract the phone number shown publicly in the Google Maps business profile.

Normalize formatting where possible.

Example:

09666-787807

should remain recognizable as:

09666787807

But also preserve the original value in:

Phone Original

Columns:

Phone
Phone Original

If multiple phone numbers are publicly displayed, store them separated by semicolon.

==================================================
EMAIL
==================================================

Google Maps frequently does NOT directly display email addresses.

Therefore:

- First check whether an email is actually publicly visible in the Google Maps business information.
- If "Extract website information" is enabled and the business has a website, optionally open/read the public website in a controlled way and look for publicly displayed email addresses.
- Do not bypass login, CAPTCHA, Cloudflare, access restrictions, or robots/security controls.
- Only collect publicly available contact information.
- Do not crawl the entire internet.
- Limit website inspection to a small number of relevant pages, such as:
  homepage
  contact
  about
- Make website extraction optional because it can slow down the process.

If no email is found:

Email = blank

==================================================
FACEBOOK / SOCIAL LINKS
==================================================

If the Google Maps profile exposes a Facebook link, collect it.

If website extraction is enabled and the public website contains links to:

Facebook
Instagram
LinkedIn
YouTube
TikTok

collect those public URLs.

Do not attempt to discover private accounts or bypass anything.

==================================================
BUSINESS PROFILE EXTRACTION
==================================================

When a business result is selected/opened:

Extract information from the business profile.

The extension should handle Google Maps dynamic loading.

Possible fields include:

Business name
Category
Rating
Review count
Address
Phone
Website
Hours
Services
Description
Plus Code
Business status

After extraction, return to the result list and continue.

Do not lose the previous results.

==================================================
DUPLICATE HANDLING
==================================================

Duplicate removal is mandatory.

Use multiple identifiers where available:

1. Google Maps business/place URL
2. Business name + address
3. Business name + phone

If the same business appears multiple times:

keep only one record.

If a later extraction contains additional fields that were missing from the first record, merge the data.

Example:

Record 1:
Name = ABC Hospital
Phone = 01711111111
Website = blank

Record 2:
Name = ABC Hospital
Phone = 01711111111
Website = https://abchospital.com

Final record:

Name = ABC Hospital
Phone = 01711111111
Website = https://abchospital.com

==================================================
EXTENSION UI
==================================================

Create a professional but simple UI.

Popup/dashboard:

--------------------------------
Google Maps Lead Extractor
--------------------------------

Search:
Dhaka Mirpur Hospital

Status:
Ready

Settings:

Maximum batches:
[ 5 ]

Maximum businesses:
[ 100 ]

Website extraction:
[ ON ]

Social links:
[ ON ]

Remove duplicates:
[ ON ]

[ START EXTRACTION ]

During extraction:

Status:
Extracting...

Businesses found: 37
Businesses processed: 29
New businesses: 26
Duplicates: 3

Current business:
Popular Diagnostic Centre Ltd

Progress:
██████████░░░░ 60%

[ PAUSE ]
[ STOP ]

After completion:

Extraction Complete

Businesses found: 73
Unique businesses: 68
Duplicates removed: 5

[ DOWNLOAD CSV ]

[ DOWNLOAD XLSX ] (optional)

[ VIEW RESULTS ]

==================================================
BACKGROUND TAB REQUIREMENT
==================================================

VERY IMPORTANT:

The user must be able to continue working in their current browser tab.

When extraction starts:

- Duplicate/open the Google Maps search URL into a new tab.
- Perform extraction in that tab.
- Do not navigate the user's original tab.
- Do not replace the current page.
- Do not interfere with other tabs.
- The extension should communicate between:
  popup
  background service worker
  collector tab
  content scripts

Use Chrome Extension Manifest V3.

Recommended architecture:

manifest.json
background.js
content-script.js
popup.html
popup.js
popup.css
options.html
options.js
storage.js
export.js
utils.js

You can use additional modules if necessary.

==================================================
CHROME EXTENSION ARCHITECTURE
==================================================

Use:

Manifest V3

Permissions should be minimal.

Potential permissions:

storage
tabs
scripting

Host permissions should be limited to the domains actually needed, preferably:

https://www.google.com/maps/*
https://maps.google.com/*

If website extraction is enabled, request only the minimum additional permissions needed and explain why.

Do NOT request unnecessary permissions such as:

history
bookmarks
cookies
downloads
all_urls

unless technically necessary.

==================================================
DATA STORAGE
==================================================

Use chrome.storage.local.

Do not create a backend.

Store extraction session locally.

If the browser closes during extraction, try to preserve already-collected records.

Allow:

New extraction
Resume extraction
Clear results
Export results

==================================================
CSV EXPORT
==================================================

CSV must be generated locally.

Column order:

Business Name
Category
Phone
Phone Original
Email
Website
Facebook
Instagram
LinkedIn
YouTube
TikTok
Rating
Review Count
Business Status
Opening Hours
Services
Description
Address
Plus Code
Latitude
Longitude
Google Maps URL
Search Query
Extraction Date

Use proper CSV escaping.

The CSV must open correctly in Microsoft Excel.

Use UTF-8 encoding.

IMPORTANT FOR BANGLA:

The extension must correctly support Unicode/Bangla.

Example:

ঢাকা মিরপুর হাসপাতাল

should export correctly without corrupted characters.

If possible, add UTF-8 BOM for Excel compatibility.

==================================================
OPTIONAL XLSX
==================================================

If implementing XLSX:

Use a free/open-source library bundled with the extension.

Do not use a paid API.

If XLSX causes unnecessary complexity, CSV is the primary required export format.

==================================================
ERROR HANDLING
==================================================

The extension must handle:

- Google Maps loading slowly
- Result list not found
- Business profile not opening
- Missing phone number
- Missing website
- Missing rating
- Missing address
- Duplicate businesses
- End of results
- Temporary DOM changes
- User manually closes collector tab
- User presses STOP
- Internet connection problems

Do not crash.

Show meaningful status messages.

Example:

"Waiting for Google Maps results..."

"Loading more businesses..."

"No additional results detected."

"Collector tab was closed."

==================================================
IMPORTANT GOOGLE MAPS DOM REQUIREMENT
==================================================

Do NOT depend on only one CSS selector.

Google Maps DOM changes frequently.

Create a selector strategy with multiple fallback selectors.

Use semantic/accessible attributes where possible.

Examples:

aria-label
role
data attributes
href patterns
text patterns

Do not hardcode one fragile class name as the only method.

Create helper functions such as:

findSearchResults()
findBusinessCards()
openBusinessCard()
extractBusinessName()
extractPhone()
extractWebsite()
extractAddress()
extractRating()
extractReviewCount()
extractHours()
extractCategory()
extractBusinessUrl()

Each extraction function should have fallback strategies.

==================================================
SCROLLING
==================================================

The result panel must be identified correctly.

Do NOT scroll the entire browser window if the Google Maps results are inside a scrollable panel.

Find the actual results container.

Algorithm:

1. Detect results container.
2. Record currently visible result URLs/names.
3. Scroll result container.
4. Wait.
5. Check whether new results appeared.
6. Extract new results.
7. Repeat.
8. Stop when:
   - batch limit reached
   - maximum business count reached
   - no new results after several attempts
   - user presses STOP

Use reasonable delays.

Do not perform extremely rapid actions.

==================================================
STATE MACHINE
==================================================

Implement extraction as a state machine:

IDLE

STARTING

OPENING_COLLECTOR

DETECTING_RESULTS

COLLECTING_LIST

OPENING_BUSINESS

EXTRACTING_BUSINESS

RETURNING_TO_LIST

LOADING_MORE

NEXT_BATCH

COMPLETED

PAUSED

STOPPED

ERROR

This should make the extension easier to debug and maintain.

==================================================
PAUSE / STOP
==================================================

PAUSE should stop automation temporarily while preserving collected data.

RESUME should continue.

STOP should stop automation and preserve the collected results.

The user should still be able to export whatever has already been collected.

==================================================
RESULTS TABLE
==================================================

Create a results page/table.

Columns:

Name
Category
Phone
Email
Website
Facebook
Rating
Reviews
Address
Status

Allow:

Search
Filter
Sort
Delete row
Clear all
Export CSV

For example:

--------------------------------------------------------------
Name                 Phone       Rating   Website       Address
--------------------------------------------------------------
Mirpur Hospital      017...      4.2      Yes           Mirpur
ABC Diagnostic       018...      4.5      Yes           Mirpur
XYZ Clinic           019...      3.9      No            Mirpur
--------------------------------------------------------------

==================================================
SEARCH QUERY DETECTION
==================================================

If the user is currently on:

https://www.google.com/maps/search/dhaka+mirpur+hospital

detect:

Search Query:
dhaka mirpur hospital

Save it with every record.

If query cannot be detected, allow manual input.

==================================================
NO API KEY
==================================================

Do NOT use Google Places API.

Do NOT use Google Maps API.

Do NOT require a Google Cloud account.

Do NOT require billing.

The extension should operate by interacting with the Google Maps web interface that the user has opened.

==================================================
NO SERVER
==================================================

Everything should be local.

Architecture:

Google Maps
      |
      v
Chrome Extension
      |
      v
Local chrome.storage
      |
      v
CSV/XLSX export

No data should be uploaded to my server.

==================================================
SECURITY / PRIVACY
==================================================

Do not collect:

cookies
passwords
authentication tokens
private messages
private profiles
hidden/private phone numbers
private Google account information

Only process information available to the user through the public Google Maps business interface and optional publicly accessible business websites.

==================================================
PROJECT STRUCTURE
==================================================

Create a complete working project:

google-maps-lead-extractor/

manifest.json

src/
  background/
  content/
  popup/
  options/
  results/
  utils/

assets/

README.md

package.json

If a build system is useful, use a free local build setup such as Vite.

The final extension must be loadable through:

Chrome
→ Extensions
→ Developer mode
→ Load unpacked

==================================================
README
==================================================

Write a complete README explaining:

1. How to install
2. How to load unpacked
3. How to use
4. How batch extraction works
5. How to change maximum batches
6. How CSV export works
7. How website extraction works
8. Limitations
9. Troubleshooting
10. Privacy behavior
11. No API key required

==================================================
TESTING
==================================================

Create testable extraction utilities where possible.

Test with examples such as:

"dhaka mirpur hospital"

"dhaka diagnostic center"

"mirpur restaurant"

"dhaka dental clinic"

The extractor must tolerate businesses where some fields are missing.

==================================================
IMPORTANT FINAL REQUIREMENT
==================================================

Do not just create a visual mockup.

I need a REAL working Chrome Extension.

Implement the complete functionality.

Do not leave TODO placeholders for the core extraction logic.

If Google Maps DOM selectors need adjustment, create a robust selector/fallback architecture rather than pretending that one selector will always work.

At the end provide:

1. Complete source code
2. Folder structure
3. Installation instructions
4. How to load it into Chrome
5. How to test it
6. Known Google Maps DOM limitations
7. Explanation of how the collector tab works
8. Explanation of CSV export