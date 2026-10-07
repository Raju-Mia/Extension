# Chrome Web Store — Publishing Guide

This guide walks you through publishing **Lead Extractor for Google Maps** to the
Chrome Web Store, including the settings this specific extension needs.

> Read the **[Important policy notes](#important-policy-notes--read-first)**
> section first. It affects whether your listing will be approved.

---

## 1. What you are uploading

Chrome wants a **ZIP** whose root contains `manifest.json` (not a `dist/` folder
wrapped inside). The repo already builds a store-ready ZIP:

```bash
npm run package
```

This runs the build and produces `google-map-lead-extractor.zip` in the project
root. **Upload that file.** (Do not zip `src/` — only the compiled `dist/`
output belongs in the package.)

Verify the ZIP looks right:

```bash
unzip -l google-map-lead-extractor.zip
# manifest.json must be at the top level, alongside icons/, popup.html, etc.
```

---

## 2. Create a developer account

1. Go to <https://chrome.google.com/webstore/devconsole>
2. Sign in with the Google account that will own the listing.
3. Pay the **one-time $5 USD** developer registration fee.
4. Complete the identity verification when prompted.

---

## 3. Upload the package

1. In the Developer Dashboard click **"Add new item"** → **"Upload package"**.
2. Select `google-map-lead-extractor.zip`.
3. The dashboard parses your `manifest.json` and pre-fills the listing.

---

## 4. Store listing fields

| Field | Guidance |
| --- | --- |
| **Name** | `Lead Extractor for Google Maps` (max 75 chars). Deliberately descriptive — **do not** start the name with "Google" alone or imply official status. |
| **Description** | Explain the single purpose: "Collect the business listings (name, phone, website, address, rating) already visible in your own Google Maps search results and export them to CSV, Excel, or JSON. No API key, no server — everything runs locally in your browser." |
| **Category** | *Productivity* |
| **Language** | English (add more via "Add language") |
| **Screenshots** | At least **1**, up to 10. Recommended **1280×800** or **640×400**. Capture the extractor window and the Options page. Use a test search; blur/redact anything sensitive. |
| **Small promo graphic** | Optional but helps: **440×280**. |
| **Icon** | Pulled from your manifest (128px). It is original neutral artwork — **never** replace it with the Google Maps pin or Google's multicolor logo. |
| **Website URL** | `https://rajumia.com` |
| **Support / developer email** | `hi@rajumia.com` |

Add this line to the end of your listing description (required by trademark
policy for third-party-brand tools):
> This extension is an independent tool and is not affiliated with, endorsed by,
> or sponsored by Google.

---

## 5. Privacy section (MANDATORY for this extension)

This extension reads on-screen business data, so Chrome requires full
disclosure. Fill these in on the listing's **Privacy** tab:

### 5.1 Single purpose
Write one clear sentence, e.g.:
> Lets a user export the business listings already shown in their own Google
> Maps search results to a local CSV/Excel/JSON file.

Your listing must match what the code actually does — nothing more.

### 5.2 Limited use / data disclosure
Declare the data you handle:
- **Access to personal information or content on a website** → **Yes** (you read
  publicly displayed business listings from Google Maps).
- **Authentication information / cookies / tokens** → **No** (the extension does
  not read cookies, tokens, or private APIs).
- **Handle / transfer user data** → state that data is **processed and stored
  locally only** and **never transmitted off-device**.

### 5.3 Privacy Policy URL — **required**
Chrome requires a public privacy policy for extensions that access data.
Use the template in [`docs/PRIVACY-POLICY.md`](./PRIVACY-POLICY.md) (already
filled with your contact `hi@rajumia.com` and website `https://rajumia.com`):
1. Host it at a public URL, e.g. `https://rajumia.com/privacy` (GitHub Pages, your
   site, or a Google Doc set to "Anyone with the link").
2. Paste that URL into the **Privacy policy** field.

### 5.4 Permissions justification
You request `storage`, `tabs`, `downloads`, the Maps host permissions, and an
**optional** `<all_urls>` for website lookup. Provide a one-line reason for each
(the dashboard asks for justification):
- `storage` — remember the user's settings and collected records locally.
- `tabs` — open and manage the separate collector window so the user's own tab
  is never hijacked.
- `downloads` — save the exported CSV/Excel/JSON file to the user's machine.
- `https://www.google.com/maps/*`, `https://maps.google.com/*` — the only pages
  read by default.
- **Optional `<all_urls>`** — used **only** for the opt-in website-extraction
  feature, requested on demand when the user enables it; explain this clearly.

> Tip: keep the `<all_urls>` entry under **optional_host_permissions** (as the
> manifest already does). It is not granted at install — the user is prompted
> only if they turn website extraction on, which keeps the default permission
> footprint minimal and review-friendly.

---

## 6. Unverified-permissions warning

Because you use `host_permissions` for Google Maps, Chrome may show an
**"Unverified publisher / Unverified item"** warning during review. This is
normal. To reduce friction:
- Keep host permissions to the required origins only (already done).
- Make sure the privacy policy and disclosures are complete before submitting.
- Respond to any reviewer requests promptly.

---

## 7. Visibility

Choose **Public** (anyone can find it) or **Unlisted** (only people with the
link can install). For a personal/utility tool, **Unlisted** is often the safer
choice and still passes review.

---

## 8. Submit for review

1. Click **"Submit item for review"** in the dashboard.
2. Review typically takes **a few days to ~2 weeks** for extensions that touch
   website data.
3. Watch your email + the dashboard for status changes or requests.

---

## 9. After approval — updates

1. Bump `"version"` in `src/manifest.json` (e.g. `1.0.0` → `1.0.1`).
2. `npm run package`
3. Dashboard → your item → **Package** → upload the new ZIP → **Submit**.

---

## Important policy notes — READ FIRST

Publishing an extension that automates Google Maps carries real risk. Be aware:

1. **Google Maps Terms of Service.** Google restricts automated access and bulk
   collection of data from its services. Even though this tool only reads what
   is already on screen and uploads nothing, an automated DOM reader can still
   be considered a ToS violation by Google. This is a risk independent of
   Chrome's approval. Keep crawl delays reasonable (the Options default is a
   gentle 900 ms) and never hammer the page.

2. **Trademark policy (the #1 rejection reason for tools like this).** Chrome
   rejects listings that use another company's brand in the **name**, **icon**,
   or **images**, or that imply the extension is official. This project is
   already compliant by design:
   - Name is descriptive: *"Lead Extractor for Google Maps"* (Google appears
     only to say which site it works with).
   - Icons are original neutral artwork (`gen-icons.mjs`) — **not** the Google
     Maps pin or Google's multicolor palette.
   - The disclaimer "not affiliated with Google" is in the manifest description
     and should also appear in the listing.
   Keep it this way for every update.

3. **Chrome Web Store "single purpose" + user data policies.** The store allows
   this kind of tool **only if** the privacy disclosures (section 5) are
   complete and accurate. Missing or vague privacy policy / data-disclosure
   entries are the #1 reason such extensions get rejected.

4. **Do not add hidden capabilities** (ad enrichment, resale of data, background
   exfiltration, bypassing logins/CAPTCHAs, or mass crawling the whole web).
   Keep the code aligned with the stated single purpose, or review will fail.
   Website extraction must remain opt-in and rate-limited.

5. **Consent & local law.** Collecting business contact information may be
   regulated (GDPR, anti-spam laws, etc.). The listing and privacy policy should
   make clear the user is responsible for lawful use of the data.

If you want the lowest-friction path, publish **Unlisted**, keep the privacy
policy crystal clear about *local-only processing*, keep website extraction
off-by-default and optional-permission, and never expand the default permission
set.

---

## Pre-submit checklist

- [ ] `npm run package` produces a ZIP with `manifest.json` at the root
- [ ] Extension tested end-to-end on a small search **and** a large one
- [ ] Collector window verified to leave the user's own tab untouched
- [ ] Privacy Policy URL is live and public
- [ ] Data disclosures marked: website content **yes**, cookies/tokens **no**, local-only processing
- [ ] Optional website permission is off-by-default and justified in the listing
- [ ] Screenshots added (test search, nothing sensitive)
- [ ] Single-purpose statement written
- [ ] Permission justifications filled (storage / tabs / downloads / host / optional)
- [ ] "Not affiliated with Google" disclaimer present in listing
- [ ] No Google/Maps logo anywhere (icon, screenshots, promo graphic)
- [ ] Visibility chosen (Public or Unlisted)
- [ ] `version` in manifest is correct
