import fs from 'node:fs';
import path from 'node:path';

const required = [
  'src/pages/index.astro','src/pages/graphics/index.astro',
  'src/pages/graphics/orthographic-projection-auxiliary-views.astro',
  'src/components/GraphicsQuiz.astro','src/layouts/BaseLayout.astro',
  '.github/workflows/deploy.yml'
];
const missing = required.filter(p => !fs.existsSync(p));
if (missing.length) throw new Error(`Missing required files: ${missing.join(', ')}`);
if (fs.existsSync('src/layouts/package.json')) throw new Error('Remove unexpected src/layouts/package.json.');

const forbidden = [
  'public/downloads/Liam-Maquet-CV.pdf','public/assets/liam-maquet.png',
  'src/pages/cv.astro','src/pages/research.astro','src/pages/teaching.astro',
  'src/data/teaching-evaluations.json'
];
const exposed = forbidden.filter(p => fs.existsSync(p));
if (exposed.length) throw new Error(`Graphics-only package contains excluded files: ${exposed.join(', ')}`);

const diagramDir='public/assets/graphics/orthographic-auxiliary';
const expected=['01-overview-image.png','02-orthographic-projection.png','03-first-angle-projection.png','04-projection-foreshortening.png','05-principal-view-limitations.png','06-first-auxiliary-view.png','07-true-length-line.png','08-true-length-to-point-view.png','09-edge-view-plane.png','10-second-auxiliary-view.png','11-true-shape-oblique-surface.png'];
const missingDiagrams=expected.filter(name=>!fs.existsSync(path.join(diagramDir,name)));
console.log('Graphics-only smoke test passed.');
console.log(`Graphics diagrams awaiting upload: ${missingDiagrams.length}`);
