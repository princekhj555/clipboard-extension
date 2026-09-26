# Clippy

Clippy is an offline-first browser extension for saving and reusing text snippets. Entries are stored on the device with the browser's local extension storage; nothing is sent to a server.

## Install from this folder

The checked-in `vendor/` directory contains the extension's runtime dependencies, so you can load the extension directly. Keep the whole project folder together; do not select or move individual files.

### Chrome or Brave

1. Open `chrome://extensions` in Chrome or `brave://extensions` in Brave.
2. Turn on **Developer mode**.
3. Select **Load unpacked** and choose this project folder, the one containing `manifest.json`.
4. To keep Clippy visible in the toolbar, open the Extensions menu and pin it.

After changing files, use the extension's **Reload** control on the extensions page.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Select **This Firefox**, then **Load Temporary Add-on**.
3. Choose this folder's `manifest.json`.

Firefox removes temporary add-ons when it closes; load the add-on again after restarting. The manifest includes a Gecko extension ID and uses the same portable Manifest V3 popup implementation.

## Use Clippy

- Create snippets with **New entry**. Open an entry to edit or delete it; use the copy icon to copy its content.
- **General** is the default collection. Use the **Private** tab and enter `0000` to unlock the private collection. Use **Lock** or close the popup to lock it again.
- In an entry form, select **Private entry** to store it in the private collection. You can also change this setting while editing an entry.
- Search, selection, bulk deletion, import, and export apply to the active collection. Import can merge entries or replace entries in that collection only.

**Private collection note:** the passcode is a convenience gate, not encryption. Entries are stored in the browser's local extension storage and are not encrypted; do not use this feature for secrets that require strong protection.

## Development checks

Node.js and npm are only needed to regenerate the vendored assets or run the syntax check. From this folder:

```sh
npm install
npm run vendor
npm run check
```

`npm run vendor` copies the polyfill and Lucide SVG icons into `vendor/`. Keep those generated runtime files with the extension when loading or packaging it.

## Backups

Exports are JSON objects shaped like `{ "version": 1, "entries": [...] }`. Import also accepts a raw entries array. Importing into Private marks imported entries as private; importing into General marks them as general.