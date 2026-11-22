import type { OrganicPage } from '@cuaderno/shared';
import { CuadernoDB } from './db';
import { ancestryOf, childrenOf, descendantsOf, PageRepo, searchPages } from './pages';

describe('PageRepo', () => {
  let d: CuadernoDB;
  let repo: PageRepo;

  beforeEach(() => {
    d = new CuadernoDB(`t-${Math.random()}`);
    repo = new PageRepo(d);
  });
  afterEach(async () => {
    d.close();
    await d.delete();
  });

  it('crea páginas y subpáginas en orden', async () => {
    const a = await repo.create(null, { title: 'A' });
    const b = await repo.create(a.id, { title: 'B' });
    const c = await repo.create(a.id, { title: 'C' });
    const all = await d.pages.toArray();
    expect(childrenOf(all, null).map((p) => p.title)).toEqual(['A']);
    expect(childrenOf(all, a.id).map((p) => p.id)).toEqual([b.id, c.id]);
    expect(ancestryOf(all, c.id).map((p) => p.title)).toEqual(['A', 'C']);
  });

  it('actualiza la versión y la fecha al guardar', async () => {
    const a = await repo.create(null);
    await repo.update(a.id, { title: 'Nuevo' });
    const saved = await d.pages.get(a.id);
    expect(saved?.title).toBe('Nuevo');
    expect(saved?.version).toBe(2);
  });

  it('duplica con ids de bloque nuevos', async () => {
    const a = await repo.create(null, {
      title: 'Nota',
      blocks: [{ id: 'b1', type: 'p', html: 'hola' }],
    });
    const copy = await repo.duplicate(a.id);
    expect(copy?.title).toBe('Nota (copia)');
    expect(copy?.kind === 'page' && copy.blocks[0]?.id).not.toBe('b1');
    expect(copy?.kind === 'page' && copy.blocks[0]?.type === 'p' && copy.blocks[0].html).toBe(
      'hola',
    );
  });

  it('elimina la página con todas sus subpáginas (borrado lógico)', async () => {
    const a = await repo.create(null);
    const b = await repo.create(a.id);
    const c = await repo.create(b.id);
    const other = await repo.create(null);
    const removed = await repo.remove(a.id);
    expect(new Set(removed)).toEqual(new Set([a.id, b.id, c.id]));
    const all = await d.pages.toArray();
    expect(all.find((p) => p.id === c.id)?.deletedAt).toBeTruthy();
    expect(all.find((p) => p.id === other.id)?.deletedAt).toBeUndefined();
    expect(childrenOf(all, null).map((p) => p.id)).toEqual([other.id]);
    expect(descendantsOf(all, a.id)).toEqual([]);
  });

  it('crea las páginas de ejemplo solo una vez', async () => {
    await repo.seedIfEmpty();
    const n = await d.pages.count();
    expect(n).toBeGreaterThan(0);
    await repo.seedIfEmpty();
    expect(await d.pages.count()).toBe(n);
  });
});

describe('searchPages', () => {
  it('busca en título y contenido sin tildes, incluidas notas orgánicas y LaTeX', async () => {
    const d = new CuadernoDB(`s-${Math.random()}`);
    const repo = new PageRepo(d);
    await repo.create(null, {
      title: 'Física',
      blocks: [{ id: 'm', type: 'math', tex: '\\vec{F}' }],
    });
    await repo.create(null, {
      title: 'Otra',
      blocks: [{ id: 'x', type: 'p', html: 'Canción <b>rápida</b>' }],
    });
    const now = new Date().toISOString();
    const organic: OrganicPage = {
      id: 'o',
      parentId: null,
      title: 'Viaje',
      icon: '🌀',
      createdAt: now,
      updatedAt: now,
      version: 1,
      kind: 'organic',
      center: {
        mode: 'text',
        html: 'Sur',
        strokes: [],
        h: 400,
        imgMode: 'postal',
        cap: '',
        bgScope: 'hoja',
        bgDim: 0.25,
      },
      notes: [
        {
          id: 'n',
          kind: 'voice',
          title: 'Ferry',
          color: 'rosa',
          x: 0,
          y: 0,
          g: 'n',
          text: 'Chiloé',
          createdAt: now,
        },
      ],
      style: { bg: 'pizarra', ink: '#ffb43f', font: 'mano' },
    };
    await d.pages.add(organic);
    const all = await d.pages.toArray();
    expect(searchPages(all, 'fisica').map((p) => p.title)).toEqual(['Física']);
    expect(searchPages(all, 'RAPIDA').map((p) => p.title)).toEqual(['Otra']);
    expect(searchPages(all, 'vec').map((p) => p.title)).toEqual(['Física']);
    expect(searchPages(all, 'chiloe').map((p) => p.title)).toEqual(['Viaje']);
    expect(searchPages(all, '   ')).toEqual([]);
    d.close();
    await d.delete();
  });
});
