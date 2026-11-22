import { expect, type Page } from '@playwright/test';

/** En pantallas angostas la barra lateral es un cajón: lo abre si hace falta. */
export async function openSidebar(page: Page) {
  const menu = page.getByRole('button', { name: 'Abrir páginas' });
  if (await menu.isVisible()) {
    if ((await menu.getAttribute('aria-expanded')) !== 'true') await menu.click();
  }
  await expect(page.getByRole('navigation', { name: 'Árbol de páginas' })).toBeVisible();
}

export const tree = (page: Page) => page.getByRole('navigation', { name: 'Árbol de páginas' });
export const editor = (page: Page) => page.locator('.blocks');
export const titleBox = (page: Page) => page.getByRole('textbox', { name: 'Título de la página' });

/** Abre la app con las páginas de ejemplo ya creadas. */
export async function start(page: Page) {
  await page.goto('/');
  await expect(titleBox(page)).toHaveText('Bienvenido a Cuaderno');
}

/** Crea una página nueva con título y deja el cursor en el primer bloque. */
export async function newPage(page: Page, title: string) {
  await openSidebar(page);
  await page.getByRole('button', { name: 'Nueva página' }).click();
  await expect(titleBox(page)).toBeFocused();
  await page.keyboard.type(title);
  await page.keyboard.press('Enter');
  await expect(editor(page)).toBeFocused();
}

/** Pega texto en el editor como lo haría el portapapeles. */
export async function paste(page: Page, text: string) {
  await editor(page).evaluate((el, t) => {
    const dt = new DataTransfer();
    dt.setData('text/plain', t);
    el.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    );
  }, text);
}

/** Tipos de bloque visibles en el editor, en orden. */
export async function blockTypes(page: Page): Promise<string[]> {
  return editor(page).evaluate((el) =>
    Array.from(el.children).map((c) => {
      const e = c as HTMLElement;
      if (e.dataset.block) return e.dataset.block;
      // Bloques con vista de React: el tipo está en el elemento interior.
      const inner = e.querySelector<HTMLElement>('[data-block]');
      if (inner?.dataset.block) return inner.dataset.block;
      return e.tagName.toLowerCase();
    }),
  );
}

/** Espera a que el guardado con retraso llegue a la base local. */
export async function waitForSave(page: Page) {
  await page.waitForTimeout(600);
}

/** Abre una página por su título desde el árbol de la barra lateral. */
export async function goTo(page: Page, title: string) {
  await openSidebar(page);
  await tree(page).getByRole('button', { name: title, exact: true }).click();
  await expect(titleBox(page)).toHaveText(title);
}
