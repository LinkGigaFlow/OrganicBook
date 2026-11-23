import { expect, type Page, test } from '@playwright/test';
import { blockTypes, editor, newPage, paste, start, waitForSave } from './helpers';

/** Solo se permite la app local: cualquier pedido a internet (CDN, fuentes) falla. */
async function offline(page: Page) {
  const external: string[] = [];
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue();
    external.push(url.href);
    return route.abort('internetdisconnected');
  });
  return external;
}

const mathEditor = (page: Page) => page.locator('.mathb.editing');
const source = (page: Page) => page.getByRole('textbox', { name: 'Código LaTeX', exact: true });

test.describe('LaTeX', () => {
  let external: string[];
  test.beforeEach(async ({ page }) => {
    external = await offline(page);
    await start(page);
  });
  test.afterEach(() => {
    expect(external, 'no se pide nada a internet').toEqual([]);
  });

  test('$$ abre el editor: vista previa en vivo, símbolos, plantillas y Ctrl+Enter', async ({
    page,
  }) => {
    await newPage(page, 'Ecuaciones');
    await page.keyboard.type('$$');
    await expect(mathEditor(page)).toBeVisible();
    await expect(source(page)).toBeFocused();
    await expect(page.locator('.mtools button')).toHaveCount(22);
    // Los botones muestran los símbolos ya renderizados con KaTeX.
    await expect(page.locator('.mtools button .katex').first()).toBeVisible();

    await page.keyboard.type('a = ');
    await page.getByRole('button', { name: '\\frac{}{}' }).click();
    await page.keyboard.type('1');
    await expect(source(page)).toHaveValue('a = \\frac{1}{}');
    await page.getByRole('button', { name: '\\alpha', exact: true }).click();
    await expect(source(page)).toHaveValue('a = \\frac{1\\alpha}{}');
    const preview = page.locator('.mprev');
    await expect(preview.locator('.katex-display')).toBeVisible();
    await expect(preview.locator('.katex-error')).toHaveCount(0);

    // Plantilla de química en una línea nueva; mhchem la dibuja sin errores.
    await page.getByRole('button', { name: 'Plantillas' }).click();
    await page.getByRole('menuitem', { name: 'Química' }).click();
    await expect(source(page)).toHaveValue('a = \\frac{1\\alpha}{}\n\\ce{2H2 + O2 -> 2H2O}');
    await expect(preview.locator('.katex-error')).toHaveCount(0);
    await expect(preview).toContainText('→');

    // Ctrl+Enter termina y sigue escribiendo debajo.
    await page.keyboard.press('Control+Enter');
    await expect(mathEditor(page)).toHaveCount(0);
    await expect(editor(page)).toBeFocused();
    await page.keyboard.type('Después');
    expect(await blockTypes(page)).toEqual(['math', 'p']);

    // Tocar la fórmula vuelve a abrir el editor; Esc lo cierra.
    await preview.click();
    await expect(mathEditor(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(mathEditor(page)).toHaveCount(0);

    await waitForSave(page);
    await page.reload();
    await expect(page.locator('.mprev .katex-display')).toBeVisible();
    expect(await blockTypes(page)).toEqual(['math', 'p']);
  });

  test('menú /: ecuación con plantilla y fórmula en línea con su editor', async ({ page }) => {
    await newPage(page, 'Menú');
    await page.keyboard.type('/');
    await page.keyboard.type('ecuacion');
    await page.keyboard.press('Enter');
    await expect(source(page)).toBeFocused();
    await page.getByRole('button', { name: 'Plantillas' }).click();
    await page.getByRole('menuitem', { name: 'Matriz 2×2' }).click();
    await expect(page.locator('.mprev .katex-error')).toHaveCount(0);
    await page.getByRole('button', { name: 'Listo' }).click();
    await expect(mathEditor(page)).toHaveCount(0);

    await editor(page).locator('p').last().click();
    await page.keyboard.type('/');
    await page.keyboard.type('inline');
    await page.keyboard.press('Enter');
    const inline = page.getByRole('textbox', { name: 'Código LaTeX de la fórmula' });
    await expect(inline).toBeFocused();
    await page.keyboard.type('r^2');
    await expect(page.locator('.iprev .katex')).toBeVisible();
    await page.getByRole('button', { name: 'Listo' }).click();
    await expect(inline).toHaveCount(0);
    await expect(editor(page).locator('span.tex[data-tex="r^2"] .katex')).toBeVisible();
    // El cursor queda después de la fórmula para seguir escribiendo.
    await page.keyboard.type(' es el radio');
    await expect(editor(page).locator('p').last()).toContainText('es el radio');

    // Quitar elimina la fórmula.
    await editor(page).locator('span.tex[data-tex="r^2"]').click();
    await page.getByRole('button', { name: 'Quitar' }).click();
    await expect(editor(page).locator('span.tex')).toHaveCount(0);
  });

  test('$...$ en el texto se convierte, pero «$500 y $300» no; \\ce{H2O} se ve bien', async ({
    page,
  }) => {
    await newPage(page, 'Química');
    await page.keyboard.type('Agua: $\\ce{H2O}$ y cuesta $500 y $300');
    await page.keyboard.press('Enter');
    const tex = editor(page).locator('span.tex');
    await expect(tex).toHaveCount(1);
    await expect(tex).toHaveAttribute('data-tex', '\\ce{H2O}');
    await expect(tex.locator('.katex-error')).toHaveCount(0);
    // H con el 2 como subíndice y luego O (mhchem agrega un espaciador invisible).
    await expect(tex.locator('.katex-html')).toHaveText(/^H.*2.*O$/);
    await expect(tex.locator('.katex-html .msupsub')).toHaveCount(1);
    await expect(editor(page).locator('p').first()).toContainText('y cuesta $500 y $300');

    // La fuente de KaTeX viene de la app.
    const fontOk = await page.evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.check('16px KaTeX_Main');
    });
    expect(fontOk).toBe(true);

    // Editar desde el editor emergente.
    await tex.click();
    const inline = page.getByRole('textbox', { name: 'Código LaTeX de la fórmula' });
    await expect(inline).toHaveValue('\\ce{H2O}');
    await inline.fill('\\ce{CO2}');
    await page.keyboard.press('Enter');
    await expect(tex).toHaveAttribute('data-tex', '\\ce{CO2}');
  });

  test('exportar y pegar Markdown con LaTeX', async ({ page }) => {
    await newPage(page, 'Markdown');
    await paste(
      page,
      'La energía $E=mc^2$ cuesta $5 y $6\n$$\n\\int_0^1 x\\,dx\n$$\n$$\\ce{NaCl}$$\nFin',
    );
    expect(await blockTypes(page)).toEqual(['p', 'math', 'math', 'p']);
    await expect(editor(page).locator('span.tex')).toHaveAttribute('data-tex', 'E=mc^2');
    await expect(page.locator('.mprev .katex-display')).toHaveCount(2);
    await expect(page.locator('.mprev .katex-error')).toHaveCount(0);

    await page.getByRole('button', { name: 'Opciones de página' }).click();
    await page.getByRole('menuitem', { name: 'Ver y copiar como Markdown' }).click();
    const md = await page.getByRole('textbox', { name: 'Markdown de la página' }).inputValue();
    expect(md).toContain('La energía $E=mc^2$ cuesta $5 y $6');
    expect(md).toContain('$$\n\\int_0^1 x\\,dx\n$$');
    expect(md).toContain('$$\n\\ce{NaCl}\n$$');
  });
});
