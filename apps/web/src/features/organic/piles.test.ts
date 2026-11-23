import type { Note } from '@cuaderno/shared';
import { newOrganicPage } from '../../lib/pages';
import {
  arrangeInCircle,
  createNote,
  dropTarget,
  groupsOf,
  moveGroup,
  moveInSequence,
  stackOnto,
  STACK_DISTANCE,
  takeOut,
} from './model';

/** Notas sueltas a, b, c, d con posiciones distintas. */
function sample(): Note[] {
  const page = newOrganicPage(null);
  const notes: Note[] = [];
  for (const id of ['a', 'b', 'c', 'd']) {
    const n = createNote({ ...page, notes }, 'md');
    notes.push({ ...n, id, g: id });
  }
  return notes;
}
const ids = (ns: Note[]) => ns.map((n) => n.id);

describe('arrastre libre', () => {
  it('mueve el montón entero a una posición normalizada (0..1)', () => {
    const ns = stackOnto(sample(), 'b', 'a');
    const moved = moveGroup(ns, 'a', 0.123456, 1.5);
    expect(moved.filter((n) => n.g === 'a').map((n) => [n.x, n.y])).toEqual([
      [0.1235, 1],
      [0.1235, 1],
    ]);
    expect(moved.find((n) => n.id === 'c')).toEqual(ns.find((n) => n.id === 'c'));
  });

  it('apila si el centro queda a menos de 0,55 × el ancho de la tarjeta', () => {
    const others = [
      { g: 'x', center: [100, 100] as [number, number] },
      { g: 'y', center: [300, 100] as [number, number] },
    ];
    expect(STACK_DISTANCE).toBe(0.55);
    expect(dropTarget([150, 100], others, 100)).toBe('x');
    expect(dropTarget([156, 100], others, 100)).toBeNull();
    expect(dropTarget([280, 110], others, 100)).toBe('y');
  });
});

describe('montones', () => {
  it('las notas movidas quedan justo después de la última del montón destino', () => {
    let ns = stackOnto(sample(), 'c', 'a');
    expect(ids(ns)).toEqual(['a', 'c', 'b', 'd']);
    // Apilar un montón entero sobre otro conserva su orden interno.
    ns = stackOnto(stackOnto(ns, 'd', 'b'), 'b', 'a');
    expect(ids(ns)).toEqual(['a', 'c', 'b', 'd']);
    expect(groupsOf(ns)).toHaveLength(1);
    const a = ns[0]!;
    expect(ns.every((n) => n.g === 'a' && n.x === a.x && n.y === a.y)).toBe(true);
  });

  it('apilar sobre sí mismo no cambia nada', () => {
    const ns = sample();
    expect(stackOnto(ns, 'a', 'a')).toBe(ns);
  });

  it('sacar del montón deja la nota suelta al lado', () => {
    const ns = stackOnto(sample(), 'b', 'a');
    const out = takeOut(ns, 'b');
    const b = out.find((n) => n.id === 'b')!;
    const a = out.find((n) => n.id === 'a')!;
    expect(b.g).toBe('b');
    expect(Math.abs(b.x - a.x)).toBeCloseTo(0.14, 3);
    expect(groupsOf(out)).toHaveLength(4);
  });

  it('sacar la nota que da nombre al montón deja las demás juntas', () => {
    const pile = stackOnto(stackOnto(sample(), 'b', 'a'), 'c', 'a'); // grupo "a": a, b, c
    const out = takeOut(pile, 'a');
    expect(out.find((n) => n.id === 'a')!.g).toBe('a');
    expect(out.filter((n) => n.id === 'b' || n.id === 'c').map((n) => n.g)).toEqual(['b', 'b']);
    expect(groupsOf(out).map((x) => x.notes.length)).toEqual([1, 2, 1]);
  });

  it('dos notas sacadas del mismo montón no quedan una encima de otra', () => {
    const pile = stackOnto(stackOnto(sample(), 'b', 'a'), 'c', 'a');
    const out = takeOut(takeOut(pile, 'b'), 'c');
    const b = out.find((n) => n.id === 'b')!;
    const c = out.find((n) => n.id === 'c')!;
    expect(Math.hypot(b.x - c.x, b.y - c.y)).toBeGreaterThan(0.1);
  });

  it('en modo cuaderno, el orden cambia solo entre las hojas del montón', () => {
    const ns = stackOnto(stackOnto(sample(), 'c', 'a'), 'd', 'a'); // a, c, d, b
    expect(ids(ns)).toEqual(['a', 'c', 'd', 'b']);
    expect(ids(moveInSequence(ns, 'd', -1, 'a'))).toEqual(['a', 'd', 'c', 'b']);
    // La última hoja no pasa a la nota suelta siguiente.
    expect(moveInSequence(ns, 'd', 1, 'a')).toBe(ns);
    // Sin montón, se mueve en el orden general.
    expect(ids(moveInSequence(ns, 'd', 1, null))).toEqual(['a', 'c', 'b', 'd']);
  });

  it('reacomodar en círculo reparte los grupos sin separar los montones', () => {
    const ns = arrangeInCircle(stackOnto(sample(), 'b', 'a'));
    const groups = groupsOf(ns);
    expect(groups).toHaveLength(3);
    const spots = groups.map(({ notes }) => `${notes[0]!.x},${notes[0]!.y}`);
    expect(new Set(spots).size).toBe(3);
    for (const { notes } of groups) {
      const [first] = notes;
      expect(notes.every((n) => n.x === first!.x && n.y === first!.y)).toBe(true);
      expect(Math.hypot(first!.x - 0.5, first!.y - 0.5)).toBeGreaterThan(0.3);
    }
  });
});
