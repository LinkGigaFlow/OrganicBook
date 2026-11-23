import { expect, test } from '@playwright/test';
import { editor, newPage, start, titleBox } from './helpers';

test('manifiesto instalable con íconos y modo independiente', async ({ page, request }) => {
  await start(page);
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const res = await request.get(href!);
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m).toMatchObject({
    name: 'Cuaderno',
    short_name: 'Cuaderno',
    lang: 'es',
    display: 'standalone',
    start_url: '/',
  });
  const sizes = (m.icons as { sizes: string; purpose?: string }[]).map((i) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(m.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  for (const icon of m.icons as { src: string }[]) {
    expect((await request.get('/' + icon.src)).ok(), icon.src).toBe(true);
  }
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', /^#/);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
});

test('la app abre y funciona en modo avión', async ({ page, context }) => {
  await start(page);
  // Espera a que el service worker termine de guardar la app.
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active?.state;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  // Crea contenido con fórmula para comprobar KaTeX y las fuentes sin red.
  await newPage(page, 'Sin red');
  await page.keyboard.type('Energía $E=mc^2$ ok');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);

  await context.setOffline(true);
  await page.reload();
  await expect(titleBox(page)).toHaveText('Sin red');
  await expect(editor(page).locator('span.tex .katex')).toBeVisible();
  await expect(editor(page).locator('span.tex .katex-error')).toHaveCount(0);
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      inter: document.fonts.check('16px "Inter Variable"'),
      katex: document.fonts.check('16px KaTeX_Main'),
    };
  });
  expect(fonts).toEqual({ inter: true, katex: true });

  // Se puede seguir escribiendo y crear páginas sin conexión.
  await editor(page).click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' sin conexión');
  await expect(editor(page)).toContainText('sin conexión');
  await context.setOffline(false);
});
