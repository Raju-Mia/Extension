# Privacy Policy — Lead Extractor for Telegram Web

**Effective date:** September 23, 2026
**Contact:** hi@rajumia.com
**Website:** https://rajumia.com

## Summary

Lead Extractor for Telegram Web runs **entirely inside your browser**. It does
not have a server, does not collect analytics, and **never uploads, transmits,
or stores your data anywhere off your device.**

## What the extension does

The extension reads the member list **that is already visible on your screen**
while you browse a Telegram Web group or channel you are a member of. For each
visible member it can capture:

- Display name
- @username (only if it is shown in the Telegram Web interface)
- Phone number (only if it is shown in the Telegram Web interface — Telegram
  rarely displays this in member lists)
- Telegram ID (the numeric ID present in the page markup)
- Role (owner / admin / bot / member, only when the UI indicates it)

It then writes this information to a file **you** download (CSV, Excel, or JSON).

## Data we do NOT access

- No login credentials, cookies, authentication tokens, or session keys
- No Telegram private/internal APIs, MTProto connections, WebSockets, or local databases
- No messages, media, or contacts outside the currently open member list
- No hidden phone numbers: if a number is not displayed on screen, it is not collected
- No servers, no cloud storage, no third-party analytics or trackers

## Where your data goes

Nowhere. Processing happens locally in your browser via the page's visible DOM.
Exported files are saved directly to your own computer through Chrome's download
API. The extension developer has no access to any of this data and cannot see
your groups.

## Storage

Only your **preferences** (export format, scroll delay, max scan time,
"include myself" toggle) are saved locally using `chrome.storage`. These never
leave your device and can be cleared at any time by removing the extension.

## Your responsibilities

You are responsible for using exported data lawfully and with the consent of the
people involved, in accordance with applicable privacy laws (for example GDPR or
local regulations) and Telegram's Terms of Service. Only export groups or
channels you are a member of and have a legitimate reason to record.

## Permissions requested

| Permission | Why it is needed |
| --- | --- |
| `downloads` | Save the CSV/Excel/JSON file you generate to your computer. |
| `storage` | Remember your preferences locally. |
| `web.telegram.org` (host) | The only site the extension operates on. |

## Changes to this policy

If we change this policy we will update the effective date above and, for
material changes, notify users through the extension listing.

## Contact

Questions? Contact: hi@rajumia.com — https://rajumia.com

## Trademark notice

This extension is an independent tool. It is **not affiliated with, endorsed by,
or sponsored by Telegram**. Telegram is a trademark of its respective owner; it
is mentioned only to describe which website the extension works with.
