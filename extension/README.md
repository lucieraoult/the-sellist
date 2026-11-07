# The Sellist: Chrome extension (prototype)

Fills the Vinted and Vestiaire Collective "new listing" forms from one Sellist listing. No passwords, no server, no database: the extension uses the sessions you already have in Chrome, and it never clicks "Publier" for you.

## Install (developer mode)
1. Chrome → `chrome://extensions` → turn on **Developer mode**.
2. **Load unpacked** → pick this `extension/` folder.
3. To use it with `index.html` opened as a file, click **Details** and turn on **Allow access to file URLs**. Otherwise serve the site: `npx serve .` → http://localhost:3000.

## Use
1. Log in to Vinted (vinted.fr or vinted.co.uk) and Vestiaire in the same Chrome. Pick your Vinted country in the "Mon compte Vinted" selector next to the button. On vinted.co.uk, condition, colour and material are translated to the English option names (`SELLIST_EN` in `sites.js`). Title and description stay in French, and the price number is sent as is (in £ on the UK site).
2. In The Sellist: photos → form → tick Vinted and/or Vestiaire → **Rédiger mes annonces**.
3. Click **Remplir Vinted + Vestiaire**. One tab opens per site and gets filled, and a panel shows what was filled and what's left for you ("à toi"), with copy buttons.
4. Check each tab, publish, then tick **En ligne** in The Sellist.

## Files
- `bridge.js`: runs on The Sellist page (localhost, file://, *.github.io, *.netlify.app, *.vercel.app) and forwards the job.
- `background.js`: opens the tabs and holds each tab's listing (`chrome.storage.local`). `SITE_URLS` holds the entry URLs.
- `sites.js`: **the per-site field map. Edit this when a field isn't found.** The matchers haven't been checked against the live forms yet.
- `filler.js`: generic engine (finds fields, fills React-controlled inputs, picks dropdown options, uploads photos) plus the panel.

## Debugging a missed field
On the Vinted/Vestiaire form, right-click the field → Inspect, and note its `id`, `name`, `data-testid` or label text. Add one of those to that field's `match` list in `sites.js`, then reload the extension.

## Test without the real sites
`npx serve .` then open `/test/items/new/`: a mock form that stubs the extension APIs and runs `sites.js` + `filler.js` directly.
