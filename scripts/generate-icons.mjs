/**
 * Generates public/icons/icon-{192,512}.png from the CR Pocket SVG mark.
 * Maskable-safe: artwork stays within the inner 62% (safe zone is 80%, we pad extra).
 * Usage: node scripts/generate-icons.mjs
 */
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const mark = (size) => {
  const s = size;
  const pad = s * 0.19; // maskable-safe padding
  const inner = s - pad * 2;
  const cardW = inner * 0.52;
  const cardH = inner * 0.74;
  const cx = s / 2;
  const cy = s / 2 + s * 0.01;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1a1f4f"/>
      <stop offset="1" stop-color="#0d1030"/>
    </linearGradient>
    <linearGradient id="royal" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8b7dff"/>
      <stop offset="1" stop-color="#5847e8"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffd96b"/>
      <stop offset="1" stop-color="#eda92a"/>
    </linearGradient>
  </defs>
  <rect width="${s}" height="${s}" rx="${s * 0.22}" fill="url(#bg)"/>
  <g transform="rotate(-11 ${cx - cardW * 0.32} ${cy})">
    <rect x="${cx - cardW * 0.32 - cardW / 2}" y="${cy - cardH / 2}" width="${cardW}" height="${cardH}" rx="${cardW * 0.18}" fill="url(#royal)"/>
  </g>
  <g transform="rotate(9 ${cx + cardW * 0.34} ${cy})">
    <rect x="${cx + cardW * 0.34 - cardW / 2}" y="${cy - cardH / 2}" width="${cardW}" height="${cardH}" rx="${cardW * 0.18}" fill="url(#gold)"/>
    <circle cx="${cx + cardW * 0.34}" cy="${cy - cardH * 0.18}" r="${cardW * 0.14}" fill="#0d1030" opacity="0.85"/>
    <rect x="${cx + cardW * 0.34 - cardW * 0.26}" y="${cy + cardH * 0.14}" width="${cardW * 0.52}" height="${cardH * 0.07}" rx="${cardH * 0.035}" fill="#0d1030" opacity="0.55"/>
  </g>
</svg>`;
};

for (const size of [192, 512]) {
  const resvg = new Resvg(mark(size), { fitTo: { mode: 'width', value: size } });
  const png = resvg.render().asPng();
  const file = join(outDir, `icon-${size}.png`);
  writeFileSync(file, png);
  console.log(`wrote ${file} (${png.length} bytes)`);
}
