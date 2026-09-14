import { defineConfig } from 'astro/config';

const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
const owner = process.env.GITHUB_REPOSITORY_OWNER;
const isProjectPages = Boolean(process.env.GITHUB_ACTIONS && repo && owner && repo !== `${owner}.github.io`);

export default defineConfig({
  output: 'static',
  site: process.env.SITE_URL || (owner ? `https://${owner}.github.io` : 'https://example.com'),
  base: process.env.BASE_PATH || (isProjectPages ? `/${repo}` : '/'),
  trailingSlash: 'always'
});
