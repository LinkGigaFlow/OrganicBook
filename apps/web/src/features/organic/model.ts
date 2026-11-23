import type {
  Block,
  Center,
  Note,
  NoteColor,
  NoteKind,
  OrganicBackground,
  OrganicFont,
  OrganicPage,
  OrganicStyle,
} from '@cuaderno/shared';
import { strip, uid } from '../../lib/text';

/* ------------------------------------------------------------------ */
/* Colores y estilo                                                    */
/* ------------------------------------------------------------------ */

export const NOTE_COLORS: Record<NoteColor, string> = {
  amarillo: '#ffe27a',
  rosa: '#ffb8d2',
  menta: '#a3f0d6',
  cielo: '#acd8ff',
  lila: '#d7c8ff',
  papel: '#fff8ea',
};
export const COLOR_KEYS = Object.keys(NOTE_COLORS) as NoteColor[];

/** Fondos del tablero (el editor de estilo llega en la Fase 7). */
export const BOARD_STYLES: Record<
  OrganicBackground,
  { label: string; bg: string; ink: string; img?: string; size?: string }
> = {
  pizarra: { label: 'Pizarra', bg: '#1b1b1b', ink: '#ffb43f' },
  corcho: {
    label: 'Corcho',
    bg: '#b98b5d',
    ink: '#3a2412',
    img: 'radial-gradient(rgba(60,30,0,.22) 1px,transparent 1.6px),radial-gradient(rgba(255,240,210,.18) 1px,transparent 1.6px)',
    size: '7px 7px,13px 13px',
  },
  papel: {
    label: 'Papel',
    bg: '#f6f1e4',
    ink: '#2f4ba0',
    img: 'radial-gradient(rgba(0,0,0,.16) 1px,transparent 1.4px)',
    size: '22px 22px',
  },
  noche: {
    label: 'Noche',
    bg: '#16163d',
    ink: '#ffd3e6',
    img: 'radial-gradient(circle at 18% 12%,rgba(120,110,255,.35),transparent 55%),radial-gradient(circle at 85% 90%,rgba(255,120,180,.22),transparent 50%)',
  },
  menta: { label: 'Menta', bg: '#dff6ec', ink: '#0b6e52' },
};

/** Letras del cuaderno (incluidas en la app: Caveat, Patrick Hand e Inter). */
export const BOARD_FONTS: Record<OrganicFont, string> = {
  mano: 'Caveat, "Segoe Print", cursive',
  marcador: '"Patrick Hand", "Comic Sans MS", cursive',
  limpia: '"Inter Variable", Inter, system-ui, sans-serif',
};

/** Tintas elegibles (SPEC). */
export const INKS = [
  '#ffb43f',
  '#f4f4f4',
  '#ff6b6b',
  '#ffd3e6',
  '#2f4ba0',
  '#0b6e52',
  '#3a2412',
  '#1b1b1b',
] as const;

/** Cambia el fondo; la tinta vuelve a la de ese fondo. */
export function withBackground(style: OrganicStyle, bg: OrganicBackground): OrganicStyle {
  return { ...style, bg, ink: BOARD_STYLES[bg].ink };
}

export const defaultStyle = (): OrganicStyle => ({ bg: 'pizarra', ink: '#ffb43f', font: 'mano' });

export const defaultCenter = (): Center => ({
  mode: 'text',
  html: '',
  strokes: [],
  h: 620,
  imgMode: 'postal',
  cap: '',
  bgScope: 'hoja',
  bgDim: 0.25,
});

export const KIND_LABEL: Record<NoteKind, string> = {
  md: 'Nota',
  voice: 'Nota de voz',
  draw: 'Nota a lápiz',
  img: 'Imagen',
};

/** Rotación fija de una tarjeta según su id (entre -3° y 3°). */
export function rotationOf(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.round(((Math.abs(h) % 7) - 3) * 1000) / 1000;
}

/** ¿El centro usa imagen de fondo? (solo en modo texto o lápiz). */
export const hasSheetBg = (c: Center) => !!c.bgFileId && (c.mode === 'text' || c.mode === 'draw');

/* ------------------------------------------------------------------ */
/* Medidas del tablero                                                 */
/* ------------------------------------------------------------------ */

export type BoardDims = {
  W: number;
  H: number;
  /** Tarjeta. */
  nw: number;
  nh: number;
  /** Centro. */
  cw: number;
  ch: number;
};

/** SPEC: alto 62 % del ancho (560–900 px) o 1,5× en celular; tarjeta 17 % (112–200 px); centro 38 % (máx. 440; 60 % en celular). */
export function boardDims(W: number): BoardDims {
  const narrow = W < 600;
  const nw = Math.round(Math.max(112, Math.min(W * 0.17, 200)));
  const nh = Math.round(nw * 0.88);
  const H = Math.round(narrow ? W * 1.5 : Math.min(Math.max(W * 0.62, 560), 900));
  const cw = Math.round(narrow ? W * 0.6 : Math.min(440, W * 0.38));
  return { W, H, nw, nh, cw, ch: Math.round(cw * 0.7) };
}

/** Posición normalizada → centro de la tarjeta en píxeles, sin salirse del tablero. */
export function cardCenter(x: number, y: number, D: BoardDims): [number, number] {
  return [
    Math.min(Math.max(x * D.W, D.nw / 2 + 8), D.W - D.nw / 2 - 8),
    Math.min(Math.max(y * D.H, D.nh / 2 + 8), D.H - D.nh / 2 - 8),
  ];
}

/**
 * Línea curva del centro a una tarjeta: sale del borde del centro y termina en el borde
 * de la tarjeta (donde va el punto). `null` si se tocan.
 */
export function linkPath(
  card: [number, number],
  D: BoardDims,
  bend: number,
): { d: string; end: [number, number] } | null {
  const cx = D.W / 2;
  const cy = D.H / 2;
  const [x, y] = card;
  const dx = x - cx;
  const dy = y - cy;
  const ax = Math.abs(dx) || 1e-6;
  const ay = Math.abs(dy) || 1e-6;
  const ts = Math.min((D.cw * 0.36) / ax, (D.ch * 0.3) / ay);
  const te = Math.min(D.nw / 2 / ax, D.nh / 2 / ay) * 1.12;
  if (ts + te >= 0.95) return null;
  const sx = cx + dx * ts;
  const sy = cy + dy * ts;
  const ex = x - dx * te;
  const ey = y - dy * te;
  const mx = (sx + ex) / 2 - (ey - sy) * bend;
  const my = (sy + ey) / 2 + (ex - sx) * bend;
  const f = (n: number) => n.toFixed(1);
  return { d: `M${f(sx)} ${f(sy)}Q${f(mx)} ${f(my)} ${f(ex)} ${f(ey)}`, end: [ex, ey] };
}

/* ------------------------------------------------------------------ */
/* Posiciones de las notas nuevas                                      */
/* ------------------------------------------------------------------ */

/** Anillo de posiciones: primero las cuatro esquinas, luego arriba, abajo, izquierda y derecha. */
const SLOTS = [-135, -45, 45, 135, -90, 90, 180, 0];

/** Primer espacio libre del anillo para una nota nueva. */
export function freeSpot(notes: Pick<Note, 'g' | 'x' | 'y'>[]): [number, number] {
  const seen = new Set<string>();
  const taken: { x: number; y: number }[] = [];
  for (const n of notes) {
    if (seen.has(n.g)) continue;
    seen.add(n.g);
    taken.push(n);
  }
  for (let k = 0; k < 24; k++) {
    const ring = Math.floor(k / 8);
    const a = ((SLOTS[k % 8]! + ring * 22) * Math.PI) / 180;
    const r = [0.36, 0.42, 0.28][ring]!;
    const x = 0.5 + r * Math.cos(a);
    const y = 0.5 + r * 1.05 * Math.sin(a);
    if (taken.every((o) => Math.hypot(o.x - x, (o.y - y) * 0.8) > 0.15)) {
      return [round4(x), round4(y)];
    }
  }
  return [round4(0.3 + Math.random() * 0.4), 0.88];
}

const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

/* ------------------------------------------------------------------ */
/* Notas                                                               */
/* ------------------------------------------------------------------ */

export type NewNoteKind = NoteKind | 'tex';

/** Crea una nota en el primer espacio libre, con el siguiente color de la lista. */
export function createNote(page: OrganicPage, kind: NewNoteKind, init: Partial<Note> = {}): Note {
  const id = uid();
  const [x, y] = freeSpot(page.notes);
  const base: Note = {
    id,
    kind: kind === 'tex' ? 'md' : kind,
    title: '',
    color: COLOR_KEYS[page.notes.length % COLOR_KEYS.length]!,
    x,
    y,
    g: id,
    createdAt: new Date().toISOString(),
  };
  if (kind === 'md') base.blocks = [{ id: uid(), type: 'p', html: '' }];
  if (kind === 'tex') {
    base.title = 'Fórmula';
    base.blocks = [
      { id: uid(), type: 'math', tex: '' },
      { id: uid(), type: 'p', html: '' },
    ];
  }
  if (kind === 'draw') {
    base.strokes = [];
    base.h = 640;
  }
  if (kind === 'voice') {
    base.text = '';
    base.dur = 0;
  }
  if (kind === 'img') base.cap = '';
  return { ...base, ...init };
}

/** Texto de vista previa de una nota Markdown. */
export function mdPreview(blocks: Block[] | undefined): string {
  return (blocks ?? [])
    .map((b) => ('html' in b ? strip(b.html) : ''))
    .filter((t) => t.trim())
    .join(' · ')
    .slice(0, 220);
}

/** Primera fórmula con contenido de una nota Markdown. */
export const firstMath = (blocks: Block[] | undefined) =>
  (blocks ?? []).find(
    (b): b is Extract<Block, { type: 'math' }> => b.type === 'math' && !!b.tex.trim(),
  );

/** Mueve una nota una posición antes (-1) o después (+1) en el orden. */
export function moveNote(notes: Note[], id: string, dir: -1 | 1): Note[] {
  const i = notes.findIndex((n) => n.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= notes.length) return notes;
  const out = notes.slice();
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}

/** Índice siguiente en un recorrido cíclico de `n` elementos. */
export const cycle = (i: number, d: number, n: number) => (n ? (((i + d) % n) + n) % n : 0);

/** Página orgánica nueva. */
export function organicInit(): Pick<OrganicPage, 'kind' | 'icon' | 'center' | 'notes' | 'style'> {
  return { kind: 'organic', icon: '🌀', center: defaultCenter(), notes: [], style: defaultStyle() };
}

/* ------------------------------------------------------------------ */
/* Montones                                                            */
/* ------------------------------------------------------------------ */

/** Grupos en orden de aparición: cada uno es un montón (o una nota suelta). */
export function groupsOf(notes: Note[]): { g: string; notes: Note[] }[] {
  const map = new Map<string, Note[]>();
  for (const n of notes) {
    const list = map.get(n.g);
    if (list) list.push(n);
    else map.set(n.g, [n]);
  }
  return Array.from(map, ([g, list]) => ({ g, notes: list }));
}

/** Mueve un montón (o nota suelta) entero a una posición normalizada. */
export function moveGroup(notes: Note[], g: string, x: number, y: number): Note[] {
  const nx = round4(Math.min(1, Math.max(0, x)));
  const ny = round4(Math.min(1, Math.max(0, y)));
  return notes.map((n) => (n.g === g ? { ...n, x: nx, y: ny } : n));
}

/**
 * Apila el grupo `moving` sobre `target`: las notas movidas toman su grupo y su posición y
 * quedan justo después de la última nota del montón destino.
 */
export function stackOnto(notes: Note[], moving: string, target: string): Note[] {
  if (moving === target) return notes;
  const dest = notes.find((n) => n.g === target);
  if (!dest) return notes;
  const moved = notes
    .filter((n) => n.g === moving)
    .map((n) => ({ ...n, g: target, x: dest.x, y: dest.y }));
  const rest = notes.filter((n) => n.g !== moving);
  let at = -1;
  rest.forEach((n, i) => {
    if (n.g === target) at = i;
  });
  return [...rest.slice(0, at + 1), ...moved, ...rest.slice(at + 1)];
}

/**
 * Saca una nota de su montón y la deja suelta al lado, hacia el centro del tablero, en el
 * primer hueco libre (para que varias notas sacadas no queden una encima de otra).
 */
export function takeOut(notes: Note[], id: string): Note[] {
  const note = notes.find((n) => n.id === id);
  if (!note) return notes;
  const others = groupsOf(notes.filter((n) => n.id !== id))
    .filter(({ g }) => g !== note.g)
    .map(({ notes: ns }) => ns[0]!);
  const sx = note.x > 0.5 ? -1 : 1;
  const sy = note.y > 0.5 ? -1 : 1;
  const candidates: [number, number][] = [
    [0.14 * sx, -0.08],
    [0.14 * sx, 0.1],
    [0, 0.2 * sy],
    [0.28 * sx, 0],
    [0.14 * sx, 0.24 * sy],
    [0.28 * sx, 0.2 * sy],
  ].map(([dx, dy]) => [
    Math.min(0.9, Math.max(0.1, note.x + dx!)),
    Math.min(0.9, Math.max(0.1, note.y + dy!)),
  ]);
  const free = (p: [number, number]) =>
    Math.hypot(p[0] - note.x, (p[1] - note.y) * 0.8) > 0.1 &&
    others.every((o) => Math.hypot(o.x - p[0], (o.y - p[1]) * 0.8) > 0.1);
  const [x, y] = candidates.find(free) ?? candidates[0]!;
  // Si la nota daba nombre al montón (g = su id), el resto toma el id de su nueva primera hoja.
  const rest = notes.filter((n) => n.g === note.g && n.id !== id);
  const regroup = note.g === id && rest.length ? rest[0]!.id : null;
  return notes.map((n) => {
    if (n.id === id) return { ...n, g: n.id, x: round4(x), y: round4(y) };
    if (regroup && n.g === id) return { ...n, g: regroup };
    return n;
  });
}

/** "Reacomodar en círculo": reparte los montones y notas sueltas alrededor del centro. */
export function arrangeInCircle(notes: Note[]): Note[] {
  const groups = groupsOf(notes);
  const step = 360 / Math.max(groups.length, 4);
  const pos = new Map<string, [number, number]>();
  groups.forEach(({ g }, i) => {
    const a = ((-135 + i * step) * Math.PI) / 180;
    pos.set(g, [round4(0.5 + 0.36 * Math.cos(a)), round4(0.5 + 0.38 * Math.sin(a))]);
  });
  return notes.map((n) => {
    const [x, y] = pos.get(n.g)!;
    return { ...n, x, y };
  });
}

/** Distancia (en anchos de tarjeta) bajo la cual una tarjeta soltada se apila sobre otra. */
export const STACK_DISTANCE = 0.55;

/** Grupo más cercano a `point` dentro de 0,55 × el ancho de la tarjeta (o `null`). */
export function dropTarget(
  point: [number, number],
  others: { g: string; center: [number, number] }[],
  cardWidth: number,
): string | null {
  let best: string | null = null;
  let bestD = cardWidth * STACK_DISTANCE;
  for (const o of others) {
    const d = Math.hypot(o.center[0] - point[0], o.center[1] - point[1]);
    if (d < bestD) {
      bestD = d;
      best = o.g;
    }
  }
  return best;
}

/**
 * Mueve una nota antes o después dentro de su recorrido: todas las notas o, en modo cuaderno,
 * solo las hojas de su montón.
 */
export function moveInSequence(
  notes: Note[],
  id: string,
  dir: -1 | 1,
  pile: string | null,
): Note[] {
  const seq = notes.filter((n) => pile === null || n.g === pile);
  const k = seq.findIndex((n) => n.id === id);
  const other = seq[k + dir];
  if (k < 0 || !other) return notes;
  const i = notes.findIndex((n) => n.id === id);
  const j = notes.findIndex((n) => n.id === other.id);
  const out = notes.slice();
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}
