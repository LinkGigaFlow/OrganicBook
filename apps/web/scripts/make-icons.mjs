// Genera los íconos PNG de la app instalable a partir de un SVG (usa el Chromium de Playwright).
// Uso: node scripts/make-icons.mjs
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../public/', import.meta.url));

/** Cuaderno blanco con líneas sobre el azul de acento. `pad` = margen (zona segura de maskable). */
const svg = (pad, radius) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="#3b5bdb"/>
  <g transform="translate(${pad} ${pad}) scale(${(512 - 2 * pad) / 512})">
    <rect x="128" y="88" width="264" height="336" rx="28" fill="#fff"/>
    <rect x="104" y="88" width="56" height="336" rx="20" fill="#dbe4ff"/>
    ${[148, 196, 244, 292, 340].map((y) => `<circle cx="132" cy="${y}" r="11" fill="#3b5bdb"/>`).join('')}
    <rect x="196" y="160" width="160" height="22" rx="11" fill="#3b5bdb"/>
    <rect x="196" y="222" width="120" height="22" rx="11" fill="#91a7ff"/>
    <rect x="196" y="284" width="140" height="22" rx="11" fill="#91a7ff"/>
  </g>
</svg>`;

const icons = [
  { file: 'pwa-192.png', size: 192, pad: 0, radius: 96 },
  { file: 'pwa-512.png', size: 512, pad: 0, radius: 96 },
  // Maskable: fondo a sangre y dibujo dentro del 80 % central.
  { file: 'maskable-512.png', size: 512, pad: 64, radius: 0 },
  { file: 'apple-touch-icon.png', size: 180, pad: 24, radius: 0 },
];

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const { file, size, pad, radius } of icons) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg(pad, radius)}`,
  );
  await writeFile(out + file, await page.screenshot({ omitBackground: true }));
  console.log('ícono', file);
}
await writeFile(out + 'icon.svg', svg(0, 96).trim() + '\n');
await browser.close();
