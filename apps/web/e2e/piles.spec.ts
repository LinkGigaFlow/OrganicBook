import { expect, type Locator, type Page, test } from '@playwright/test';
import { openSidebar, start, titleBox, waitForSave } from './helpers';

const board = (page: Page) => page.getByTestId('board');
const reader = (page: Page) => page.getByRole('dialog').first();
const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Agregar al cuaderno' });
const groups = (page: Page) => board(page).locator('.og');
const position = (page: Page) => reader(page).locator('.rpos');

async function newOrganic(page: Page, title: string, notes: string[]) {
  await openSidebar(page);
  await page.getByRole('button', { name: 'Nuevo cuaderno orgánico' }).click();
  await expect(titleBox(page)).toBeFocused();
  await page.keyboard.type(title);
  await page.keyboard.press('Enter');
  for (const [i, kind] of notes.entries()) {
    await toolbar(page).getByRole('button', { name: kind }).click();
    const t = reader(page).getByRole('textbox', { name: 'Título' });
    await t.fill(`Hoja ${String.fromCharCode(65 + i)}`);
    await page.getByRole('button', { name: 'Volver al cuaderno' }).click();
  }
  await expect(groups(page)).toHaveCount(notes.length);
}

const cardOf = (page: Page, title: string) =>
  board(page).getByRole('button', {
    name: new RegExp(`^(${title},|Montón de \\d+ notas: ${title})`),
  });

async function center(el: Locator) {
  const b = (await el.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** Arrastre con el mouse. `during` se llama antes de soltar. */
async function mouseDrag(
  page: Page,
  from: Locator,
  to: { x: number; y: number },
  during?: () => Promise<void>,
) {
  const a = await center(from);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await during?.();
  await page.mouse.up();
}

/** Arrastre con el dedo: mantener presionado (hold ms) y luego mover. */
async function touchDrag(
  page: Page,
  from: Locator,
  to: { x: number; y: number },
  hold = 320,
  during?: () => Promise<void>,
) {
  const a = await center(from);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
  await page.waitForTimeout(hold);
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: a.x + ((to.x - a.x) * i) / 10, y: a.y + ((to.y - a.y) * i) / 10 }],
    });
  }
  await during?.();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

const drag = (
  page: Page,
  isMobile: boolean,
  from: Locator,
  to: { x: number; y: number },
  during?: () => Promise<void>,
) => (isMobile ? touchDrag(page, from, to, 320, during) : mouseDrag(page, from, to, during));

/** Posición de una tarjeta relativa al tablero (0..1). */
async function relPos(page: Page, el: Locator) {
  const b = (await board(page).boundingBox())!;
  const c = await center(el);
  return { x: (c.x - b.x) / b.width, y: (c.y - b.y) / b.height };
}

test.beforeEach(async ({ page }) => start(page));

test('arrastre libre: la posición se guarda normalizada y se ve igual en otro ancho', async ({
  page,
  isMobile,
}) => {
  await newOrganic(page, 'Libre', ['Nota', 'Lápiz']);
  const a = cardOf(page, 'Hoja A');
  const b = (await board(page).boundingBox())!;
  const target = { x: b.x + b.width * 0.75, y: b.y + b.height * 0.8 };
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await drag(page, isMobile, a, target);
  // Arrastrar no desplaza la página.
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrollBefore)).toBeLessThan(3);
  // Soltar no abre la nota.
  await expect(page.locator('.reader')).toHaveCount(0);
  const p = await relPos(page, a);
  expect(p.x).toBeCloseTo(0.75, 1);
  expect(p.y).toBeCloseTo(0.8, 1);

  await waitForSave(page);
  await page.setViewportSize(isMobile ? { width: 700, height: 900 } : { width: 900, height: 900 });
  await page.reload();
  const again = await relPos(page, cardOf(page, 'Hoja A'));
  expect(again.x).toBeCloseTo(p.x, 1);
  expect(again.y).toBeCloseTo(p.y, 1);
});

test('apilar por cercanía con resaltado del destino; montón con hojas y contador', async ({
  page,
  isMobile,
}) => {
  await newOrganic(page, 'Montones', ['Nota', 'Lápiz', 'Voz', 'Nota']);
  const a = cardOf(page, 'Hoja A');

  // Mientras se arrastra, el destino se marca con borde punteado.
  await drag(page, isMobile, cardOf(page, 'Hoja B'), await center(a), async () => {
    await expect(board(page).locator('.og.drop')).toHaveCount(1);
    await expect(board(page).locator('.og.dragging')).toHaveCount(1);
  });
  await expect(page.locator('#toast')).toContainText('Montón de 2 notas');
  await drag(page, isMobile, cardOf(page, 'Hoja C'), await center(cardOf(page, 'Hoja A')));

  const pile = board(page).getByRole('button', { name: 'Montón de 3 notas: Hoja A' });
  await expect(pile).toBeVisible();
  await expect(pile.locator('.pcount')).toHaveText('3');
  await expect(pile.locator('.layer')).toHaveCount(2);
  await expect(groups(page)).toHaveCount(2);
  await expect(page.locator('.reader')).toHaveCount(0);

  // El montón entero se mueve.
  const b = (await board(page).boundingBox())!;
  await drag(page, isMobile, pile, { x: b.x + b.width * 0.5, y: b.y + b.height * 0.88 });
  const p = await relPos(page, pile);
  expect(p.x).toBeCloseTo(0.5, 1);
  expect(p.y).toBeCloseTo(0.88, 1);
  await expect(pile.locator('.pcount')).toHaveText('3');

  // Se guarda.
  await waitForSave(page);
  await page.reload();
  await expect(
    board(page).getByRole('button', { name: 'Montón de 3 notas: Hoja A' }),
  ).toBeVisible();
});

test('con el dedo: un deslizamiento rápido desplaza la página y no arrastra', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Necesita pantalla táctil');
  // Pantalla más baja para que la página tenga por dónde desplazarse.
  await page.setViewportSize({ width: 390, height: 560 });
  await newOrganic(page, 'Desplazar', ['Nota', 'Lápiz']);
  await page.evaluate(() => window.scrollTo(0, 0));
  const a = cardOf(page, 'Hoja A');
  const before = await relPos(page, a);
  const scroll0 = await page.evaluate(() => window.scrollY);
  // Deslizamiento hacia arriba sin esperar: es un desplazamiento de la página.
  await touchDrag(page, a, { x: (await center(a)).x, y: (await center(a)).y - 250 }, 0);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scroll0 + 50);
  await expect(board(page).locator('.og.dragging')).toHaveCount(0);
  const after = await relPos(page, a);
  // La tarjeta no se movió dentro del tablero.
  expect(after.x).toBeCloseTo(before.x, 2);
  expect(after.y).toBeCloseTo(before.y, 2);
  await expect(page.locator('.reader')).toHaveCount(0);
});

test('modo cuaderno: hojear, pasar hoja, orden y "Sacar del montón"', async ({
  page,
  isMobile,
}) => {
  await newOrganic(page, 'Cuaderno', ['Nota', 'Lápiz', 'Voz']);
  await drag(page, isMobile, cardOf(page, 'Hoja B'), await center(cardOf(page, 'Hoja A')));
  await drag(page, isMobile, cardOf(page, 'Hoja C'), await center(cardOf(page, 'Hoja A')));
  await board(page).getByRole('button', { name: 'Montón de 3 notas: Hoja A' }).click();

  // Solo las hojas del montón, en papel de cuaderno con letra manuscrita.
  await expect(position(page)).toHaveText('Hoja 1 de 3');
  await expect(page.locator('.rcard')).toHaveClass(/\bnb\b/);
  await expect(page.locator('.rcard .rbody')).toHaveCSS('background-color', 'rgb(255, 253, 246)');
  await expect(reader(page).getByRole('tab')).toHaveCount(3);

  // Pasar hoja: una hoja gira mostrando el título de la anterior.
  await reader(page).getByRole('button', { name: 'Siguiente' }).click();
  await expect(position(page)).toHaveText('Hoja 2 de 3');
  await expect(page.locator('.leaf.fwd')).toHaveText('Hoja A');
  await expect(page.locator('.leaf')).toHaveCount(0, { timeout: 2000 });
  await reader(page).getByRole('button', { name: 'Siguiente' }).click();
  await reader(page).getByRole('button', { name: 'Siguiente' }).click();
  await expect(position(page)).toHaveText('Hoja 1 de 3'); // cíclico dentro del montón

  // Orden dentro del montón.
  await reader(page).getByRole('button', { name: 'Mover después' }).click();
  await expect(position(page)).toHaveText('Hoja 2 de 3');
  await expect(reader(page).getByRole('textbox', { name: 'Título' })).toHaveValue('Hoja A');

  // Sacar del montón: la nota queda suelta al lado.
  await reader(page).getByRole('button', { name: 'Sacar del montón' }).click();
  await expect(position(page)).toHaveText(/de 2$/);
  await expect(groups(page)).toHaveCount(2);
  // Con una sola hoja, el lector se cierra.
  await reader(page).getByRole('button', { name: 'Sacar del montón' }).click();
  await expect(page.locator('.reader')).toHaveCount(0);
  await expect(groups(page)).toHaveCount(3);
  await expect(board(page).locator('.og.pile')).toHaveCount(0);
});

test('sin animación si el sistema pide movimiento reducido', async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await newOrganic(page, 'Quieto', ['Nota', 'Lápiz']);
  await drag(page, isMobile, cardOf(page, 'Hoja B'), await center(cardOf(page, 'Hoja A')));
  await board(page)
    .getByRole('button', { name: /Montón de 2 notas/ })
    .click();
  await reader(page).getByRole('button', { name: 'Siguiente' }).click();
  await expect(position(page)).toHaveText('Hoja 2 de 2');
  await expect(page.locator('.leaf')).toHaveCount(0);
});

test('reacomodar en círculo reparte los montones y las notas', async ({ page, isMobile }) => {
  await newOrganic(page, 'Círculo', ['Nota', 'Lápiz', 'Voz']);
  const b = (await board(page).boundingBox())!;
  // Junta dos notas en una esquina (sin apilarlas).
  await drag(page, isMobile, cardOf(page, 'Hoja A'), {
    x: b.x + b.width * 0.15,
    y: b.y + b.height * 0.85,
  });
  await board(page).getByRole('button', { name: 'Añadir nota' }).click();
  await page.getByRole('menuitem', { name: 'Reacomodar en círculo' }).click();
  const ps = await Promise.all(
    ['Hoja A', 'Hoja B', 'Hoja C'].map((t) => relPos(page, cardOf(page, t))),
  );
  for (const p of ps) expect(Math.hypot(p.x - 0.5, p.y - 0.5)).toBeGreaterThan(0.25);
  for (let i = 0; i < ps.length; i++)
    for (let j = i + 1; j < ps.length; j++)
      expect(Math.hypot(ps[i]!.x - ps[j]!.x, ps[i]!.y - ps[j]!.y)).toBeGreaterThan(0.2);
});
