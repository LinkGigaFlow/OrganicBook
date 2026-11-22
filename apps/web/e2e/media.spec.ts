import { expect, type Locator, type Page, test } from '@playwright/test';
import { blockTypes, editor, newPage, paste, start, waitForSave } from './helpers';

test.beforeEach(async ({ page }) => start(page));

/** Imagen PNG generada en el navegador (sin archivos de prueba en el repositorio). */
async function makePng(page: Page, w: number, h: number): Promise<Buffer> {
  const bytes = await page.evaluate(
    async ([w, h]) => {
      const c = document.createElement('canvas');
      c.width = w!;
      c.height = h!;
      const x = c.getContext('2d')!;
      x.fillStyle = '#3b5bdb';
      x.fillRect(0, 0, w!, h!);
      x.fillStyle = '#f08c00';
      x.fillRect(w! / 4, h! / 4, w! / 2, h! / 2);
      const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'));
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    },
    [w, h],
  );
  return Buffer.from(bytes);
}

/** Documento guardado de la página actual, leído directo de IndexedDB. */
async function storedPage(page: Page, title: string) {
  return page.evaluate(async (t) => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open('cuaderno');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const all = await new Promise<{ title: string; blocks: { type: string }[] }[]>((res) => {
      const r = db.transaction('pages').objectStore('pages').getAll();
      r.onsuccess = () => res(r.result as never);
    });
    const files = await new Promise<number>((res) => {
      const r = db.transaction('files').objectStore('files').count();
      r.onsuccess = () => res(r.result);
    });
    db.close();
    return { page: all.find((p) => p.title === t), files };
  }, title);
}

async function slash(page: Page, query: string) {
  await page.keyboard.type('/');
  await page.keyboard.type(query);
  await expect(page.getByRole('menu', { name: 'Bloques' })).toBeVisible();
}

const canvas = (page: Page) => page.locator('.pad canvas').first();
const strokeCount = async (c: Locator) => Number(await c.getAttribute('data-strokes'));

/** Trazo con el mouse dentro del lienzo, en fracciones de su tamaño. */
async function mouseStroke(page: Page, c: Locator, from: [number, number], to: [number, number]) {
  const b = (await c.boundingBox())!;
  await page.mouse.move(b.x + b.width * from[0], b.y + b.height * from[1]);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * to[0], b.y + b.height * to[1], { steps: 12 });
  await page.mouse.up();
}

/** Trazo con el dedo o el lápiz por el protocolo de Chrome (eventos reales del navegador). */
async function deviceStroke(
  page: Page,
  c: Locator,
  kind: 'touch' | 'pen',
  from: [number, number],
  to: [number, number],
) {
  const b = (await c.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const at = (t: number) => ({
    x: b.x + b.width * (from[0] + (to[0] - from[0]) * t),
    y: b.y + b.height * (from[1] + (to[1] - from[1]) * t),
  });
  const steps = 10;
  if (kind === 'touch') {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(0)] });
    for (let i = 1; i <= steps; i++)
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [at(i / steps)],
      });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    const ev = (type: string, p: { x: number; y: number }, force: number) =>
      cdp.send('Input.dispatchMouseEvent', {
        type: type as 'mousePressed',
        ...p,
        button: 'left',
        buttons: type === 'mouseReleased' ? 0 : 1,
        clickCount: 1,
        pointerType: 'pen',
        force,
      });
    await ev('mousePressed', at(0), 0.3);
    for (let i = 1; i <= steps; i++) await ev('mouseMoved', at(i / steps), 0.3 + i * 0.06);
    await ev('mouseReleased', at(1), 0);
  }
  await cdp.detach();
}

/** Caja de los píxeles pintados, relativa al tamaño del lienzo (0..1). */
async function inkBox(c: Locator) {
  return c.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d')!;
    const { width: w, height: h } = el;
    const d = ctx.getImageData(0, 0, w, h).data;
    let x0 = w,
      y0 = h,
      x1 = 0,
      y1 = 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (d[(y * w + x) * 4 + 3]! > 40) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
    return { x0: x0 / w, y0: y0 / h, x1: x1 / w, y1: y1 / h };
  });
}

test.describe('dibujo', () => {
  test('dibujar, deshacer, borrar por trazo y más espacio; sobrevive a la recarga', async ({
    page,
    isMobile,
  }) => {
    await newPage(page, 'Boceto');
    await slash(page, 'dibujo');
    await page.keyboard.press('Enter');
    const c = canvas(page);
    await expect(c).toBeVisible();
    await expect(c).toHaveAttribute('data-strokes', '0');

    const stroke = (from: [number, number], to: [number, number]) =>
      isMobile ? deviceStroke(page, c, 'touch', from, to) : mouseStroke(page, c, from, to);

    await stroke([0.1, 0.2], [0.6, 0.3]);
    await expect(c).toHaveAttribute('data-strokes', '1');
    await page.getByRole('button', { name: 'Resaltador' }).click();
    await page.getByRole('button', { name: 'Color rojo' }).click();
    await stroke([0.1, 0.7], [0.8, 0.7]);
    await expect(c).toHaveAttribute('data-strokes', '2');

    // Deshacer quita el último trazo.
    await page.getByRole('button', { name: 'Deshacer' }).click();
    await expect(c).toHaveAttribute('data-strokes', '1');

    // El borrador quita el trazo completo que toca.
    await stroke([0.2, 0.7], [0.7, 0.7]);
    await expect(c).toHaveAttribute('data-strokes', '2');
    await page.getByRole('button', { name: 'Borrador' }).click();
    await stroke([0.45, 0.6], [0.45, 0.8]);
    await expect(c).toHaveAttribute('data-strokes', '1');

    // Más espacio agranda el lienzo sin cambiar la escala.
    const before = (await c.boundingBox())!;
    await page.getByRole('button', { name: 'Más espacio' }).click();
    await expect
      .poll(async () => (await c.boundingBox())!.height)
      .toBeCloseTo(before.height + (260 * before.width) / 1000, 0);

    await waitForSave(page);
    const saved = await storedPage(page, 'Boceto');
    const draw = saved.page?.blocks.find((b) => b.type === 'draw') as unknown as {
      h: number;
      strokes: { t: string; pts: number[][] }[];
    };
    expect(draw.h).toBe(740);
    expect(draw.strokes).toHaveLength(1);
    expect(draw.strokes[0]!.t).toBe('pen');
    // Coordenadas lógicas: ancho 1000 sin importar la pantalla.
    const xs = draw.strokes[0]!.pts.map((p) => p[0]!);
    expect(Math.min(...xs)).toBeGreaterThan(80);
    expect(Math.max(...xs)).toBeLessThan(620);

    await page.reload();
    await expect(canvas(page)).toHaveAttribute('data-strokes', '1');
  });

  test('los trazos se ven igual al cambiar el ancho de la ventana', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Se cambia el ancho de la ventana de escritorio');
    await newPage(page, 'Escala');
    await slash(page, 'dibujo');
    await page.keyboard.press('Enter');
    const c = canvas(page);
    await mouseStroke(page, c, [0.2, 0.3], [0.7, 0.6]);
    await expect(c).toHaveAttribute('data-strokes', '1');
    const wide = await inkBox(c);
    const wideBox = (await c.boundingBox())!;

    await page.setViewportSize({ width: 480, height: 900 });
    await expect.poll(async () => (await c.boundingBox())!.width).toBeLessThan(wideBox.width - 50);
    const narrow = await inkBox(c);
    const narrowBox = (await c.boundingBox())!;

    expect(narrowBox.width / narrowBox.height).toBeCloseTo(wideBox.width / wideBox.height, 1);
    for (const k of ['x0', 'y0', 'x1', 'y1'] as const) expect(narrow[k]).toBeCloseTo(wide[k], 1);
  });

  test('"Solo el lápiz dibuja": el dedo no raya y el lápiz sí', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Necesita pantalla táctil');
    await newPage(page, 'Lápiz');
    await slash(page, 'dibujo');
    await page.keyboard.press('Enter');
    const c = canvas(page);
    const toggle = page.getByRole('button', { name: 'Solo el lápiz dibuja' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await deviceStroke(page, c, 'touch', [0.1, 0.3], [0.8, 0.4]);
    await page.waitForTimeout(200);
    expect(await strokeCount(c)).toBe(0);

    await deviceStroke(page, c, 'pen', [0.1, 0.5], [0.8, 0.6]);
    await expect(c).toHaveAttribute('data-strokes', '1');
    await waitForSave(page);
    const saved = await storedPage(page, 'Lápiz');
    const draw = saved.page?.blocks.find((b) => b.type === 'draw') as unknown as {
      strokes: { pts: number[][] }[];
    };
    // El lápiz guarda la presión real.
    const ps = draw.strokes[0]!.pts.map((p) => p[2]!);
    expect(Math.max(...ps)).toBeGreaterThan(Math.min(...ps));

    // La opción se recuerda.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Solo el lápiz dibuja' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

test.describe('imágenes', () => {
  test('subir: se reduce a 1600 px, se guarda como archivo y sobrevive a la recarga', async ({
    page,
  }) => {
    await newPage(page, 'Fotos');
    const png = await makePng(page, 2400, 1800);
    await slash(page, 'imagen');
    const file = { name: 'grande.png', mimeType: 'image/png', buffer: png };
    const chooser = page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null);
    await page.keyboard.press('Enter');
    // Con la máquina muy cargada Chrome a veces no avisa del selector; se usa el mismo campo.
    const fc = await chooser;
    if (fc) await fc.setFiles(file);
    else await page.getByLabel('Subir imagen').setInputFiles(file);

    const img = page.locator('.blocks .img img');
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(1600);
    expect(await img.evaluate((i: HTMLImageElement) => i.naturalHeight)).toBe(1200);
    expect(await blockTypes(page)).toEqual(['img', 'p']);

    // Pie de imagen y tamaño.
    const cap = page.getByRole('textbox', { name: 'Pie de imagen' });
    await cap.click();
    await page.keyboard.type('Vista al mar');
    await page.keyboard.press('Enter');
    await expect(editor(page)).toBeFocused();
    await page.keyboard.type('Debajo');
    await page.locator('.blocks .img').hover();
    await page.locator('.blocks .img').click({ position: { x: 20, y: 20 } });
    await page.getByRole('button', { name: 'Opciones del bloque' }).click();
    await page.getByRole('menuitemradio', { name: 'Pequeña' }).click();
    await expect(page.locator('.blocks .img')).toHaveClass(/sz-s/);
    expect((await img.boundingBox())!.width).toBeLessThanOrEqual(261);

    await waitForSave(page);
    const saved = await storedPage(page, 'Fotos');
    const json = JSON.stringify(saved.page);
    expect(json).not.toContain('data:image');
    expect(json).not.toContain('base64');
    expect(saved.page?.blocks[0]).toMatchObject({ type: 'img', cap: 'Vista al mar', size: 's' });
    expect(saved.files).toBeGreaterThanOrEqual(1);

    await page.reload();
    const again = page.locator('.blocks .img img');
    await expect.poll(() => again.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(1600);
    await expect(page.getByRole('textbox', { name: 'Pie de imagen' })).toHaveText('Vista al mar');
    await expect(page.locator('.blocks .img')).toHaveClass(/sz-s/);
  });

  test('pegar y arrastrar imágenes crea bloques de imagen', async ({ page }) => {
    await newPage(page, 'Pegadas');
    await page.keyboard.type('Arriba');
    const png = await makePng(page, 300, 200);
    const b64 = png.toString('base64');

    // Pegar una imagen del portapapeles.
    await editor(page).evaluate(async (el, data) => {
      const bytes = Uint8Array.from(atob(data), (ch) => ch.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], 'pegada.png', { type: 'image/png' }));
      el.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
      );
    }, b64);
    await expect(page.locator('.blocks .img img')).toHaveCount(1);
    expect(await blockTypes(page)).toEqual(['p', 'img', 'p']);

    // Soltar una imagen sobre el primer párrafo: queda justo debajo de él.
    await editor(page)
      .locator('p')
      .first()
      .evaluate(async (el, data) => {
        const bytes = Uint8Array.from(atob(data), (ch) => ch.charCodeAt(0));
        const dt = new DataTransfer();
        dt.items.add(new File([bytes], 'soltada.png', { type: 'image/png' }));
        const r = el.getBoundingClientRect();
        el.dispatchEvent(
          new DragEvent('drop', {
            dataTransfer: dt,
            bubbles: true,
            cancelable: true,
            clientX: r.left + 10,
            clientY: r.top + r.height / 2,
          }),
        );
      }, b64);
    await expect(page.locator('.blocks .img img')).toHaveCount(2);
    expect(await blockTypes(page)).toEqual(['p', 'img', 'p', 'img', 'p']);

    // Pegar texto sigue funcionando como antes.
    await editor(page).locator('p').last().click();
    await paste(page, '- uno\n- dos');
    await expect(page.locator('.blocks [data-block="bullet"]')).toHaveCount(2);
  });
});
