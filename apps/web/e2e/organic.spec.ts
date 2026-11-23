import { expect, type Locator, type Page, test } from '@playwright/test';
import { openSidebar, start, titleBox, waitForSave } from './helpers';

/** PNG generado en el navegador (sin archivos de prueba en el repositorio). */
async function makePng(page: Page, color: string): Promise<Buffer> {
  const bytes = await page.evaluate(async (c) => {
    const cv = document.createElement('canvas');
    cv.width = 800;
    cv.height = 500;
    const x = cv.getContext('2d')!;
    x.fillStyle = c;
    x.fillRect(0, 0, 800, 500);
    x.fillStyle = '#fff';
    x.fillRect(100, 100, 200, 120);
    const blob = await new Promise<Blob>((r) => cv.toBlob((b) => r(b!), 'image/png'));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  }, color);
  return Buffer.from(bytes);
}

/** WAV de 1,5 s (tono de 440 Hz) para la nota de voz. */
function makeWav(seconds = 1.5, rate = 8000): Buffer {
  const n = Math.round(seconds * rate);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++)
    buf.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * 440 * i) / rate)), 44 + i * 2);
  return buf;
}

/** Elige un archivo en el campo que abre `trigger` (con el selector de Chrome si aparece). */
async function choose(
  page: Page,
  trigger: () => Promise<void>,
  file: Parameters<Locator['setInputFiles']>[0],
  fallback: Locator,
) {
  const chooser = page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null);
  await trigger();
  const fc = await chooser;
  if (fc) await fc.setFiles(file as never);
  else await fallback.setInputFiles(file);
}

const board = (page: Page) => page.getByTestId('board');
const reader = (page: Page) => page.getByRole('dialog').first();
const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Agregar al cuaderno' });
const card = (page: Page, name: string | RegExp) => board(page).getByRole('button', { name });
const position = (page: Page) => reader(page).locator('.rpos');

async function closeReader(page: Page) {
  await page.getByRole('button', { name: 'Volver al cuaderno' }).click();
  await expect(page.locator('.reader')).toHaveCount(0);
}

/** Deslizamiento horizontal con el dedo (eventos táctiles reales de Chrome). */
async function swipe(page: Page, el: Locator, dx: number) {
  const b = (await el.boundingBox())!;
  const y = b.y + Math.min(b.height / 2, 200);
  const x0 = b.x + b.width / 2 - dx / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
  for (let i = 1; i <= 8; i++)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x0 + (dx * i) / 8, y }],
    });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

async function newOrganic(page: Page, title: string) {
  await openSidebar(page);
  await page.getByRole('button', { name: 'Nuevo cuaderno orgánico' }).click();
  await expect(titleBox(page)).toBeFocused();
  await page.keyboard.type(title);
  await page.keyboard.press('Enter');
  await expect(board(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => start(page));

test('crear una nota de cada tipo, con vistas previas y líneas al centro', async ({
  page,
  isMobile,
}) => {
  await newOrganic(page, 'Viaje al sur');

  // Centro: texto + imagen de fondo de la hoja.
  await board(page).getByRole('button', { name: 'Tema central' }).click();
  await expect(position(page)).toHaveText('Centro');
  await reader(page).getByRole('textbox', { name: 'Tema central' }).click();
  await page.keyboard.type('Patagonia');
  const bg = await makePng(page, '#0c8599');
  await choose(
    page,
    () => reader(page).getByRole('button', { name: 'Elegir imagen' }).click(),
    { name: 'fondo.png', mimeType: 'image/png', buffer: bg },
    page.getByLabel('Elegir imagen', { exact: true }),
  );
  // La imagen de fondo se ve en el editor…
  await expect(reader(page).locator('.oedit')).toHaveCSS('background-image', /url\("blob:/);
  await expect(reader(page).getByRole('radio', { name: 'Solo la hoja' })).toBeChecked();
  await closeReader(page);
  // …y en el tablero.
  const center = board(page).getByRole('button', { name: 'Tema central' });
  await expect(center).toContainText('Patagonia');
  await expect(center).toHaveCSS('background-image', /url\("blob:/);

  // Nota Markdown: el mismo editor de bloques (atajos incluidos).
  await toolbar(page).getByRole('button', { name: 'Nota' }).click();
  await expect(reader(page).locator('.blocks')).toBeFocused();
  await page.keyboard.type('- ');
  await page.keyboard.type('Torres del Paine');
  await expect(reader(page).locator('.blocks [data-block="bullet"]')).toHaveText(
    'Torres del Paine',
  );
  await closeReader(page);

  // Nota LaTeX: abre el editor de la ecuación.
  await toolbar(page).getByRole('button', { name: 'LaTeX' }).click();
  await expect(
    reader(page).getByRole('textbox', { name: 'Código LaTeX', exact: true }),
  ).toBeFocused();
  await page.keyboard.type('\\frac{1}{3}');
  await closeReader(page);

  // Nota a lápiz: un trazo.
  await toolbar(page).getByRole('button', { name: 'Lápiz' }).click();
  const canvas = reader(page).locator('.pad canvas');
  const b = (await canvas.boundingBox())!;
  if (isMobile) {
    const cdp = await page.context().newCDPSession(page);
    const pt = (t: number) => ({ x: b.x + 40 + t * 200, y: b.y + 40 + t * 60 });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(0)] });
    for (let i = 1; i <= 10; i++)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pt(i / 10)] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  } else {
    await page.mouse.move(b.x + 40, b.y + 40);
    await page.mouse.down();
    await page.mouse.move(b.x + 260, b.y + 100, { steps: 10 });
    await page.mouse.up();
  }
  await expect(canvas).toHaveAttribute('data-strokes', '1');
  await closeReader(page);

  // Nota de voz: subir un audio y escribir la transcripción.
  await toolbar(page).getByRole('button', { name: 'Voz' }).click();
  await reader(page)
    .getByLabel('Archivo de audio')
    .setInputFiles({ name: 'ferry.wav', mimeType: 'audio/wav', buffer: makeWav() });
  await expect(reader(page).getByLabel('Audio de la nota')).toBeVisible();
  await reader(page).getByRole('textbox', { name: 'Transcripción' }).fill('Viento en el ferry');
  await closeReader(page);

  // Nota de imagen.
  const photo = await makePng(page, '#2b8a3e');
  await choose(
    page,
    () => toolbar(page).getByRole('button', { name: 'Imagen' }).click(),
    { name: 'laguna.png', mimeType: 'image/png', buffer: photo },
    page.getByLabel('Elegir imagen', { exact: true }),
  );
  await expect(reader(page).locator('.rimg img')).toBeVisible();
  await reader(page).getByRole('textbox', { name: 'Descripción de la imagen' }).click();
  await page.keyboard.type('Laguna');
  await closeReader(page);

  // Tablero: 5 tarjetas con su vista previa y una línea por tarjeta.
  await expect(board(page).locator('.onote')).toHaveCount(5);
  await expect(card(page, 'Nota, nota 1')).toContainText('Torres del Paine');
  await expect(card(page, 'Fórmula, nota 2').locator('.katex')).toBeVisible();
  await expect(card(page, 'Nota a lápiz, nota 3').locator('canvas')).toHaveAttribute(
    'aria-label',
    'Dibujo con 1 trazo',
  );
  await expect(card(page, 'Nota de voz, nota 4')).toContainText('0:01');
  await expect(card(page, 'Nota de voz, nota 4')).toContainText('Viento en el ferry');
  await expect(card(page, 'Imagen, nota 5').locator('img')).toBeVisible();
  await expect(board(page).locator('.links path')).toHaveCount(5);

  // Todo sobrevive a una recarga, sin imágenes ni audio en base64.
  await waitForSave(page);
  await page.reload();
  await expect(board(page).locator('.onote')).toHaveCount(5);
  await expect(board(page).getByRole('button', { name: 'Tema central' })).toHaveCSS(
    'background-image',
    /url\("blob:/,
  );
  const json = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res) => {
      const r = indexedDB.open('cuaderno');
      r.onsuccess = () => res(r.result);
    });
    const all = await new Promise<unknown[]>((res) => {
      const r = db.transaction('pages').objectStore('pages').getAll();
      r.onsuccess = () => res(r.result);
    });
    db.close();
    return JSON.stringify(all.find((p) => (p as { title: string }).title === 'Viaje al sur'));
  });
  expect(json).toContain('"kind":"organic"');
  expect(json).not.toMatch(/base64|data:image|data:audio/);
});

test.describe('lector', () => {
  test.beforeEach(async ({ page }) => {
    await newOrganic(page, 'Lector');
    for (const kind of ['Nota', 'Lápiz', 'Voz']) {
      await toolbar(page).getByRole('button', { name: kind }).click();
      await closeReader(page);
    }
  });

  test('navegación cíclica con botones, puntos y teclado', async ({ page, isMobile }) => {
    await board(page).getByRole('button', { name: 'Tema central' }).click();
    await expect(position(page)).toHaveText('Centro');
    const next = reader(page).getByRole('button', { name: 'Siguiente' });
    const prev = reader(page).getByRole('button', { name: 'Anterior' });
    await next.click();
    await expect(position(page)).toHaveText('1 de 3');
    await next.click();
    await next.click();
    await expect(position(page)).toHaveText('3 de 3');
    await next.click();
    await expect(position(page)).toHaveText('Centro');
    await prev.click();
    await expect(position(page)).toHaveText('3 de 3');
    await reader(page).getByRole('tab', { name: 'Nota 2' }).click();
    await expect(position(page)).toHaveText('2 de 3');

    if (!isMobile) {
      await page.keyboard.press('ArrowRight');
      await expect(position(page)).toHaveText('3 de 3');
      await page.keyboard.press('ArrowRight');
      await expect(position(page)).toHaveText('Centro');
      await page.keyboard.press('ArrowLeft');
      await expect(position(page)).toHaveText('3 de 3');
      // Mientras se escribe, las flechas no cambian de nota.
      await reader(page).getByRole('textbox', { name: 'Transcripción' }).click();
      await page.keyboard.press('ArrowLeft');
      await expect(position(page)).toHaveText('3 de 3');
      await reader(page).getByRole('button', { name: 'Grabar' }).focus();
      await page.keyboard.press('Escape');
      await expect(page.locator('.reader')).toHaveCount(0);
    }
  });

  test('deslizar con el dedo recorre las notas', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Necesita pantalla táctil');
    await card(page, 'Nota, nota 1').click();
    await expect(position(page)).toHaveText('1 de 3');
    const body = page.getByTestId('reader-body');
    await swipe(page, body, -160);
    await expect(position(page)).toHaveText('2 de 3');
    // La nota 2 es un dibujo: se desliza sobre su barra de colores.
    await swipe(page, reader(page).locator('.rtools'), -160);
    await expect(position(page)).toHaveText('3 de 3');
    await swipe(page, body, -160);
    await expect(position(page)).toHaveText('Centro');
    await swipe(page, body, 160);
    await expect(position(page)).toHaveText('3 de 3');
    // Un movimiento corto no cambia de nota.
    await swipe(page, body, -40);
    await expect(position(page)).toHaveText('3 de 3');
    // Sobre el lienzo, el dedo dibuja (no pasa de nota); sobre la barra de la nota, sí.
    await reader(page).getByRole('tab', { name: 'Nota 2' }).click();
    await swipe(page, reader(page).locator('.pad'), -160);
    await expect(position(page)).toHaveText('2 de 3');
    await expect(reader(page).locator('.pad canvas')).toHaveAttribute('data-strokes', '1');
    await swipe(page, reader(page).locator('.rtools'), -160);
    await expect(position(page)).toHaveText('3 de 3');
  });

  test('título, color, orden y eliminar con confirmación', async ({ page }) => {
    await card(page, 'Nota a lápiz, nota 2').click();
    const title = reader(page).getByRole('textbox', { name: 'Título' });
    await title.fill('Mapa');
    await reader(page).getByRole('button', { name: 'Color menta' }).click();
    await expect(reader(page).getByRole('button', { name: 'Color menta' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // Mover antes: pasa a ser la nota 1.
    await reader(page).getByRole('button', { name: 'Mover antes' }).click();
    await expect(position(page)).toHaveText('1 de 3');
    await expect(reader(page).getByRole('button', { name: 'Mover antes' })).toBeDisabled();
    await reader(page).getByRole('button', { name: 'Mover después' }).click();
    await reader(page).getByRole('button', { name: 'Mover después' }).click();
    await expect(position(page)).toHaveText('3 de 3');
    await closeReader(page);
    await expect(card(page, 'Mapa, nota 3').locator('.onote')).toHaveCSS(
      'background-color',
      'rgb(163, 240, 214)',
    );

    // Eliminar: primero cancelar, luego confirmar.
    await card(page, 'Mapa, nota 3').click();
    await reader(page).getByRole('button', { name: 'Eliminar nota' }).click();
    const dialog = page.getByRole('dialog', { name: '¿Eliminar «Mapa»?' });
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(board(page).locator('.onote')).toHaveCount(3);
    await reader(page).getByRole('button', { name: 'Eliminar nota' }).click();
    await page
      .getByRole('dialog', { name: '¿Eliminar «Mapa»?' })
      .getByRole('button', { name: 'Eliminar' })
      .click();
    await expect(position(page)).toHaveText('2 de 2');
    await closeReader(page);
    await expect(board(page).locator('.onote')).toHaveCount(2);

    await waitForSave(page);
    await page.reload();
    await expect(board(page).locator('.onote')).toHaveCount(2);
    await expect(card(page, /Mapa/)).toHaveCount(0);
  });
});

test('arrastrar una imagen sobre el tablero crea una nota de imagen', async ({ page }) => {
  await newOrganic(page, 'Soltar');
  const png = (await makePng(page, '#e8590c')).toString('base64');
  await board(page).evaluate(async (el, data) => {
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'x.png', { type: 'image/png' }));
    el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, png);
  await expect(reader(page).locator('.rimg img')).toBeVisible();
  await closeReader(page);
  await expect(card(page, 'Imagen, nota 1').locator('img')).toBeVisible();
});
