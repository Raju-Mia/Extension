# Privacy Policy — Lead Extractor for Google Maps

**Effective date:** October 1, 2026
**Contact:** hi@rajumia.com
**Website:** https://rajumia.com

## Summary

Lead Extractor for Google Maps runs **entirely inside your browser**. It has **no
server**, collects **no analytics**, and **never uploads, transmits, or stores
your data anywhere off your device.** It requires no API key and no account.

## What the extension does

When you run a Google Maps search, the extension reads the business listings
**that are already visible on your screen** and collects them into a file **you**
download (CSV, Excel, or JSON). For each business it can capture information
Google Maps publicly displays, such as:

- Business name and category
- Phone number (only as publicly shown)
- Website URL and address
- Rating and review count
- Opening hours, business status, services, description, Plus Code, coordinates
- Google Maps link and the search keyword you used

Missing values are left **blank**. The extension never fabricates data.

Processing happens in a **separate collector window** the extension opens, so
your own Maps tab is never navigated or taken over. Data is stored only in
`chrome.storage.local` on your device.

## Optional website lookup (off by default)

If you explicitly turn on "website extraction", the extension can open a
business's **own public website** to look for publicly displayed email addresses
and social links (Facebook, Instagram, LinkedIn, YouTube, TikTok). This:

- Is **disabled by default** and only runs after you grant an extra browser
  permission to access those sites.
- Reads only a **small number of public pages** — the homepage and up to two
  contact/about pages — never the whole site or the wider internet.
- **Never** bypasses logins, CAPTCHAs, or access controls.
- Is skipped for any site you have not allowed.

## Data we do NOT access

- No login credentials, cookies, authentication tokens, or session keys
- No private or hidden information, and no Google Places/Maps API data
- No personal data of individuals — only public business listings
- No servers, no cloud storage, no third-party analytics or trackers

## Where your data goes

Nowhere. Everything is processed locally from the page's visible DOM and kept on
your device. Exported files are saved directly to your own computer through
Chrome's download API. The developer has no access to anything you collect.

## Storage

Your **collected records** and **preferences** (batch limits, delay, toggles,
export format) are stored locally with `chrome.storage.local`. They never leave
your device. You can erase the records at any time with **Clear** in the popup /
results page or **Clear all collected records** in Options, or by removing the
extension.

## Your responsibilities

You are responsible for using exported data lawfully, in accordance with
applicable privacy and consumer laws and Google Maps' Terms of Service. Only
collect business listings you have a legitimate reason to record, and do not use
the data for unsolicited messaging or spam.

## Permissions requested

| Permission | Why it is needed |
| --- | --- |
| `storage` | Keep your settings and collected records locally on your device. |
| `tabs` | Open and manage the separate collector window so your own tab is never hijacked. |
| `downloads` | Save the CSV/Excel/JSON file you generate to your computer. |
| `https://www.google.com/maps/`, `https://maps.google.com/` (host) | The only pages the extension reads by default. |
| Business websites (**optional**, requested on demand) | Only if you enable website extraction; used to read a business's own public contact/about pages. |

## Changes to this policy

If we change this policy we will update the effective date above and, for
material changes, notify users through the extension listing.

## Contact

Questions? Contact: hi@rajumia.com — https://rajumia.com

## Trademark notice

This extension is an independent tool. It is **not affiliated with, endorsed by,
or sponsored by Google**. Google and Google Maps are trademarks of Google LLC;
they are mentioned only to describe which website the extension works with.
