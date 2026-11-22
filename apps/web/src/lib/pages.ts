import type { AnyPage, Block, Page } from '@cuaderno/shared';
import { db, type CuadernoDB } from './db';
import { norm, strip, uid } from './text';

let lastTime = 0;
/**
 * Fecha actual que nunca se repite dentro de la sesión: dos páginas creadas en el mismo
 * milisegundo quedan igual en el orden en que se crearon.
 */
const nowIso = () => {
  lastTime = Math.max(Date.now(), lastTime + 1);
  return new Date(lastTime).toISOString();
};

/** Bloque sin id (Omit distributivo sobre la unión). */
type NewBlock = Block extends unknown
  ? Block extends infer T
    ? T extends Block
      ? Omit<T, 'id'>
      : never
    : never
  : never;

export const emptyParagraph = (): Block => ({ id: uid(), type: 'p', html: '' });

/** Páginas visibles (no eliminadas). */
export const isAlive = (p: AnyPage) => !p.deletedAt;

/** Hijas directas de `parentId`, en orden de creación. */
export function childrenOf(pages: AnyPage[], parentId: string | null): AnyPage[] {
  return pages
    .filter((p) => isAlive(p) && p.parentId === parentId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

/** Todas las descendientes vivas de una página. */
export function descendantsOf(pages: AnyPage[], id: string): AnyPage[] {
  const out: AnyPage[] = [];
  const walk = (pid: string) => {
    for (const c of childrenOf(pages, pid)) {
      out.push(c);
      walk(c.id);
    }
  };
  walk(id);
  return out;
}

/** Cadena de ancestros (incluida la página), de la raíz hacia la página. */
export function ancestryOf(pages: AnyPage[], id: string): AnyPage[] {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const chain: AnyPage[] = [];
  const seen = new Set<string>();
  let cur = byId.get(id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return chain;
}

function blocksText(blocks: Block[] | undefined): string {
  return (blocks ?? [])
    .map((b) => {
      switch (b.type) {
        case 'math':
          return b.tex;
        case 'img':
          return strip(b.cap);
        case 'divider':
        case 'draw':
        case 'link':
          return '';
        default:
          return strip(b.html);
      }
    })
    .join(' ');
}

/** Todo el texto buscable de una página: título, bloques, notas orgánicas y código LaTeX. */
export function pageText(p: AnyPage): string {
  if (p.kind === 'page') return `${p.title} ${blocksText(p.blocks)}`;
  const c = p.center;
  const notes = p.notes
    .map((n) => `${n.title} ${n.text ?? ''} ${strip(n.cap)} ${blocksText(n.blocks)}`)
    .join(' ');
  return `${p.title} ${strip(c.html)} ${strip(c.cap)} ${notes}`;
}

/** Páginas cuyo título o contenido contiene la búsqueda (sin tildes ni mayúsculas). */
export function searchPages(pages: AnyPage[], query: string): AnyPage[] {
  const q = norm(query.trim());
  if (!q) return [];
  return pages.filter((p) => isAlive(p) && norm(pageText(p)).includes(q));
}

export function newPage(parentId: string | null, init: Partial<Page> = {}): Page {
  const t = nowIso();
  return {
    id: uid(),
    parentId,
    title: '',
    icon: '📄',
    createdAt: t,
    updatedAt: t,
    version: 1,
    kind: 'page',
    blocks: [emptyParagraph()],
    ...init,
  };
}

export class PageRepo {
  constructor(private readonly d: CuadernoDB = db) {}

  async create(parentId: string | null, init: Partial<Page> = {}): Promise<Page> {
    const p = newPage(parentId, init);
    await this.d.pages.add(p);
    return p;
  }

  /** Guarda cambios de una página, con nueva versión y fecha. */
  async update(id: string, patch: Partial<Omit<Page, 'id' | 'kind'>>): Promise<void> {
    await this.d.transaction('rw', this.d.pages, async () => {
      const cur = await this.d.pages.get(id);
      if (!cur) return;
      await this.d.pages.put({
        ...cur,
        ...patch,
        updatedAt: nowIso(),
        version: cur.version + 1,
      } as AnyPage);
    });
  }

  /** Copia la página (sin subpáginas) junto a la original, con bloques de id nuevo. */
  async duplicate(id: string): Promise<AnyPage | undefined> {
    const src = await this.d.pages.get(id);
    if (!src || src.deletedAt) return undefined;
    const t = nowIso();
    const copy = structuredClone(src) as AnyPage;
    copy.id = uid();
    copy.title = `${src.title || 'Sin título'} (copia)`;
    copy.createdAt = t;
    copy.updatedAt = t;
    copy.version = 1;
    if (copy.kind === 'page') copy.blocks.forEach((b) => (b.id = uid()));
    else copy.notes.forEach((n) => (n.id = uid()));
    await this.d.pages.add(copy);
    return copy;
  }

  /**
   * Borrado lógico de la página y todas sus subpáginas (marca `deletedAt`,
   * así la sincronización puede propagarlo). Devuelve los ids eliminados.
   */
  async remove(id: string): Promise<string[]> {
    return this.d.transaction('rw', this.d.pages, async () => {
      const all = await this.d.pages.toArray();
      const ids = [id, ...descendantsOf(all, id).map((p) => p.id)];
      const t = nowIso();
      for (const pid of ids) {
        const p = all.find((x) => x.id === pid);
        if (p) await this.d.pages.put({ ...p, deletedAt: t, updatedAt: t, version: p.version + 1 });
      }
      return ids;
    });
  }

  /** Crea páginas de ejemplo la primera vez que se abre la app. */
  async seedIfEmpty(): Promise<void> {
    await this.d.transaction('rw', this.d.pages, async () => {
      if ((await this.d.pages.count()) > 0) return;
      for (const p of samplePages()) await this.d.pages.add(p);
    });
  }
}

export const pages = new PageRepo();

function samplePages(): Page[] {
  const base = Date.now();
  const at = (i: number) => new Date(base + i).toISOString();
  const B = (b: NewBlock): Block => ({ id: uid(), ...b }) as Block;

  const welcome = newPage(null, {
    title: 'Bienvenido a Cuaderno',
    icon: '📓',
    createdAt: at(0),
    updatedAt: at(0),
    blocks: [
      B({ type: 'p', html: 'Tus notas se guardan en este dispositivo y funcionan sin conexión.' }),
      B({ type: 'h2', html: 'Escribir con Markdown' }),
      B({
        type: 'bullet',
        html: '<code>#</code>, <code>##</code> o <code>###</code> + espacio crean títulos',
      }),
      B({
        type: 'bullet',
        html: '<code>-</code> crea una lista, <code>1.</code> una numerada, <code>[]</code> una tarea y <code>&gt;</code> una cita',
      }),
      B({
        type: 'bullet',
        html: '<code>```</code> abre un bloque de código y <code>---</code> dibuja un separador',
      }),
      B({
        type: 'bullet',
        html: 'Al salir de un bloque, <code>**negrita**</code>, <code>*cursiva*</code> y <code>`código`</code> se convierten solos',
      }),
      B({
        type: 'bullet',
        html: 'Escribe <code>/</code> en una línea vacía para ver todos los bloques',
      }),
      B({ type: 'h2', html: 'Prueba esto' }),
      B({ type: 'todo', html: 'Abrir Cuaderno', checked: true }),
      B({
        type: 'todo',
        html: 'Crear una subpágina con el botón <b>+</b> de la barra lateral',
        checked: false,
      }),
      B({ type: 'todo', html: 'Pegar varias líneas de Markdown', checked: false }),
      B({ type: 'quote', html: 'Contenido de ejemplo: puedes borrarlo cuando quieras.' }),
      B({ type: 'p', html: '' }),
    ],
  });
  const projects = newPage(null, {
    title: 'Proyectos',
    icon: '🗂️',
    createdAt: at(1),
    updatedAt: at(1),
  });
  const ideas = newPage(projects.id, {
    title: 'Ideas para la app',
    icon: '💡',
    createdAt: at(2),
    updatedAt: at(2),
    blocks: [
      B({ type: 'h2', html: 'Pendientes' }),
      B({ type: 'todo', html: 'Reconocer escritura a mano', checked: false }),
      B({ type: 'todo', html: 'Sincronizar entre dispositivos', checked: false }),
      B({ type: 'p', html: '' }),
    ],
  });
  projects.blocks = [
    B({
      type: 'p',
      html: 'Una página para ordenar ideas. Las subpáginas aparecen anidadas en la barra lateral.',
    }),
    B({ type: 'link', pageId: ideas.id }),
    B({ type: 'p', html: '' }),
  ];
  const diary = newPage(null, {
    title: 'Diario',
    icon: '📅',
    createdAt: at(3),
    updatedAt: at(3),
    blocks: [
      B({ type: 'h2', html: 'Hoy' }),
      B({ type: 'bullet', html: 'Probar los atajos de Markdown' }),
      B({ type: 'p', html: '' }),
    ],
  });
  return [welcome, projects, ideas, diary];
}
