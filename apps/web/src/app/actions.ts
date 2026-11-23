import { flushPending } from '../lib/flush';
import { childrenOf, pages } from '../lib/pages';
import { db } from '../lib/db';
import { useAppStore } from './store';

/** Crea una página (o subpágina), la abre y deja el foco en su título. */
export async function createPageAndOpen(parentId: string | null): Promise<string> {
  // Suelta el foco del botón pulsado: si se escribe antes de que el título reciba el foco,
  // un espacio no debe volver a pulsar el botón y crear otra página.
  (document.activeElement as HTMLElement | null)?.blur?.();
  await flushPending();
  const p = await pages.create(parentId);
  if (parentId) useAppStore.getState().toggleExpanded(parentId, true);
  useAppStore.getState().openPage(p.id, { focusTitle: true });
  return p.id;
}

/** Crea un cuaderno orgánico, lo abre y deja el foco en su título. */
export async function createOrganicAndOpen(parentId: string | null): Promise<string> {
  (document.activeElement as HTMLElement | null)?.blur?.();
  await flushPending();
  const p = await pages.createOrganic(parentId);
  if (parentId) useAppStore.getState().toggleExpanded(parentId, true);
  useAppStore.getState().openPage(p.id, { focusTitle: true });
  return p.id;
}

/** Crea una subpágina sin abrirla (para el bloque "Subpágina"). */
export async function createSubpage(parentId: string): Promise<string> {
  const p = await pages.create(parentId);
  useAppStore.getState().toggleExpanded(parentId, true);
  return p.id;
}

export async function duplicateAndOpen(id: string): Promise<void> {
  await flushPending();
  const copy = await pages.duplicate(id);
  if (copy) useAppStore.getState().openPage(copy.id);
}

/** Elimina la página y sus subpáginas, y abre la madre o la primera página que quede. */
export async function deleteAndNavigate(id: string): Promise<void> {
  await flushPending();
  const target = await db.pages.get(id);
  const removed = new Set(await pages.remove(id));
  const all = await db.pages.toArray();
  const parent = target?.parentId
    ? all.find((p) => p.id === target.parentId && !p.deletedAt)
    : undefined;
  let next = parent?.id ?? childrenOf(all, null).find((p) => !removed.has(p.id))?.id;
  if (!next) next = (await pages.create(null)).id;
  useAppStore.getState().openPage(next);
}
