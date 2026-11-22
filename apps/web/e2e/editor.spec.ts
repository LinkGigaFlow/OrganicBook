import { expect, test } from '@playwright/test';
import { blockTypes, editor, newPage, paste, start, titleBox, waitForSave } from './helpers';

test.beforeEach(async ({ page }) => {
  await start(page);
});

test('los atajos Markdown crean bloques y nada se pierde al recargar', async ({ page }) => {
  await newPage(page, 'Atajos');
  const k = page.keyboard;
  await k.type('# Grande');
  await k.press('Enter');
  await k.type('## Mediano');
  await k.press('Enter');
  await k.type('### Chico');
  await k.press('Enter');
  await k.type('- uno');
  await k.press('Enter');
  await k.type('dos');
  await k.press('Enter');
  await k.press('Enter'); // lista vacía + Enter = párrafo
  await k.type('1. primero');
  await k.press('Enter');
  await k.type('segundo');
  await k.press('Enter');
  await k.press('Enter');
  await k.type('[] tarea');
  await k.press('Enter');
  await k.press('Enter');
  await k.type('[x] hecha');
  await k.press('Enter');
  await k.press('Enter');
  await k.type('> una cita');
  await k.press('Enter');
  await k.type('```');
  await k.type('let a = 1;');
  await k.press('Enter');
  await k.type('let b = 2;');
  await k.press('Control+Enter');
  await k.type('---');
  await k.type('Texto con **negrita**, *cursiva*, `código` y ~~tachado~~');
  await k.press('Enter'); // al salir del bloque se aplica el formato en línea
  await k.type('fin');

  const expected = [
    'h1',
    'h2',
    'h3',
    'bullet',
    'bullet',
    'num',
    'num',
    'todo',
    'todo',
    'quote',
    'pre',
    'hr',
    'p',
    'p',
  ];
  await expect.poll(() => blockTypes(page)).toEqual(expected);
  const ed = editor(page);
  await expect(ed.locator('strong')).toHaveText('negrita');
  await expect(ed.locator('em')).toHaveText('cursiva');
  await expect(ed.locator('p code')).toHaveText('código');
  await expect(ed.locator('s')).toHaveText('tachado');
  await expect(ed.locator('[data-block="todo"] .ck').nth(1)).toBeChecked();
  await expect(ed.locator('pre')).toHaveText('let a = 1;\nlet b = 2;');

  await waitForSave(page);
  await page.reload();
  await expect(titleBox(page)).toHaveText('Atajos');
  await expect.poll(() => blockTypes(page)).toEqual(expected);
  await expect(editor(page).locator('strong')).toHaveText('negrita');
  await expect(editor(page).locator('[data-block="num"]').nth(1)).toHaveText('segundo');
});

test('el menú / filtra sin tildes y se usa con flechas y Enter', async ({ page }) => {
  await newPage(page, 'Menú');
  await page.keyboard.type('/titulo');
  const menu = page.getByRole('menu', { name: 'Bloques' });
  await expect(menu.getByRole('menuitem')).toHaveCount(3);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(menu).toBeHidden();
  await page.keyboard.type('Sección');
  await expect.poll(() => blockTypes(page)).toEqual(['h2']);
  await expect(editor(page).locator('h2')).toHaveText('Sección');

  await page.keyboard.press('Enter');
  await page.keyboard.type('/sep');
  await page.keyboard.press('Enter');
  await expect.poll(() => blockTypes(page)).toEqual(['h2', 'hr', 'p']);

  await page.keyboard.type('/xyz');
  await expect(page.getByRole('menu', { name: 'Bloques' })).toBeHidden();
});

test('Enter divide, Backspace convierte en párrafo y une con el anterior', async ({ page }) => {
  await newPage(page, 'Teclado');
  const k = page.keyboard;
  await k.type('- holamundo');
  for (let i = 0; i < 5; i++) await k.press('ArrowLeft');
  await k.press('Enter');
  await expect.poll(() => blockTypes(page)).toEqual(['bullet', 'bullet']);
  await expect(editor(page).locator('[data-block="bullet"]').nth(1)).toHaveText('mundo');

  await k.press('Backspace'); // viñeta → párrafo
  await expect.poll(() => blockTypes(page)).toEqual(['bullet', 'p']);
  await k.press('Backspace'); // une con la viñeta anterior
  await expect.poll(() => blockTypes(page)).toEqual(['bullet']);
  await expect(editor(page).locator('[data-block="bullet"]')).toHaveText('holamundo');

  await k.press('ArrowUp');
  await k.press('Home');
  await k.press('Backspace');
  await expect.poll(() => blockTypes(page)).toEqual(['p']);
});

test('pegar Markdown crea bloques y exportar devuelve el mismo Markdown', async ({ page }) => {
  const md = [
    '## Lista de compras',
    '',
    '- pan',
    '- **leche**',
    '- [x] huevos',
    '- [ ] café',
    '',
    '> No olvidar',
    '',
    '```',
    'total = 3',
    '```',
    '',
    '---',
    '',
    'Fin con *énfasis* y [enlace](https://ejemplo.cl)',
    '',
  ].join('\n');

  await newPage(page, 'Pegado');
  await paste(page, md);
  await expect
    .poll(() => blockTypes(page))
    .toEqual(['h2', 'bullet', 'bullet', 'todo', 'todo', 'quote', 'pre', 'hr', 'p']);

  await page.getByRole('button', { name: 'Opciones de página' }).click();
  await page.getByRole('menuitem', { name: 'Ver y copiar como Markdown' }).click();
  const out = page.getByRole('textbox', { name: 'Markdown de la página' });
  await expect(out).toHaveValue(`# 📄 Pegado\n\n${md}`);

  // Volver a pegar lo exportado en otra página da los mismos bloques.
  const exported = (await out.inputValue()).replace(/^# .*\n\n/, '');
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await newPage(page, 'Copia');
  await paste(page, exported);
  await expect
    .poll(() => blockTypes(page))
    .toEqual(['h2', 'bullet', 'bullet', 'todo', 'todo', 'quote', 'pre', 'hr', 'p']);
  await expect(editor(page).locator('a')).toHaveAttribute('href', 'https://ejemplo.cl');
});

test('opciones de bloque: convertir, mover, duplicar y eliminar', async ({ page }) => {
  await newPage(page, 'Opciones');
  await page.keyboard.type('primero');
  await page.keyboard.press('Enter');
  await page.keyboard.type('segundo');

  const second = editor(page).locator('p').nth(1);
  await second.click();
  await second.hover();
  const handle = page.getByRole('button', { name: 'Opciones del bloque' });

  await handle.click();
  await page.getByRole('menuitem', { name: 'Título 2' }).click();
  await expect.poll(() => blockTypes(page)).toEqual(['p', 'h2']);

  await editor(page).locator('h2').hover();
  await editor(page).locator('h2').click();
  await handle.click();
  await page.getByRole('menuitem', { name: 'Mover arriba' }).click();
  await expect(editor(page).locator(':scope > *').first()).toHaveText('segundo');

  await editor(page).locator('h2').click();
  await editor(page).locator('h2').hover();
  await handle.click();
  await page.getByRole('menuitem', { name: 'Duplicar' }).click();
  await expect.poll(() => blockTypes(page)).toEqual(['h2', 'h2', 'p']);

  await editor(page).locator('p').click();
  await editor(page).locator('p').hover();
  await handle.click();
  await page.getByRole('menuitem', { name: 'Eliminar' }).click();
  await expect.poll(() => blockTypes(page)).toEqual(['h2', 'h2']);
});
