import type { Note, OrganicPage } from '@cuaderno/shared';
import { CuadernoDB } from '../../lib/db';
import { newOrganicPage, PageRepo } from '../../lib/pages';
import {
  boardDims,
  cardCenter,
  createNote,
  cycle,
  firstMath,
  freeSpot,
  linkPath,
  mdPreview,
  moveNote,
  rotationOf,
} from './model';

const page = (notes: Note[] = []): OrganicPage => ({ ...newOrganicPage(null), notes });

describe('medidas del tablero (SPEC)', () => {
  it('pantalla ancha: alto 62 % del ancho entre 560 y 900; tarjeta 17 % (112–200); centro 38 % (máx. 440)', () => {
    expect(boardDims(1000)).toMatchObject({ W: 1000, H: 620, nw: 170, nh: 150, cw: 380 });
    expect(boardDims(700).H).toBe(560);
    expect(boardDims(2000)).toMatchObject({ H: 900, nw: 200, cw: 440 });
  });

  it('celular: alto 1,5 × ancho, centro 60 % y tarjeta mínima de 112 px', () => {
    expect(boardDims(390)).toMatchObject({ H: 585, nw: 112, nh: 99, cw: 234 });
  });

  it('las tarjetas no se salen del tablero', () => {
    const D = boardDims(400);
    expect(cardCenter(0, 1, D)).toEqual([D.nw / 2 + 8, D.H - D.nh / 2 - 8]);
  });

  it('la línea al centro termina en el borde de la tarjeta; no hay línea si se tocan', () => {
    const D = boardDims(1000);
    const l = linkPath([100, 100], D, 0.16);
    expect(l?.d).toMatch(/^M[\d.]+ [\d.]+Q/);
    expect(l!.end[0]).toBeGreaterThan(100);
    expect(linkPath([D.W / 2 + 10, D.H / 2], D, 0.16)).toBeNull();
  });
});

describe('notas nuevas', () => {
  it('se ubican primero en las cuatro esquinas, luego arriba, abajo, izquierda y derecha', () => {
    let p = page();
    const spots: [number, number][] = [];
    for (let i = 0; i < 8; i++) {
      const n = createNote(p, 'md');
      spots.push([n.x, n.y]);
      p = { ...p, notes: [...p.notes, n] };
    }
    const where = ([x, y]: [number, number]) =>
      (y < 0.4 ? 'arriba' : y > 0.6 ? 'abajo' : 'medio') +
      '-' +
      (x < 0.4 ? 'izq' : x > 0.6 ? 'der' : 'centro');
    expect(spots.map(where)).toEqual([
      'arriba-izq',
      'arriba-der',
      'abajo-der',
      'abajo-izq',
      'arriba-centro',
      'abajo-centro',
      'medio-izq',
      'medio-der',
    ]);
  });

  it('cada tipo empieza con su contenido; LaTeX es una nota con una ecuación', () => {
    const p = page();
    expect(createNote(p, 'md').blocks).toHaveLength(1);
    const tex = createNote(p, 'tex');
    expect(tex).toMatchObject({ kind: 'md', title: 'Fórmula' });
    expect(tex.blocks?.[0]).toMatchObject({ type: 'math', tex: '' });
    expect(createNote(p, 'draw')).toMatchObject({ kind: 'draw', strokes: [], h: 640 });
    expect(createNote(p, 'voice')).toMatchObject({ kind: 'voice', text: '', dur: 0 });
    const n = createNote(p, 'img', { fileId: 'f' });
    expect(n).toMatchObject({ kind: 'img', fileId: 'f', cap: '' });
    expect(n.g).toBe(n.id);
  });

  it('los colores se van turnando', () => {
    let p = page();
    const colors: string[] = [];
    for (let i = 0; i < 7; i++) {
      const n = createNote(p, 'md');
      colors.push(n.color);
      p = { ...p, notes: [...p.notes, n] };
    }
    expect(colors).toEqual(['amarillo', 'rosa', 'menta', 'cielo', 'lila', 'papel', 'amarillo']);
  });

  it('el anillo no se llena aunque haya muchas notas', () => {
    let p = page();
    for (let i = 0; i < 30; i++) p = { ...p, notes: [...p.notes, createNote(p, 'md')] };
    for (const n of p.notes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(1);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(1);
    }
    expect(freeSpot([])).toEqual(freeSpot([]));
  });
});

describe('orden y lector', () => {
  const notes = ['a', 'b', 'c'].map((id) => ({ ...createNote(page(), 'md'), id }));

  it('mueve una nota antes o después', () => {
    expect(moveNote(notes, 'b', -1).map((n) => n.id)).toEqual(['b', 'a', 'c']);
    expect(moveNote(notes, 'b', 1).map((n) => n.id)).toEqual(['a', 'c', 'b']);
    expect(moveNote(notes, 'a', -1)).toBe(notes);
  });

  it('el recorrido es cíclico', () => {
    expect(cycle(3, 1, 4)).toBe(0);
    expect(cycle(0, -1, 4)).toBe(3);
    expect(cycle(0, 1, 1)).toBe(0);
  });

  it('rotación fija entre -3° y 3°', () => {
    for (const id of ['a', 'xyz', '123abc', 'zzzzzz']) {
      const r = rotationOf(id);
      expect(Math.abs(r)).toBeLessThanOrEqual(3);
      expect(rotationOf(id)).toBe(r);
    }
  });

  it('vista previa: texto y primera fórmula', () => {
    const blocks = [
      { id: '1', type: 'p', html: 'Hola <b>mundo</b>' },
      { id: '2', type: 'math', tex: 'x^2' },
      { id: '3', type: 'bullet', html: 'item' },
    ] as const;
    expect(mdPreview([...blocks])).toBe('Hola mundo · item');
    expect(firstMath([...blocks])?.tex).toBe('x^2');
  });
});

describe('PageRepo con cuadernos orgánicos', () => {
  it('crea, guarda y duplica (montones con grupos nuevos)', async () => {
    const d = new CuadernoDB(`o-${Math.random()}`);
    const repo = new PageRepo(d);
    const o = await repo.createOrganic(null, { title: 'Viaje' });
    expect(o).toMatchObject({ kind: 'organic', icon: '🌀', notes: [] });
    expect(o.center).toMatchObject({ mode: 'text', bgScope: 'hoja', bgDim: 0.25 });

    const a = createNote(o, 'md');
    const b = { ...createNote({ ...o, notes: [a] }, 'md'), g: a.id };
    await repo.update(o.id, { notes: [a, b] });
    const copy = await repo.duplicate(o.id);
    expect(copy?.kind).toBe('organic');
    if (copy?.kind !== 'organic') return;
    const [ca, cb] = copy.notes;
    expect(ca!.id).not.toBe(a.id);
    expect(ca!.g).toBe(ca!.id);
    expect(cb!.g).toBe(ca!.id);
    d.close();
    await d.delete();
  });
});
