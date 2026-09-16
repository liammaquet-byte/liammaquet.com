# Graphics public release verification

`node scripts/smoke-test.mjs` is expected to pass before upload. The 11 diagram binaries are intentionally absent until uploaded directly.

A local Astro production build could not be completed in the packaging environment because npm installation was unavailable. GitHub Actions remains the production build check.
