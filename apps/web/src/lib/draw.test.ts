import type { Stroke } from '@cuaderno/shared';
import {
  eraseAt,
  hitsStroke,
  LOGICAL_WIDTH,
  outlineToPath,
  strokeOutline,
  toLogical,
} from './draw';

const line = (pts: [number, number][], w = 3): Stroke => ({
  t: 'pen',
  c: 'ink',
  w,
  pts: pts.map(([x, y]) => [x, y, 0.5]),
});

describe('coordenadas lógicas', () => {
  it('el mismo punto relativo da la misma coordenada en cualquier ancho', () => {
    const wide = toLogical(400, 150, { left: 100, top: 50, width: 600 }, 0.5);
    const narrow = toLogical(150, 100, { left: 50, top: 50, width: 200 }, 0.5);
    expect(wide).toEqual([500, 166.7, 0.5]);
    expect(narrow).toEqual([500, 250, 0.5]);
    expect(toLogical(700, 0, { left: 100, top: 0, width: 600 }, 1)[0]).toBe(LOGICAL_WIDTH);
  });

  it('limita la presión a 0..1', () => {
    expect(toLogical(0, 0, { left: 0, top: 0, width: 1000 }, 3)[2]).toBe(1);
    expect(toLogical(0, 0, { left: 0, top: 0, width: 1000 }, -1)[2]).toBe(0);
  });
});

describe('borrador por trazo', () => {
  const a = line([
    [0, 0],
    [200, 0],
  ]);
  const b = line([
    [0, 300],
    [10, 300],
  ]);

  it('toca un trazo en medio de un segmento largo, no solo en sus puntos', () => {
    expect(hitsStroke(a, [100, 10, 0.5])).toBe(true);
    expect(hitsStroke(a, [100, 40, 0.5])).toBe(false);
  });

  it('quita el trazo completo y deja los demás', () => {
    expect(eraseAt([a, b], [100, 5, 0.5])).toEqual([b]);
  });

  it('devuelve el mismo arreglo si no borra nada', () => {
    const list = [a, b];
    expect(eraseAt(list, [600, 600, 0.5])).toBe(list);
  });
});

describe('contorno con perfect-freehand', () => {
  const spread = (pts: number[][]) =>
    Math.max(...pts.map((p) => p[1]!)) - Math.min(...pts.map((p) => p[1]!));

  it('genera un trazado cerrado y el resaltador es más ancho', () => {
    const pen = line([
      [0, 0],
      [50, 20],
      [100, 0],
    ]);
    const hl: Stroke = { ...pen, t: 'hl' };
    const out = strokeOutline(pen);
    expect(out.length).toBeGreaterThan(4);
    expect(outlineToPath(out)).toMatch(/^M.* Z$/);
    expect(spread(strokeOutline(hl))).toBeGreaterThan(spread(out));
  });

  it('con presión real del lápiz el trazo es más grueso donde se aprieta más', () => {
    const mk = (p: number): Stroke => ({
      t: 'pen',
      c: 'ink',
      w: 6,
      pts: Array.from({ length: 20 }, (_, i) => [i * 10, 0, p] as [number, number, number]),
    });
    expect(spread(strokeOutline(mk(0.95)))).toBeGreaterThan(spread(strokeOutline(mk(0.2))));
  });
});
