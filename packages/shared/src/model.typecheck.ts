/**
 * Comprobación de tipos en tiempo de compilación (no se exporta).
 * Si el modelo cambia de forma incompatible, `npm run typecheck` falla aquí.
 */
import type { Block, OrganicPage, Page, Settings } from './model';

const now = '2026-11-22T00:00:00.000Z';

export const samplePage = {
  id: 'p1',
  parentId: null,
  title: 'Bienvenida',
  icon: '📄',
  createdAt: now,
  updatedAt: now,
  version: 1,
  kind: 'page',
  blocks: [
    { id: 'b1', type: 'h1', html: 'Hola' },
    { id: 'b2', type: 'todo', html: 'Tarea', checked: false },
    { id: 'b3', type: 'math', tex: '\\ce{2H2 + O2 -> 2H2O}' },
    { id: 'b4', type: 'img', fileId: 'f1', cap: '', size: 'm' },
    { id: 'b5', type: 'draw', strokes: [{ t: 'pen', c: 'ink', w: 3, pts: [[0, 0, 0.5]] }], h: 300 },
    { id: 'b6', type: 'divider' },
    { id: 'b7', type: 'link', pageId: 'p2' },
  ] satisfies Block[],
} satisfies Page;

export const sampleOrganic = {
  id: 'o1',
  parentId: null,
  title: 'Tablero',
  icon: '🗒️',
  createdAt: now,
  updatedAt: now,
  version: 1,
  kind: 'organic',
  center: {
    mode: 'text',
    html: 'Tema central',
    strokes: [],
    h: 400,
    imgMode: 'postal',
    cap: '',
    bgScope: 'hoja',
    bgDim: 0.25,
  },
  notes: [
    {
      id: 'n1',
      kind: 'voice',
      title: 'Audio',
      color: 'amarillo',
      x: 0.2,
      y: 0.2,
      g: 'n1',
      audioFileId: 'f2',
      dur: 12,
      text: 'transcripción',
      createdAt: now,
    },
  ],
  style: { bg: 'pizarra', ink: '#ffb43f', font: 'mano' },
} satisfies OrganicPage;

export const sampleSettings = {
  skin: 'auto',
  accent: '#3b5bdb',
  font: 'sans',
  size: 'm',
  width: 'normal',
  lang: 'es-CL',
  penOnly: false,
} satisfies Settings;
