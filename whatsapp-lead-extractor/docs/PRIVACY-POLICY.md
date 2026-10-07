# Privacy Policy — Lead Extractor for WhatsApp Web

**Effective date:** September 24, 2026
**Contact:** hi@rajumia.com
**Website:** https://rajumia.com

## Summary

Lead Extractor for WhatsApp Web runs **entirely inside your browser**. It does not have a
server, does not collect analytics, and **never uploads, transmits, or stores
your data anywhere off your device.**

## What the extension does

The extension reads the participant list **that is already visible on your
screen** while you browse a WhatsApp Web group you are a member of. For each
visible participant it can capture:

- Display name
- Phone number (only if it is shown in the WhatsApp Web interface)
- Role (e.g. Admin / Participant)

It then writes this information to a file **you** download (CSV or JSON).

## Data we do NOT access

- No login credentials, cookies, authentication tokens, or session keys
- No WhatsApp private/internal APIs, WebSockets, or encrypted databases
- No messages, media, or contacts outside the currently open group view
- No servers, no cloud storage, no third-party analytics or trackers

## Where your data goes

Nowhere. Processing happens locally in your browser via the page's visible DOM.
Exported files are saved directly to your own computer through Chrome's download
API. The extension developer has no access to any of this data and cannot see
your groups.

## Storage

Only your **preferences** (export format, scroll delay, "include myself" toggle)
are saved locally using `chrome.storage`. These never leave your device and can
be cleared at any time by removing the extension.

## Your responsibilities

You are responsible for using exported data lawfully and with the consent of the
people involved, in accordance with applicable privacy laws (for example GDPR or
local regulations) and WhatsApp's Terms of Service. Only export groups you are a
member of and have a legitimate reason to record.

## Permissions requested

| Permission | Why it is needed |
| --- | --- |
| `downloads` | Save the CSV/JSON file you generate to your computer. |
| `storage` | Remember your preferences locally. |
| `web.whatsapp.com` (host) | The only site the extension operates on. |

## Changes to this policy

If we change this policy we will update the effective date above and, for
material changes, notify users through the extension listing.

## Contact

Questions? Contact: hi@rajumia.com — https://rajumia.com

## Trademark notice

This extension is an independent tool. It is **not affiliated with, endorsed by,
or sponsored by WhatsApp**. WhatsApp is a trademark of its respective owner; it
is mentioned only to describe which website the extension works with.
