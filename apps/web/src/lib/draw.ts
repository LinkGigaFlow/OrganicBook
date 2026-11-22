import type { Stroke } from '@cuaderno/shared';
import { getStroke } from 'perfect-freehand';

/** Ancho lógico del lienzo: los trazos se guardan en esta escala y se ven igual en cualquier ancho. */
export const LOGICAL_WIDTH = 1000;
export const DEFAULT_DRAW_HEIGHT = 480;
/** Cuánto crece el lienzo con "Más espacio". */
export const EXTRA_SPACE = 260;
/** Radio del borrador, en unidades lógicas. */
export const ERASER_RADIUS = 16;
/** Primer color = tinta del tema. */
export const COLORS = ['ink', '#3b5bdb', '#e03131', '#2b8a3e', '#f08c00', '#ae3ec9'] as const;
export const HIGHLIGHT_ALPHA = 0.32;

export type Point = Stroke['pts'][number];

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Punto de pantalla → punto lógico (x, y en escala 1000, presión 0..1). */
export function toLogical(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number },
  pressure: number,
): Point {
  const sc = rect.width / LOGICAL_WIDTH || 1;
  const p = Math.min(1, Math.max(0, pressure));
  return [r1((clientX - rect.left) / sc), r1((clientY - rect.top) / sc), Math.round(p * 100) / 100];
}

/** Presión del puntero: real para el lápiz, fija (0.5) para mouse y dedo. */
export const pressureOf = (e: { pointerType: string; pressure: number }) =>
  e.pointerType === 'pen' ? e.pressure || 0.5 : 0.5;

/** Distancia de un punto al segmento a–b. */
function distToSegment(px: number, py: number, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len)) : 0;
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}

/** ¿Toca el borrador (en `q`) este trazo? Considera los segmentos y el grosor. */
export function hitsStroke(s: Stroke, q: Point, radius = ERASER_RADIUS): boolean {
  const reach = radius + strokeSize(s) / 2;
  const pts = s.pts;
  if (pts.length === 1) return Math.hypot(pts[0]![0] - q[0], pts[0]![1] - q[1]) <= reach;
  for (let i = 1; i < pts.length; i++) {
    if (distToSegment(q[0], q[1], pts[i - 1]!, pts[i]!) <= reach) return true;
  }
  return false;
}

/** Borrador por trazo: quita los trazos completos que toca. */
export function eraseAt(strokes: Stroke[], q: Point, radius = ERASER_RADIUS): Stroke[] {
  const out = strokes.filter((s) => !hitsStroke(s, q, radius));
  return out.length === strokes.length ? strokes : out;
}

/** Diámetro del trazo en unidades lógicas. */
export const strokeSize = (s: Stroke) => (s.t === 'hl' ? s.w * 4 : s.w * 1.6);

/** El mouse y el dedo guardan presión 0.5: en ese caso la presión se simula por velocidad. */
const hasRealPressure = (s: Stroke) => s.pts.some((p) => p[2] !== 0.5);

/** Contorno del trazo (perfect-freehand) en unidades lógicas. */
export function strokeOutline(s: Stroke, complete = true): number[][] {
  const hl = s.t === 'hl';
  return getStroke(s.pts, {
    size: strokeSize(s),
    thinning: hl ? 0 : 0.6,
    smoothing: 0.5,
    streamline: hl ? 0.6 : 0.45,
    simulatePressure: !hl && !hasRealPressure(s),
    last: complete,
    start: { cap: true },
    end: { cap: true },
  });
}

/** Contorno → trazado SVG/Path2D. */
export function outlineToPath(pts: number[][]): string {
  if (!pts.length) return '';
  const [first, ...rest] = pts;
  let d = `M${first![0]!.toFixed(1)} ${first![1]!.toFixed(1)}`;
  // Curvas por los puntos medios para un borde suave.
  for (let i = 0; i < rest.length; i++) {
    const a = pts[i]!;
    const b = rest[i]!;
    d += ` Q${a[0]!.toFixed(1)} ${a[1]!.toFixed(1)} ${((a[0]! + b[0]!) / 2).toFixed(1)} ${((a[1]! + b[1]!) / 2).toFixed(1)}`;
  }
  return d + ' Z';
}

export const resolveColor = (c: string, ink: string) => (c === 'ink' ? ink : c);

/** Dibuja un trazo en un contexto ya escalado a unidades lógicas. */
export function paintStroke(
  ctx: CanvasRenderingContext2D,
  s: Stroke,
  ink: string,
  complete = true,
) {
  const outline = strokeOutline(s, complete);
  if (!outline.length) return;
  ctx.globalAlpha = s.t === 'hl' ? HIGHLIGHT_ALPHA : 1;
  ctx.fillStyle = resolveColor(s.c, ink);
  ctx.fill(new Path2D(outlineToPath(outline)));
  ctx.globalAlpha = 1;
}

/** Ajusta el lienzo al ancho mostrado y devuelve la escala (px por unidad lógica). */
export function fitCanvas(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  logicalHeight: number,
  dpr = window.devicePixelRatio || 1,
): number {
  const sc = cssWidth / LOGICAL_WIDTH;
  const cssHeight = logicalHeight * sc;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  canvas.width = Math.max(1, Math.round(cssWidth * dpr));
  canvas.height = Math.max(1, Math.round(cssHeight * dpr));
  return sc;
}
