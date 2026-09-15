# Third-party notices

## DWG compatibility / Autodesk trademark

Sheet Nester works with DWG files. DWG is the native file format for Autodesk AutoCAD software and is a trademark of Autodesk, Inc. Sheet Nester is an independent project and is not affiliated with, sponsored by, endorsed by, or approved by Autodesk, Inc. No Autodesk logos or product icons are used.

## LibreDWG / libredwg-web

Optional DWG import uses **@mlightcad/libredwg-web version 0.7.10**, based on **GNU LibreDWG**. The npm package identifies its licence as **GPL-3.0**; GNU LibreDWG is GPLv3-or-later. A copy of GNU GPL version 3 is included as `GPL-3.0.txt`.

The GPL parser is intentionally loaded and executed in `dwg-worker.js`, a separate Web Worker. The main Sheet Nester application communicates with that worker only by `postMessage`: DWG bytes go in and ordinary parsed geometry data comes back. `dwg-worker.js` is distributed under GPL-3.0-or-later. The original Sheet Nester main application and `dwg-adapter.js` are distributed under the MIT licence in `LICENSE.txt`.

The default deployment loads the pinned libredwg-web 0.7.10 browser module from jsDelivr/npm when a DWG is opened. The drawing bytes are not sent to jsDelivr; only the decoder program is downloaded.

### Corresponding source

Exact upstream release used: **mlightcad/libredwg-web v0.7.10**, source commit **5909bd2**.

Source repository/tag: https://github.com/mlightcad/libredwg-web/tree/v0.7.10
Release page: https://github.com/mlightcad/libredwg-web/releases/tag/v0.7.10
GNU LibreDWG project/source information: https://www.gnu.org/software/libredwg/
Package page: https://www.npmjs.com/package/@mlightcad/libredwg-web/v/0.7.10

If you self-host the decoder instead of using the pinned CDN module, keep the exact corresponding source available alongside your hosted build (or provide equally clear access to the matching source) for as long as you distribute that build.

## Privacy

DXF and DWG drawing contents are processed locally in the user's browser. Sheet Nester does not upload drawing bytes to an application server. Normal web hosting/CDN request logs may still record requests for the web application's own files.
