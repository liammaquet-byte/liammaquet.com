# Liam Maquet — Astro portfolio

Deployment-ready static Astro site recreating Liam Maquet’s black / white / `#C49A6C` Montserrat visual identity. It includes Home, Curriculum Vitae, Education, Research, Teaching, QCA Calculator and QR Code Generator routes.

## Important: safe deployment

This package **does not modify, redirect, or attach to the existing live site**. It contains **no `CNAME` file** and no DNS configuration. The safest first deployment is to a new GitHub repository using its default project Pages URL (`https://USERNAME.github.io/REPOSITORY/`). Only point a custom domain at the new site after it has been reviewed independently.

## Routes

- `/` — Home / overview
- `/cv/` — web CV + downloadable PDF
- `/education/`
- `/research/`
- `/teaching/` — teaching experience, CPD, certificate summaries, anonymized SET summary
- `/qca-calculator/` — integrated browser-only QCA/QCS calculator
- `/qr-code-generator/` — integrated browser-only QR generator

## Local development

Requirements: Node.js 24+ and npm.

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

Output is generated into `dist/`.

## GitHub Pages

1. Create a **new** GitHub repository and upload/push this project.
2. Keep the default branch named `main`.
3. In **Settings → Pages**, set **Source** to **GitHub Actions**.
4. Push to `main`. `.github/workflows/deploy.yml` builds and publishes the static `dist/` output.
5. The Astro config automatically detects repository-style GitHub Pages paths during Actions builds. You can also set `SITE_URL` / `BASE_PATH` environment variables if required.

No live domain or existing site is altered by these files.

## ORCID research refresh

ORCID: `0000-0002-7843-6424`.

The repository contains:

- `scripts/fetch-orcid.mjs` — fetches the public ORCID works endpoint.
- `src/data/research.json` — currently rendered cache.
- `src/data/research-fallback.json` — committed fallback dataset.
- `src/data/research-overrides.json` — manual corrections/additions/suppressions.
- `.github/workflows/refresh-research.yml` — runs every Monday at 06:17 UTC and can also be run manually.

If ORCID is unavailable, the script leaves the site usable by retaining cached data or loading the committed fallback. This means a transient API outage does not break the static build.

### Manual overrides

Edit `src/data/research-overrides.json`:

```json
{
  "items": [
    {
      "title": "Exact title from ORCID",
      "authors": "Preferred author string",
      "year": "2026",
      "type": "Conference paper",
      "url": "https://example.org/output"
    },
    {
      "title": "Output to hide",
      "hidden": true
    }
  ]
}
```

Overrides are matched by title (case-insensitive). An override may also add a record not currently returned by ORCID.

## QCA calculator

The original QCA utility has been integrated into the Astro route rather than embedded as an iframe. Its year factor, grade-to-value mapping, semester QCS/QCA logic, residual-QCA logic, validation and browser-only privacy model are retained.

## QR Code Generator

The original QR utility is also integrated natively. The provided QR encoding library is served as a local static asset, so the utility does not depend on a third-party QR API. Generation, PNG download, clipboard copy (where browser-supported), sizing and foreground/background colour controls remain browser-only.

## Public vs. source-only documents

The downloadable CV is copied to `public/downloads/Liam-Maquet-CV.pdf`.

The supplied certificate PDFs and SET feedback PDFs are **not copied into `public/` and therefore are not published by the site**. Their content is represented only as short certificate summaries and anonymized/aggregated teaching-feedback material.

SET summary calculations used on the Teaching page:

- Effectiveness: mean of 4.92 (2021) and 4.88 (2022) = **4.90**
- Preparation: mean of 5.00 and 4.96 = **4.98**
- Enthusiasm: mean of 4.92 and 4.96 = **4.94**
- Helpfulness: mean of 5.00 and 4.83 = **4.92**

The site paraphrases student comments into themes and does not expose student identities or source reports.

## Brand & assets

- Font: Montserrat (loaded from Google Fonts)
- Primary colours: black, white, `#C49A6C`
- Hero pattern is implemented in CSS, not as an externally hosted image.
- Profile image is derived from the supplied reference screenshot.

For a fully self-contained font setup, replace the Google Fonts `<link>` in `src/layouts/BaseLayout.astro` with locally licensed Montserrat webfont files.

## Content maintenance

Main editable content lives in `src/pages/`. Global styling is in `src/styles/global.css`. The layout/navigation is in `src/layouts/BaseLayout.astro`.

## Verification

The included `scripts/smoke-test.mjs` checks required routes/assets, research cache presence, and that source certificate/SET PDFs are not publishable. Run:

```bash
npm run smoke
```

A full Astro build is also enforced by the GitHub Pages deployment workflow. See `BUILD-VERIFICATION.md` for the packaging-environment test result.

Before publishing:
- `npm install`
- `npm run build`
- Confirm `dist/` includes each route.
- Test QCA interactions and QR generation in a browser.
- Verify CV download.
- Verify no certificate / SET PDFs are present in `dist/`.
- Verify GitHub Pages deployment on the repository URL before making any DNS/domain changes.
