import fs from 'node:fs';
import path from 'node:path';

const required = [
  'src/pages/index.astro','src/pages/cv.astro','src/pages/education.astro',
  'src/pages/research.astro','src/pages/teaching.astro',
  'src/pages/qca-calculator.astro','src/pages/qr-code-generator.astro',
  'public/downloads/Liam-Maquet-CV.pdf','public/assets/qrcode.min.js',
  '.github/workflows/deploy.yml','.github/workflows/refresh-research.yml'
];
const missing = required.filter(p => !fs.existsSync(p));
if (missing.length) throw new Error(`Missing required files: ${missing.join(', ')}`);

const publicFiles = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, {withFileTypes:true})) {
    const p = path.join(dir,e.name);
    e.isDirectory() ? walk(p) : publicFiles.push(p);
  }
}
walk('public');
const pdfs = publicFiles.filter(p => p.toLowerCase().endsWith('.pdf'));
if (pdfs.some(p => !p.endsWith('Liam-Maquet-CV.pdf'))) {
  throw new Error(`Unexpected public PDF(s): ${pdfs.join(', ')}`);
}

const data = JSON.parse(fs.readFileSync('src/data/research.json','utf8'));
if (!Array.isArray(data) || data.length < 1) throw new Error('Research cache is empty.');

console.log('Smoke test passed.');
console.log(`Research records: ${data.length}`);
console.log(`Public PDFs: ${pdfs.join(', ')}`);
