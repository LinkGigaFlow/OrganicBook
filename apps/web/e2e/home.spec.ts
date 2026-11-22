import { expect, test } from '@playwright/test';

test('la página de inicio muestra "Cuaderno"', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Cuaderno');
  await expect(page.getByRole('heading', { level: 1, name: 'Cuaderno' })).toBeVisible();

  // Sin desplazamiento horizontal en ninguna de las dos pantallas.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
