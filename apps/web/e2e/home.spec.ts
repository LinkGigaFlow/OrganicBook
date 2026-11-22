import { expect, test } from '@playwright/test';
import { start } from './helpers';

test('abre la página de bienvenida sin desplazamiento horizontal', async ({ page }) => {
  await start(page);
  await expect(page).toHaveTitle('Cuaderno');
  await expect(page.locator('.blocks h2').first()).toHaveText('Escribir con Markdown');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
