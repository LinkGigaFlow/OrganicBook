import { expect, type Page, test } from '@playwright/test';
import { editor, newPage, start, waitForSave } from './helpers';

/**
 * Reconocedor de voz simulado (el de Chrome necesita micrófono y servidores de Google).
 * La prueba "habla" con window.__sr.say(texto, final) y puede provocar errores.
 */
function fakeSpeech(page: Page, opts: { supported: boolean }) {
  return page.addInitScript((supported) => {
    type Handler = ((e: unknown) => void) | null;
    const w = window as unknown as Record<string, unknown>;
    delete w.SpeechRecognition;
    delete w.webkitSpeechRecognition;
    if (!supported) return;
    const all: FakeSR[] = [];
    class FakeSR {
      lang = '';
      continuous = false;
      interimResults = false;
      onresult: Handler = null;
      onerror: Handler = null;
      onend: (() => void) | null = null;
      running = false;
      constructor() {
        all.push(this);
      }
      start() {
        this.running = true;
      }
      stop() {
        if (!this.running) return;
        this.running = false;
        setTimeout(() => this.onend?.(), 0);
      }
      abort() {
        this.stop();
      }
    }
    const current = () => all.filter((r) => r.running).pop();
    w.webkitSpeechRecognition = FakeSR;
    w.__sr = {
      count: () => all.length,
      lang: () => current()?.lang ?? null,
      running: () => !!current(),
      say: (transcript: string, isFinal: boolean) =>
        current()?.onresult?.({
          resultIndex: 0,
          results: [{ isFinal, length: 1, 0: { transcript } }],
        }),
      fail: (error: string) => {
        const r = current();
        if (!r) return;
        r.onerror?.({ error });
        r.running = false;
        r.onend?.();
      },
    };
  }, opts.supported);
}

const say = (page: Page, text: string, final: boolean) =>
  page.evaluate(
    ([t, f]) =>
      (window as unknown as { __sr: { say: (t: string, f: boolean) => void } }).__sr.say(
        t as string,
        f as boolean,
      ),
    [text, final] as const,
  );
const srCall = <T>(page: Page, fn: 'lang' | 'running' | 'count') =>
  page.evaluate(
    (f) => (window as unknown as { __sr: Record<string, () => T> }).__sr[f]!(),
    fn,
  ) as Promise<T>;

const mic = (page: Page) => page.locator('#micBtn');
const bubble = (page: Page) => page.getByRole('status', { name: 'Dictado por voz' });

test.describe('dictado por voz', () => {
  test.beforeEach(async ({ page }) => {
    await fakeSpeech(page, { supported: true });
    await start(page);
  });

  test('texto provisional en la burbuja y texto final en el bloque activo', async ({ page }) => {
    await newPage(page, 'Dictado');
    await page.keyboard.type('Primera idea.');
    await expect(mic(page)).toHaveAccessibleName('Dictar por voz');
    await mic(page).click();
    await expect(bubble(page)).toBeVisible();
    await expect(bubble(page)).toContainText('Escuchando…');
    await expect(mic(page)).toHaveAttribute('aria-pressed', 'true');
    // El foco sigue en el editor (no se mueve el cursor).
    await expect(editor(page)).toBeFocused();

    await say(page, 'segunda id', false);
    await expect(bubble(page)).toContainText('segunda id');
    await expect(editor(page)).toHaveText('Primera idea.');

    await say(page, 'segunda idea con voz', true);
    await expect(editor(page)).toHaveText('Primera idea. Segunda idea con voz');
    await expect(bubble(page)).toContainText('Escuchando…');

    // Se puede seguir escribiendo a mano después de lo dictado.
    await page.keyboard.type('!');
    await say(page, 'y algo más', true);
    await expect(editor(page)).toHaveText('Primera idea. Segunda idea con voz! Y algo más');

    await bubble(page).getByRole('button', { name: 'Detener' }).click();
    await expect(bubble(page)).toHaveCount(0);
    await expect(mic(page)).toHaveAttribute('aria-pressed', 'false');
    expect(await srCall<boolean>(page, 'running')).toBe(false);

    await waitForSave(page);
    await page.reload();
    await expect(editor(page)).toHaveText('Primera idea. Segunda idea con voz! Y algo más');
  });

  test('el idioma se elige en la burbuja, reinicia la escucha y se recuerda', async ({ page }) => {
    await newPage(page, 'Idioma');
    await mic(page).click();
    expect(await srCall<string>(page, 'lang')).toBe('es-CL');
    await bubble(page).getByRole('combobox', { name: 'Idioma del dictado' }).selectOption('en-US');
    await expect.poll(() => srCall<string>(page, 'lang')).toBe('en-US');
    await say(page, 'hello there', true);
    await expect(editor(page)).toContainText('Hello there');
    await mic(page).click();
    await expect(bubble(page)).toHaveCount(0);

    await page.reload();
    await mic(page).click();
    expect(await srCall<string>(page, 'lang')).toBe('en-US');
  });

  test('menú /: «Dictado por voz» escribe en ese bloque', async ({ page }) => {
    await newPage(page, 'Desde el menú');
    await page.keyboard.type('Arriba');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/');
    await page.keyboard.type('voz');
    await page.getByRole('menuitem', { name: /Dictado por voz/ }).click();
    await expect(bubble(page)).toBeVisible();
    await say(page, 'dictado en el segundo bloque', true);
    await expect(editor(page).locator('p').nth(1)).toHaveText('Dictado en el segundo bloque');
    await expect(editor(page).locator('p').first()).toHaveText('Arriba');
  });

  test('sin tocar el editor, lo dictado va al final de la página', async ({ page }) => {
    // Página de ejemplo, sin hacer clic en el texto.
    await mic(page).click();
    await say(page, 'nota al final', true);
    await expect(editor(page).locator('p').last()).toHaveText('Nota al final');
  });

  test('micrófono bloqueado: aviso claro y la burbuja se cierra', async ({ page }) => {
    await newPage(page, 'Bloqueado');
    await mic(page).click();
    await page.evaluate(() =>
      (window as unknown as { __sr: { fail: (e: string) => void } }).__sr.fail('not-allowed'),
    );
    await expect(page.locator('#toast')).toContainText('El micrófono está bloqueado');
    await expect(bubble(page)).toHaveCount(0);
    await expect(mic(page)).toHaveAttribute('aria-pressed', 'false');
    // Nada se rompió: se sigue escribiendo.
    await editor(page).click();
    await page.keyboard.type('sigue funcionando');
    await expect(editor(page)).toContainText('sigue funcionando');
  });
});

test('sin soporte de dictado aparece un aviso y nada se rompe', async ({ page }) => {
  await fakeSpeech(page, { supported: false });
  await start(page);
  await newPage(page, 'Sin soporte');
  await page.keyboard.type('Hola');
  await mic(page).click();
  await expect(page.locator('#toast')).toContainText('Este navegador no trae dictado por voz');
  await expect(bubble(page)).toHaveCount(0);
  await expect(mic(page)).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.type(' mundo');
  await expect(editor(page)).toHaveText('Hola mundo');
});
