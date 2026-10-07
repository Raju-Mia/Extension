# Chrome Web Store — Publishing Guide

This guide walks you through publishing **Lead Extractor for Telegram Web** to
the Chrome Web Store, including the settings this specific extension needs.

> Read the **[Important policy notes](#important-policy-notes--read-first)**
> section first. It affects whether your listing will be approved.

---

## 1. What you are uploading

Chrome wants a **ZIP** whose root contains `manifest.json` (not a `dist/` folder
wrapped inside). The repo already builds a store-ready ZIP:

```bash
npm run package
```

This runs the build and produces `telegram-lead-extractor.zip` in the project
root. **Upload that file.** (Do not zip `src/` — only the compiled `dist/`
output belongs in the package.)

Verify the ZIP looks right:

```bash
unzip -l telegram-lead-extractor.zip
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
2. Select `telegram-lead-extractor.zip`.
3. The dashboard parses your `manifest.json` and pre-fills the listing.

---

## 4. Store listing fields

| Field | Guidance |
| --- | --- |
| **Name** | `Lead Extractor for Telegram Web` (max 75 chars). Deliberately descriptive — **do not** start the name with "Telegram" alone or imply official status. |
| **Description** | Explain the single purpose: "Export the member list (name, @username, ID) that is already visible in your Telegram Web group or channel to CSV, Excel, or JSON. All processing happens locally in your browser — nothing is uploaded." |
| **Category** | *Productivity* |
| **Language** | English (add more via "Add language") |
| **Screenshots** | At least **1**, up to 10. Recommended **1280×800** or **640×400**. Capture the extractor window and the Options page. Blur/redact any real usernames or phone numbers in screenshots. |
| **Small promo graphic** | Optional but helps: **440×280**. |
| **Icon** | Pulled from your manifest (128px). It is original neutral artwork — **never** replace it with the Telegram paper-plane logo. |
| **Website URL** | `https://rajumia.com` |
| **Support / developer email** | `hi@rajumia.com` |

Add this line to the end of your listing description (required by trademark
policy for third-party-brand tools):
> This extension is an independent tool and is not affiliated with, endorsed by,
> or sponsored by Telegram.

---

## 5. Privacy section (MANDATORY for this extension)

This extension reads on-screen personal data (names/usernames), so Chrome
requires full disclosure. Fill these in on the listing's **Privacy** tab:

### 5.1 Single purpose
Write one clear sentence, e.g.:
> Lets a group member export the member list already shown in their own
> Telegram Web session to a local CSV/Excel/JSON file.

Your listing must match what the code actually does — nothing more.

### 5.2 Limited use / data disclosure
Declare the data you handle:
- **Access to personal information or content on a website** → **Yes**
  (you read member names/usernames displayed in Telegram Web).
- **Authentication information / cookies / tokens** → **No** (the extension does
  not read cookies, tokens, or private APIs).
- **Handle / transfer user data** → state that data is **processed locally only**
  and **never transmitted off-device**.

### 5.3 Privacy Policy URL — **required**
Chrome requires a public privacy policy for extensions that access personal data.
Use the template in [`docs/PRIVACY-POLICY.md`](./PRIVACY-POLICY.md) (already
filled with your contact `hi@rajumia.com` and website `https://rajumia.com`):
1. Host it at a public URL, e.g. `https://rajumia.com/privacy` (GitHub Pages, your
   site, or a Google Doc set to "Anyone with the link").
2. Paste that URL into the **Privacy policy** field.

### 5.4 Google API / permissions justification
You request only `downloads`, `storage`, and the `web.telegram.org` host.
Provide a one-line reason for each (the dashboard asks for justification):
- `downloads` — save the exported CSV/Excel/JSON file to the user's machine.
- `storage` — remember the user's preferences (format, scroll delay, options).
- `https://web.telegram.org/` — the only site the extension operates on.

---

## 6. Unverified-permissions warning

Because you use `host_permissions` for `web.telegram.org`, Chrome may show an
**"Unverified publisher / Unverified item"** warning during review. This is
normal. To reduce friction:
- Keep host permissions to the single required origin (already done).
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
   personal data.
3. Watch your email + the dashboard for status changes or requests.

---

## 9. After approval — updates

1. Bump `"version"` in `src/manifest.json` (e.g. `1.0.0` → `1.0.1`).
2. `npm run package`
3. Dashboard → your item → **Package** → upload the new ZIP → **Submit**.

---

## Important policy notes — READ FIRST

Publishing an extension that automates Telegram carries real risk. Be aware:

1. **Telegram Terms of Service.** Telegram restricts automated access and bulk
   collection of data from its services. Even though this tool only reads what
   is already on screen and uploads nothing, an automated DOM reader can still
   be considered a ToS violation by Telegram, which could lead to account
   restrictions for you or your users. This is a risk independent of Chrome's
   approval.

2. **Trademark policy (the #1 rejection reason for tools like this).** Chrome
   rejects listings that use another company's brand in the **name**, **icon**,
   or **images**, or that imply the extension is official. This project is
   already compliant by design:
   - Name is descriptive: *"Lead Extractor for Telegram Web"* (Telegram appears
     only to say which site it works with).
   - Icons are original neutral artwork (`gen-icons.mjs`) — **not** the
     Telegram paper-plane logo or its exact blue.
   - The disclaimer "not affiliated with Telegram" is in the manifest
     description and should also appear in the listing.
   Keep it this way for every update.

3. **Chrome Web Store "single purpose" + user data policies.** The store allows
   this kind of tool **only if** the privacy disclosures (section 5) are
   complete and accurate. Missing or vague privacy policy / data-disclosure
   entries are the #1 reason such extensions get rejected.

4. **Do not add hidden capabilities** (bulk messaging, joining groups,
   MTProto/private-API calls, contact enrichment, data exfiltration). Keep the
   code aligned with the stated single purpose, or review will fail.

5. **Consent & local law.** Exporting other people's contact information may be
   regulated (GDPR, etc.). The listing and privacy policy should make clear the
   user is responsible for lawful use of data they can already see.

If you want the lowest-friction path, publish **Unlisted**, keep the privacy
policy crystal clear about *local-only processing*, and never expand the
permission set.

---

## Pre-submit checklist

- [ ] `npm run package` produces a ZIP with `manifest.json` at the root
- [ ] Extension tested end-to-end on a small group **and** a large group
- [ ] Privacy Policy URL is live and public
- [ ] Data disclosures marked: personal data **yes**, cookies/tokens **no**, local-only processing
- [ ] Screenshots added with any real usernames/numbers redacted
- [ ] Single-purpose statement written
- [ ] Permission justifications filled (downloads / storage / host)
- [ ] "Not affiliated with Telegram" disclaimer present in listing
- [ ] No Telegram logo anywhere (icon, screenshots, promo graphic)
- [ ] Visibility chosen (Public or Unlisted)
- [ ] `version` in manifest is correct
