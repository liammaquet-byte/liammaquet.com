# Build verification

## Completed in the packaging environment

`node scripts/smoke-test.mjs` passed:

- all seven Astro routes are present;
- both browser utilities and the local QR library are present;
- the research cache is non-empty;
- only the downloadable CV PDF is inside `public/`;
- certificate and SET source PDFs are not present in the publishable tree.

`node --check scripts/fetch-orcid.mjs` also passed.

## Astro production build

A local `npm install` / `astro build` was attempted, but the packaging sandbox cannot resolve `registry.npmjs.org` (`EAI_AGAIN`). Therefore dependencies could not be downloaded in this environment.

The repository includes a GitHub Pages workflow that runs `npm install` followed by `npm run build` on GitHub-hosted runners before deployment. Run the same commands locally in a networked Node 24+ environment to reproduce the production build before publishing.
