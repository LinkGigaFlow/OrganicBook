import { expect, type Page, test } from '@playwright/test';
import { editor, newPage, openSidebar, start, titleBox } from './helpers';

const settings = (page: Page) => page.getByRole('dialog', { name: 'Personalizar' });

async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Personalizar' }).click();
  await expect(settings(page)).toBeVisible();
}

/** Contraste WCAG entre dos colores CSS calculados por el navegador. */
async function contrast(page: Page, fg: string, bg: string): Promise<number> {
  return page.evaluate(
    ([a, b]) => {
      const rgb = (c: string) => {
        const el = document.createElement('i');
        el.style.color = c;
        document.body.append(el);
        const v = getComputedStyle(el)
          .color.match(/[\d.]+/g)!
          .map(Number);
        el.remove();
        return v.slice(0, 3);
      };
      const lum = (c: string) => {
        const [r, g, bl] = rgb(c).map((x) => {
          const s = x / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
      };
      const [l1, l2] = [lum(a!), lum(b!)].sort((x, y) => y - x);
      return (l1! + 0.05) / (l2! + 0.05);
    },
    [fg, bg],
  );
}

const cssVar = (page: Page, name: string) =>
  page.evaluate((n) => getComputedStyle(document.body).getPropertyValue(n).trim(), name);

test.beforeEach(async ({ page }) => start(page));

test('los cuatro temas se leen bien y el acento se aplica', async ({ page }) => {
  await openSettings(page);
  for (const [label, skin] of [
    ['Claro', 'light'],
    ['Oscuro', 'dark'],
    ['Sepia', 'sepia'],
    ['Automático', 'auto'],
  ] as const) {
    await settings(page).getByRole('radio', { name: label }).click();
    await expect(page.locator('html')).toHaveAttribute('data-skin', skin);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const ink = await page.evaluate(() => getComputedStyle(document.body).color);
    const mute = await cssVar(page, '--mute');
    const accent = await cssVar(page, '--ac');
    expect(await contrast(page, ink, bg), `tinta en ${label}`).toBeGreaterThan(7);
    expect(await contrast(page, mute, bg), `texto secundario en ${label}`).toBeGreaterThan(4.5);
    expect(await contrast(page, '#ffffff', accent), `botón de acento en ${label}`).toBeGreaterThan(
      4.5,
    );
  }
  // Oscuro de verdad es oscuro y sepia es crema.
  await settings(page).getByRole('radio', { name: 'Oscuro' }).click();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(25, 25, 25)');
  await settings(page).getByRole('radio', { name: 'Sepia' }).click();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(247, 241, 229)');

  await settings(page).getByRole('radio', { name: 'Acento verde' }).click();
  expect(await cssVar(page, '--ac')).toBe('#2b8a3e');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f7f1e5');
  await settings(page).getByRole('button', { name: 'Listo' }).click();

  // Se recuerda.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'sepia');
  expect(await cssVar(page, '--ac')).toBe('#2b8a3e');
});

test('fuente, tamaño y ancho del documento', async ({ page, isMobile }) => {
  const doc = page.locator('.doc');
  await expect(doc).toHaveCSS('font-size', '16px');
  await openSettings(page);
  await settings(page).getByRole('radio', { name: 'Serif' }).click();
  await settings(page).getByRole('radio', { name: '18 px' }).click();
  await settings(page).getByRole('radio', { name: 'Ancho' }).click();
  await settings(page).getByRole('button', { name: 'Listo' }).click();
  await expect(doc).toHaveCSS('font-family', /Literata/);
  await expect(doc).toHaveCSS('font-size', '18px');
  await expect(doc).toHaveCSS('max-width', '1120px');
  // La letra viene de la app (no del sistema) y ya está cargada.
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('18px "Literata Variable"');
  });
  expect(loaded).toBe(true);
  if (!isMobile) {
    const w = (await doc.boundingBox())!.width;
    expect(w).toBeGreaterThan(800);
  }
  await openSettings(page);
  await settings(page).getByRole('radio', { name: 'Mono' }).click();
  await settings(page).getByRole('radio', { name: '15 px' }).click();
  await expect(doc).toHaveCSS('font-family', /JetBrains Mono/);
  await expect(doc).toHaveCSS('font-size', '15px');
});

test('idioma del dictado y "Solo el lápiz dibuja" en Personalizar', async ({ page }) => {
  await openSettings(page);
  await settings(page).getByLabel('Idioma del dictado').selectOption('es-MX');
  await settings(page)
    .getByLabel(/Solo el lápiz dibuja/)
    .check();
  await settings(page).getByRole('button', { name: 'Listo' }).click();
  await page.reload();
  await openSettings(page);
  await expect(settings(page).getByLabel('Idioma del dictado')).toHaveValue('es-MX');
  await expect(settings(page).getByLabel(/Solo el lápiz dibuja/)).toBeChecked();
});

test('estilo del cuaderno orgánico: fondo, tinta y letra', async ({ page }) => {
  await openSidebar(page);
  await page.getByRole('button', { name: 'Nuevo cuaderno orgánico' }).click();
  await expect(titleBox(page)).toBeFocused();
  await page.keyboard.type('Estilos');
  await page.keyboard.press('Enter');
  const board = page.getByTestId('board');
  await expect(board).toHaveCSS('background-color', 'rgb(27, 27, 27)');

  await page
    .getByRole('toolbar', { name: 'Agregar al cuaderno' })
    .getByRole('button', { name: 'Estilo' })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Estilo del cuaderno' });
  // Al cambiar el fondo, la tinta vuelve a la de ese fondo.
  await dialog.getByRole('radio', { name: 'Corcho' }).click();
  await expect(board).toHaveCSS('background-color', 'rgb(185, 139, 93)');
  await expect(dialog.getByRole('radio', { name: 'Tinta #3a2412' })).toBeChecked();
  await dialog.getByRole('radio', { name: 'Tinta #ff6b6b' }).click();
  await dialog.getByRole('radio', { name: 'Marcador' }).click();
  await dialog.getByRole('button', { name: 'Listo' }).click();

  const center = board.getByRole('button', { name: 'Tema central' });
  await expect(center).toHaveCSS('color', 'rgb(255, 107, 107)');
  await expect(center).toHaveCSS('font-family', /Patrick Hand/);
  const loaded = await page.evaluate(async () => {
    await document.fonts.load('20px "Patrick Hand"');
    return document.fonts.check('20px "Patrick Hand"');
  });
  expect(loaded).toBe(true);

  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.getByTestId('board')).toHaveCSS('background-color', 'rgb(185, 139, 93)');
  await expect(page.getByTestId('board').getByRole('button', { name: 'Tema central' })).toHaveCSS(
    'font-family',
    /Patrick Hand/,
  );
});

test('barra de bloques flotante: agrega bloques debajo del actual', async ({ page }) => {
  await newPage(page, 'Con barra');
  await page.keyboard.type('Primero');
  const bar = page.getByRole('toolbar', { name: 'Agregar bloque' });
  await bar.getByRole('button', { name: 'Lista' }).click();
  await page.keyboard.type('punto');
  await bar.getByRole('button', { name: 'Tarea' }).click();
  await page.keyboard.type('pendiente');
  await bar.getByRole('button', { name: 'Título' }).click();
  await page.keyboard.type('Sección');
  await expect(editor(page).locator('[data-block="bullet"]')).toHaveText('punto');
  await expect(editor(page).locator('[data-block="todo"]')).toContainText('pendiente');
  await expect(editor(page).locator('h2')).toHaveText('Sección');
  await bar.getByRole('button', { name: 'Dibujo' }).click();
  await expect(editor(page).locator('.pad canvas')).toBeVisible();
});

test.describe('reglas de pantalla', () => {
  test('celular: zonas táctiles de 44 px, inputs de 16 px y barra en la zona segura', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Reglas para pantallas táctiles angostas');
    await newPage(page, 'Táctil');
    const tooSmall = async () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('button, select, input'))
          .filter((el) => {
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            return (
              r.width > 0 &&
              r.height > 0 &&
              s.visibility !== 'hidden' &&
              (el as HTMLInputElement).type !== 'file'
            );
          })
          .filter((el) => {
            // Una casilla dentro de su etiqueta se toca en toda la etiqueta.
            const r = (el.closest('label') ?? el).getBoundingClientRect();
            return r.height < 43.5 || r.width < 31.5;
          })
          .map(
            (el) =>
              `${el.tagName}.${el.className} «${el.getAttribute('aria-label') ?? el.textContent?.trim()}» ${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`,
          ),
      );
    expect(await tooSmall()).toEqual([]);

    // Inputs de 16 px o más: iOS no hace zoom al tocarlos.
    await openSidebar(page);
    const search = page.getByRole('searchbox', { name: 'Buscar' });
    await expect(search).toHaveCSS('font-size', '16px');
    // El cajón se cierra tocando fuera.
    await page.locator('.scrim').click({ position: { x: 370, y: 400 } });

    // La barra de bloques cabe (o se desplaza en horizontal) y queda dentro de la pantalla.
    const bar = page.getByRole('toolbar', { name: 'Agregar bloque' });
    const box = (await bar.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    await expect(bar).toHaveCSS('overflow-x', 'auto');

    await openSettings(page);
    expect(await tooSmall()).toEqual([]);
    await expect(settings(page).getByLabel('Idioma del dictado')).toHaveCSS('font-size', '16px');
  });

  test('escritorio: barra lateral fija de 264 px', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Solo en pantallas anchas');
    const side = page.getByRole('complementary', { name: 'Páginas' });
    expect((await side.boundingBox())!.width).toBe(264);
    await expect(page.getByRole('button', { name: 'Abrir páginas' })).toBeHidden();
  });
});
