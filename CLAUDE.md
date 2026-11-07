# The Sellist: prototype brief

"Poste une fois. Vends partout." French-language assistant that helps resellers publish one item to Vinted, Vestiaire Collective, Leboncoin and eBay, then reminds them to remove the listing elsewhere once it sells. No commission, and it never asks for marketplace passwords.

## Where this came from
`index.html` is a single-file prototype exported from a Claude artifact ("The Sellist (Copy)"), about 1,770 lines of vanilla HTML/CSS/JS with no build step. It was designed to run inside the artifact runtime, so a few things need replacing for a standalone app (see below). UI copy is in French, keep it that way.

## Views (hash-routed: #accueil, #connexion, #publier, #stock, #stats, #compte)
- **Accueil**: landing page with pricing (Free up to 10 items, Pro 12.99 EUR/month or 119 EUR/year, Pack Tri 4.99 EUR one-off for 30 more items over 60 days, Stats avancees add-on 3.99 EUR/month).
- **Connexion**: fake login/signup (demo only, nothing is sent). SSO buttons are placeholders.
- **Publier**: 4 steps. 1) photos (up to 20, compressed client-side, first is the cover), optional "Remplir avec l'IA" to fill the form from photos. 2) item form (titre, marque, categorie, taille, couleur, matiere, etat, mesures, poids, notes, prix, prix d'achat, remise). 3) routing: tier detection (courante / premium / luxe / objets) from brand and price, recommended sites with reasons, per-site price markups, "piece de valeur" mode (price floor, proofs of authenticity). 4) generated per-site listings (title, description, category path, price, spec fields), copy buttons, deep links to each site's "new listing" page, mark published/sold.
- **Mes articles**: stock list with per-site status pills, mark sold on X (prompts to remove the other listings), dormant-item alerts.
- **Statistiques**: free KPIs, Pro-gated charts (by site, time to sell, margin, dormant items), filters, "Donnees d'exemple" toggle.
- **Compte**: profile, plan, shop handles per site, default sales preferences, theme (auto/light/dark), notification toggles, CSV export, wipe data, logout.

## Key code landmarks in index.html
- `PLATFORMS`, `BRANDS` (data tables near line 700)
- `detect()`, `rule()`, `catRule()`, `refreshRouting()`, `renderRouting()`: routing logic
- `priceFor()`, `comparables()`, `renderAdvice()`: pricing and advice
- `aiListing()` (~line 1159): LLM prompt that returns JSON `{siteId:{titre,description,categorie}}`; `templateListing()` is the non-AI fallback
- `localStore()` / `saveItem()` (~line 1277): item persistence
- `renderStats()` (~line 1443), `renderAccount()` (~line 1608)
- Boot block at the end (~line 1735)

## Runtime dependencies to replace for a standalone prototype
The boot block uses `window.claude.use(...)` capabilities. Outside the artifact runtime they are absent and the app silently degrades to localStorage plus template listings, so it still runs. To make it real:
1. `sample` (LLM text and image calls): used by `aiListing()` and the photo "Remplir avec l'IA" flow. Replace with a small backend route that calls the Anthropic API (keep the API key server-side). Keep the same JSON contract.
2. `db` + `user` (per-user cloud storage, `data/users/{uid}` with a `settings` doc plus one doc per item): replace with real auth and a database (for example SQLite/Postgres, or Supabase). The `store` object has `put(item)`, `del(id)`, `load()`, so swap that interface.
3. `assets` (photo upload) and `downloads` (CSV export): use plain file upload storage and an `<a download>` Blob.
4. Fake auth (`ts-session` in localStorage): replace with a real provider.

localStorage keys in use: `ts-items`, `ts-settings`, `ts-markups`, `ts-session`, `ts-pro-preview`.

## Suggested next steps
1. Run it as is: `npx serve .` (or open index.html) and click through every view to confirm baseline behavior.
2. Split the single file into `index.html`, `styles.css`, `app.js` (or move to Vite) without changing behavior.
3. Add a minimal Node/Express (or Hono) backend with `/api/listing` (LLM) and `/api/items` (CRUD), and wire the `store` interface to it.
4. Real sign-in, then Stripe for the plans.
5. Marketplaces have no open posting APIs for most of these sites, so keep the "copy, paste, publish" flow and the reminder-to-remove logic as the core value; test any automation idea separately.

## Chrome extension (extension/)
MV3 extension that autofills Vinted and Vestiaire listing forms from step 4 ("Remplir Vinted + Vestiaire" bar, `renderXpost()` in index.html). The page talks to `extension/bridge.js` through `window.postMessage` (`source: "sellist-page"` / `"sellist-ext"`). No backend, no storage outside the browser, and the extension never clicks Publish. Field matchers live in `extension/sites.js`. They are unverified against the live forms because vinted.fr and vestiairecollective.com are blocked in Claude's browser pane, so test in real Chrome. A mock form lives at `test/items/new/`. See `extension/README.md`.

## Conventions
- Keep UI copy in French, informal "tu".
- Design tokens are CSS variables on `:root` (lin, encre, galet, vert) with a dark theme; keep both themes working and keep mobile layouts at 16px gutters.
- Keep the wordmark SVG and the "Instrument Serif" italic accent on key words.
