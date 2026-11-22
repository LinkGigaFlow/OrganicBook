/**
 * Modelo de datos de Cuaderno (docs/SPEC.md, sección "Modelo de datos").
 *
 * Cada página es un documento JSON con versión. Las imágenes y audios se guardan
 * como archivos aparte y el documento solo guarda su `fileId`, nunca base64.
 */

/** Punto de un trazo: [x, y, presión 0..1] en coordenadas lógicas (ancho fijo 1000). */
export type StrokePoint = [x: number, y: number, pressure: number];

/** Trazo de dibujo. `c` es 'ink' (color de tinta actual, se resuelve al dibujar) o un color hex. */
export type Stroke = {
  t: 'pen' | 'hl';
  c: string;
  w: number;
  pts: StrokePoint[];
};

export type TextBlockType = 'p' | 'h1' | 'h2' | 'h3' | 'bullet' | 'num' | 'quote' | 'code';
export type ImageSize = 's' | 'm' | 'l';

export type TextBlock = { id: string; type: TextBlockType; html: string };
export type TodoBlock = { id: string; type: 'todo'; html: string; checked: boolean };
/** LaTeX en bloque. */
export type MathBlock = { id: string; type: 'math'; tex: string };
export type ImageBlock = { id: string; type: 'img'; fileId: string; cap: string; size: ImageSize };
export type DrawBlock = { id: string; type: 'draw'; strokes: Stroke[]; h: number };
export type DividerBlock = { id: string; type: 'divider' };
/** Enlace a subpágina. */
export type LinkBlock = { id: string; type: 'link'; pageId: string };

/**
 * Bloque de una página. LaTeX en línea va dentro de `html`:
 * `<span class="tex" data-tex="E=mc^2"></span>`
 */
export type Block =
  TextBlock | TodoBlock | MathBlock | ImageBlock | DrawBlock | DividerBlock | LinkBlock;

export type BlockType = Block['type'];

export type PageBase = {
  id: string;
  parentId: string | null;
  title: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  deletedAt?: string;
};

export type Page = PageBase & { kind: 'page'; blocks: Block[] };

export type CenterMode = 'text' | 'draw' | 'image';

export type Center = {
  mode: CenterMode;
  /** Modo texto. */
  html: string;
  /** Modo lápiz. */
  strokes: Stroke[];
  h: number;
  /** Modo imagen. */
  fileId?: string;
  imgMode: 'postal' | 'fondo';
  cap: string;
  /** Fondo de la hoja (texto/lápiz). `bgDim` va de 0 a 0.75. */
  bgFileId?: string;
  bgScope: 'hoja' | 'tablero';
  bgDim: number;
};

export type NoteKind = 'md' | 'voice' | 'draw' | 'img';
export type NoteColor = 'amarillo' | 'rosa' | 'menta' | 'cielo' | 'lila' | 'papel';

export type Note = {
  id: string;
  kind: NoteKind;
  title: string;
  color: NoteColor;
  /** Posición normalizada 0..1 del centro de la tarjeta en el tablero. */
  x: number;
  y: number;
  /** Grupo: notas con el mismo `g` forman un montón (nota suelta: g = id). */
  g: string;
  /** md (puede incluir math, img, draw). */
  blocks?: Block[];
  /** draw */
  strokes?: Stroke[];
  h?: number;
  /** img */
  fileId?: string;
  cap?: string;
  /** voice */
  audioFileId?: string;
  dur?: number;
  text?: string;
  createdAt: string;
};

export type OrganicBackground = 'pizarra' | 'corcho' | 'papel' | 'noche' | 'menta';
export type OrganicFont = 'mano' | 'marcador' | 'limpia';

export type OrganicStyle = { bg: OrganicBackground; ink: string; font: OrganicFont };

export type OrganicPage = PageBase & {
  kind: 'organic';
  center: Center;
  notes: Note[];
  style: OrganicStyle;
};

/** Cualquier documento de página guardado. */
export type AnyPage = Page | OrganicPage;
export type PageKind = AnyPage['kind'];

export type Settings = {
  skin: 'auto' | 'light' | 'dark' | 'sepia';
  accent: string;
  font: 'sans' | 'serif' | 'mono';
  size: 's' | 'm' | 'l';
  width: 'normal' | 'wide';
  lang: 'es-CL' | 'es-ES' | 'es-MX' | 'en-US';
  penOnly: boolean;
};
