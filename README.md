# Browser Extensions

This repository contains three Chrome extensions for collecting information that is already visible in web applications:

## Extensions

### Google Maps Lead Extractor

Located in [`google-map-lead-extractor`](./google-map-lead-extractor/). Exports visible Google Maps business details such as name, phone, website, address, and rating to CSV, Excel, or JSON.

### Telegram Lead Extractor

Located in [`telegram-lead-extractor`](./telegram-lead-extractor/). Exports visible Telegram Web group members, including name, username, and ID, to CSV, Excel, or JSON.

### WhatsApp Lead Extractor

Located in [`whatsapp-lead-extractor`](./whatsapp-lead-extractor/). Exports the participant list visible in WhatsApp Web groups to CSV or JSON.

## Build a production ZIP

Run these commands from the repository root. Repeat the steps for each extension you want to package:

```bash
cd google-map-lead-extractor
npm install
npm run package
```

The production file will be created as `google-map-lead-extractor/google-map-lead-extractor.zip`.

Use the same commands for the other extensions:

```bash
cd ../telegram-lead-extractor
npm install
npm run package

cd ../whatsapp-lead-extractor
npm install
npm run package
```

Each `package` command builds the extension into `dist/` and creates a ZIP containing the files required for production. Upload the generated ZIP file, not the project source folder.

## Short production upload guide

1. Build the required ZIP with `npm run package`.
2. Open the Chrome Web Store Developer Dashboard.
3. Create a new item, or open an existing extension and choose **Upload new package**.
4. Select the generated `.zip` file from the relevant extension folder.
5. Review permissions, store listing details, privacy information, screenshots, and version notes.
6. Save the submission, fix any validation errors, and submit it for review.

For local testing before publishing, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the extension's `dist/` folder.
