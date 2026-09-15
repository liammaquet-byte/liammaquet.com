# Sheet Nester v3.1 — public/free release package

This release keeps the v2.9 lattice nesting engine and v3.0.1 CAD behaviour, but cleans up the DWG integration for a public, non-commercial website.

## Upload these files together

- `index.html`
- `dwg-adapter.js`
- `dwg-worker.js`
- `LICENSE.txt`
- `GPL-3.0.txt`
- `THIRD_PARTY_NOTICES.md`

DWG decoding is isolated in `dwg-worker.js`. The worker loads the pinned GPL-licensed `@mlightcad/libredwg-web` 0.7.10 decoder only when a user opens a DWG. Drawing bytes stay in the browser.

## Licences

The original Sheet Nester main application and main-thread bridge are provided under the MIT licence. The DWG worker integration is GPL-3.0-or-later because it is the boundary that loads and runs the GPL DWG parser. See `THIRD_PARTY_NOTICES.md` and `GPL-3.0.txt`.

Non-commercial/free hosting does not remove GPL obligations, so keep the licence and notice files on the public site with the application.

## Trademark wording

The UI uses DWG only descriptively (for example, “works with DWG files”) and includes an Autodesk independence/trademark notice. Do not rename the product to include DWG or use Autodesk logos.

## Optional fully self-hosted decoder

`dwg-worker.js` first looks for `./vendor/libredwg-web/dist/libredwg-web.js`; if absent, it falls back to the pinned jsDelivr package. If you later self-host the decoder, also retain/provide the exact matching corresponding source described in `THIRD_PARTY_NOTICES.md`.

This package is a compliance-oriented technical arrangement, not a substitute for legal advice.
