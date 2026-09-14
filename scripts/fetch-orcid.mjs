import fs from 'node:fs/promises';

const ORCID = '0000-0002-7843-6424';
const endpoint = `https://pub.orcid.org/v3.0/${ORCID}/works`;
const out = new URL('../src/data/research.json', import.meta.url);
const fallback = new URL('../src/data/research-fallback.json', import.meta.url);
const overridesFile = new URL('../src/data/research-overrides.json', import.meta.url);

const readJson = async (url, def) => {
  try { return JSON.parse(await fs.readFile(url, 'utf8')); } catch { return def; }
};

function pickYear(summary) {
  return String(summary?.['publication-date']?.year?.value || '');
}
function pickTitle(summary) {
  return summary?.title?.title?.value?.trim() || '';
}
function pickType(summary) {
  return String(summary?.type || 'Research output').replaceAll('_',' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
}
function pickUrl(summary) {
  const ids = summary?.['external-ids']?.['external-id'] || [];
  const doi = ids.find(x => x?.['external-id-type']?.toLowerCase() === 'doi')?.['external-id-value'];
  if (doi) return `https://doi.org/${String(doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')}`;
  if (summary?.url?.value) return summary.url.value;
  return `https://orcid.org/${ORCID}`;
}

async function getAuthors(putCode) {
  if (!putCode) return 'See ORCID record';
  try {
    const r = await fetch(`https://pub.orcid.org/v3.0/${ORCID}/work/${putCode}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'liam-maquet-portfolio/1.0' }
    });
    if (!r.ok) return 'See ORCID record';
    const work = await r.json();
    const contributors = work?.contributors?.contributor || [];
    const names = contributors.map(c => c?.['credit-name']?.value).filter(Boolean);
    return names.length ? names.join('; ') : 'See ORCID record';
  } catch {
    return 'See ORCID record';
  }
}

async function fetchWorks() {
  const r = await fetch(endpoint, { headers: { Accept: 'application/json', 'User-Agent': 'liam-maquet-portfolio/1.0' } });
  if (!r.ok) throw new Error(`ORCID HTTP ${r.status}`);
  const body = await r.json();
  const bestSummaries = (body.group || []).map(group => {
    const summaries = group['work-summary'] || [];
    return [...summaries].sort((a,b) => Number(b?.['put-code'] || 0) - Number(a?.['put-code'] || 0))[0];
  }).filter(Boolean);

  return await Promise.all(bestSummaries.map(async best => ({
    title: pickTitle(best),
    year: pickYear(best),
    type: pickType(best),
    authors: await getAuthors(best?.['put-code']),
    url: pickUrl(best)
  }))).then(items => items.filter(x => x.title));
}


const overrides = await readJson(overridesFile, { items: [] });
let items;
try {
  items = await fetchWorks();
  if (!items.length) throw new Error('ORCID returned no public works.');
  console.log(`Fetched ${items.length} public works from ORCID.`);
} catch (err) {
  console.warn(`ORCID refresh unavailable: ${err.message}`);
  items = await readJson(out, null) || await readJson(fallback, []);
  console.warn(`Using cached/fallback research data (${items.length} items).`);
}

const byTitle = new Map(items.map(x => [x.title.trim().toLowerCase(), x]));
for (const override of overrides.items || []) {
  const key = String(override.title || '').trim().toLowerCase();
  if (!key) continue;
  const current = byTitle.get(key) || {};
  byTitle.set(key, { ...current, ...override });
}
items = [...byTitle.values()].filter(x => !x.hidden).map(({hidden, ...x}) => x);
items.sort((a,b) => Number(b.year||0)-Number(a.year||0) || a.title.localeCompare(b.title));

await fs.writeFile(out, JSON.stringify(items, null, 2) + '\n');
console.log(`Wrote ${items.length} research records to src/data/research.json.`);
