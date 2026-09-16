# Liam Maquet — Graphics public release v9

This package is the temporary **public GitHub Pages** version while the full academic portfolio remains under development.

Only the student-facing Graphics section is included in this source package. The CV, profile photo, Research, Teaching, Tools, evaluation data and other portfolio pages/assets are intentionally excluded.

## Upload to the current GitHub repository

Replace the repository contents with this package, while keeping the repository's existing GitHub Pages settings.

If the current repository contains `src/layouts/package.json`, delete it. It is not part of this package and is not required.

The root URL redirects to `/graphics/`.

## Add the 11 graphics images

Upload the PNG files to:

`public/assets/graphics/orthographic-auxiliary/`

with these exact filenames:

- `01-overview-image.png`
- `02-orthographic-projection.png`
- `03-first-angle-projection.png`
- `04-projection-foreshortening.png`
- `05-principal-view-limitations.png`
- `06-first-auxiliary-view.png`
- `07-true-length-line.png`
- `08-true-length-to-point-view.png`
- `09-edge-view-plane.png`
- `10-second-auxiliary-view.png`
- `11-true-shape-oblique-surface.png`

The page is already wired to these paths. The image binaries were not supplied to ChatGPT, so they are not bundled in this ZIP.

## Included resource

`/graphics/orthographic-projection-auxiliary-views/` contains the long-form learning resource plus the integrated six-question **True Length & True Shape Check** supplied separately.

## Dependencies

- Astro `^7.3.2`
- `@astrojs/check` `^0.9.10`

Dependabot should remain enabled.

## Verification

```bash
npm install
npm run smoke
npm run check
npm run build
```

The included GitHub Actions workflow builds and deploys `dist/`.

Treat everything committed to this repository as public. Do not add raw evaluation reports, credentials, `.env` files, private documents or other material that is not intended for students/the public.
