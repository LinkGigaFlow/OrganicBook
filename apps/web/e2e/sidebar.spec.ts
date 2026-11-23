import { expect, test } from '@playwright/test';
import { editor, goTo, newPage, openSidebar, start, titleBox, tree, waitForSave } from './helpers';

test.beforeEach(async ({ page }) => {
  await start(page);
});

test('subpáginas en el árbol, migas de pan, título e icono', async ({ page }) => {
  await newPage(page, 'Viajes');
  await page.keyboard.type('Plan general');

  // Subpágina desde el botón + de la fila.
  await openSidebar(page);
  await tree(page).getByRole('button', { name: 'Nueva subpágina en Viajes' }).click();
  await expect(titleBox(page)).toBeFocused();
  await page.keyboard.type('Chiloé');

  const crumbs = page.getByRole('navigation', { name: 'Ruta de la página' });
  await expect(crumbs.locator('button')).toHaveText(['📄 Viajes', '📄 Chiloé']);

  // Cambiar el icono.
  await page.getByRole('button', { name: 'Cambiar icono' }).click();
  await page.getByRole('menuitem', { name: 'Icono 🌱' }).click();
  await expect(crumbs.locator('button').last()).toHaveText('🌱 Chiloé');

  // El árbol muestra la subpágina anidada bajo su madre.
  await openSidebar(page);
  const row = tree(page).locator('.row', { hasText: 'Chiloé' });
  await expect(row).toHaveCSS('padding-left', '16px');

  // Volver a la madre con las migas.
  if (await page.locator('.app.drawer').count()) {
    await page.locator('.scrim').click({ position: { x: 360, y: 400 } });
  }
  const parentCrumb = crumbs.getByRole('button', { name: '📄 Viajes' });
  if (await parentCrumb.isVisible()) await parentCrumb.click();
  else await goTo(page, 'Viajes'); // en celular solo se ve la última miga
  await expect(titleBox(page)).toHaveText('Viajes');

  // Contraer y expandir.
  await openSidebar(page);
  await tree(page).getByRole('button', { name: 'Contraer Viajes' }).click();
  await expect(tree(page).getByRole('button', { name: 'Chiloé', exact: true })).toHaveCount(0);
  await tree(page).getByRole('button', { name: 'Expandir Viajes' }).click();
  await expect(tree(page).getByRole('button', { name: 'Chiloé', exact: true })).toBeVisible();

  // Todo sigue ahí después de recargar.
  await waitForSave(page);
  await page.reload();
  await expect(titleBox(page)).toHaveText('Viajes');
  await openSidebar(page);
  await expect(tree(page).getByRole('button', { name: 'Chiloé', exact: true })).toBeVisible();
});

test('subpágina desde el menú / deja un enlace en la página madre', async ({ page }) => {
  await newPage(page, 'Madre');
  await page.keyboard.type('/subp');
  await page.keyboard.press('Enter');
  await expect(titleBox(page)).toBeFocused();
  await page.keyboard.type('Hija');
  await waitForSave(page);

  await goTo(page, 'Madre');
  const link = editor(page).locator('.plink');
  await expect(link).toHaveText('📄Hija');
  await link.click();
  await expect(titleBox(page)).toHaveText('Hija');
});

test('la búsqueda encuentra texto del contenido sin tildes', async ({ page }) => {
  await newPage(page, 'Receta');
  await page.keyboard.type('Pastel de choclo con albahaca');
  await waitForSave(page);
  await openSidebar(page);
  await page.getByRole('searchbox', { name: 'Buscar' }).fill('CHOCLO');
  await expect(tree(page).getByRole('button', { name: 'Receta', exact: true })).toBeVisible();
  await expect(tree(page).locator('.row')).toHaveCount(1);
  await page.getByRole('searchbox', { name: 'Buscar' }).fill('pagina que no existe');
  await expect(tree(page).getByText('Sin resultados')).toBeVisible();
});

test('duplicar y eliminar con confirmación (incluye subpáginas)', async ({ page }) => {
  await newPage(page, 'Borrar');
  await page.keyboard.type('contenido');
  await openSidebar(page);
  await tree(page).getByRole('button', { name: 'Nueva subpágina en Borrar' }).click();
  await expect(titleBox(page)).toBeFocused();
  await page.keyboard.type('Hija de borrar');
  await goTo(page, 'Borrar');

  await page.getByRole('button', { name: 'Opciones de página' }).click();
  await page.getByRole('menuitem', { name: 'Duplicar página' }).click();
  await expect(titleBox(page)).toHaveText('Borrar (copia)');
  await expect(editor(page)).toContainText('contenido');

  await goTo(page, 'Borrar');
  await page.getByRole('button', { name: 'Opciones de página' }).click();
  await page.getByRole('menuitem', { name: 'Eliminar página' }).click();
  const dialog = page.getByRole('dialog', { name: '¿Eliminar «Borrar»?' });
  await expect(dialog).toContainText('También se borrarán sus 1 subpágina');

  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(titleBox(page)).toHaveText('Borrar');

  await page.getByRole('button', { name: 'Opciones de página' }).click();
  await page.getByRole('menuitem', { name: 'Eliminar página' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click();
  // Al eliminar se abre otra página (y se cierra el cajón): esperar antes de abrirlo.
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(titleBox(page)).not.toHaveText('Borrar');
  await openSidebar(page);
  await expect(tree(page).getByRole('button', { name: 'Borrar', exact: true })).toHaveCount(0);
  await expect(tree(page).getByRole('button', { name: 'Hija de borrar', exact: true })).toHaveCount(
    0,
  );
  await expect(
    tree(page).getByRole('button', { name: 'Borrar (copia)', exact: true }),
  ).toBeVisible();
});

test('en celular la barra lateral es un cajón que se cierra al tocar fuera', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'celular', 'solo en pantallas angostas');
  const menu = page.getByRole('button', { name: 'Abrir páginas' });
  await expect(menu).toBeVisible();
  await expect(tree(page)).toBeHidden();
  await menu.click();
  await expect(tree(page)).toBeVisible();
  await page.locator('.scrim').click({ position: { x: 370, y: 400 } });
  await expect(tree(page)).toBeHidden();
  await menu.click();
  await tree(page).getByRole('button', { name: 'Diario', exact: true }).click();
  await expect(tree(page)).toBeHidden();
  await expect(titleBox(page)).toHaveText('Diario');
});
