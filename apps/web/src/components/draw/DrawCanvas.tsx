import type { Stroke } from '@cuaderno/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../app/store';
import {
  IconEraser,
  IconHighlighter,
  IconPen,
  IconPenOnly,
  IconTaller,
  IconTrash,
  IconUndo,
} from '../../components/ui/icons';
import { toast } from '../../components/ui/toast-store';
import {
  COLORS,
  DEFAULT_DRAW_HEIGHT,
  eraseAt,
  EXTRA_SPACE,
  fitCanvas,
  paintStroke,
  pressureOf,
  toLogical,
} from '../../lib/draw';

type Tool = 'pen' | 'hl' | 'er';
const COLOR_NAMES: Record<string, string> = {
  ink: 'tinta',
  '#3b5bdb': 'azul',
  '#e03131': 'rojo',
  '#2b8a3e': 'verde',
  '#f08c00': 'naranja',
  '#ae3ec9': 'morado',
};
const MAX_UNDO = 40;

type Drag =
  | { kind: 'stroke'; id: number; stroke: Stroke }
  | { kind: 'erase'; id: number }
  | { kind: 'scroll'; id: number; y: number };

export type DrawCanvasProps = {
  strokes: Stroke[];
  /** Alto lógico (el ancho lógico siempre es 1000). */
  h: number;
  onStrokes: (next: Stroke[]) => void;
  onHeight: (h: number) => void;
  /** Se llama al tocar el lienzo o la barra (p. ej. para seleccionar el bloque). */
  onActivate?: () => void;
  /** Imagen de fondo del lienzo (CSS `background-image`), p. ej. la foto del centro. */
  background?: string;
  className?: string;
  /** Atributos extra del contenedor (p. ej. data-id del bloque). */
  attrs?: Record<string, string | undefined>;
};

/**
 * Lienzo de dibujo: lápiz con presión, resaltador, borrador por trazo, colores, grosor,
 * deshacer, borrar todo, "más espacio" y "solo el lápiz dibuja". Se usa en el bloque de
 * dibujo y en el cuaderno orgánico.
 */
export function DrawCanvas({
  strokes,
  h: rawH,
  onStrokes,
  onHeight,
  onActivate,
  background,
  className,
  attrs,
}: DrawCanvasProps) {
  const h = rawH || DEFAULT_DRAW_HEIGHT;

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState<string>('ink');
  const [size, setSize] = useState(3);
  const [undoCount, setUndoCount] = useState(0);
  const penOnly = useAppStore((s) => s.settings.penOnly);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const padRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Lienzo fuera de pantalla con los trazos ya terminados (no se repintan en cada movimiento). */
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const scaleRef = useRef(1);
  /** Trazos vigentes (durante el borrador cambian antes de guardarse). */
  const working = useRef<Stroke[]>(strokes);
  const drag = useRef<Drag | null>(null);
  const hist = useRef<Stroke[][]>([]);
  const raf = useRef(0);

  const ink = () => (padRef.current ? getComputedStyle(padRef.current).color : '#1f1f1f');
  const dpr = () => window.devicePixelRatio || 1;

  /** Compone la imagen: trazos terminados + trazo en curso. */
  const frame = useCallback(() => {
    raf.current = 0;
    const cv = canvasRef.current;
    const base = baseRef.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx || !base) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(base, 0, 0);
    const d = drag.current;
    if (d?.kind === 'stroke') {
      const k = dpr() * scaleRef.current;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      paintStroke(ctx, d.stroke, ink(), false);
    }
  }, []);

  const requestFrame = useCallback(() => {
    if (!raf.current) raf.current = requestAnimationFrame(frame);
  }, [frame]);

  /** Repinta los trazos terminados en el lienzo base. */
  const paintBase = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const base = (baseRef.current ??= document.createElement('canvas'));
    base.width = cv.width;
    base.height = cv.height;
    const ctx = base.getContext('2d');
    if (!ctx) return;
    const k = dpr() * scaleRef.current;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const color = ink();
    for (const s of working.current) paintStroke(ctx, s, color);
    frame();
  }, [frame]);

  /** Ajusta el lienzo al ancho disponible: misma escala lógica en cualquier pantalla. */
  const fit = useCallback(() => {
    const pad = padRef.current;
    const cv = canvasRef.current;
    if (!pad || !cv || !pad.clientWidth) return;
    scaleRef.current = fitCanvas(cv, pad.clientWidth, h);
    pad.style.height = `${h * scaleRef.current}px`;
    paintBase();
  }, [h, paintBase]);

  // Cambios guardados (o deshechos desde el editor) → repintar.
  useEffect(() => {
    if (drag.current) return;
    working.current = strokes;
    paintBase();
  }, [strokes, paintBase]);

  useEffect(() => {
    const pad = padRef.current;
    if (!pad) return;
    fit();
    const ro = new ResizeObserver(() => fit());
    ro.observe(pad);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => paintBase();
    mq.addEventListener('change', onScheme);
    return () => {
      ro.disconnect();
      mq.removeEventListener('change', onScheme);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [fit, paintBase]);

  const snapshot = () => {
    hist.current.push(working.current);
    if (hist.current.length > MAX_UNDO) hist.current.shift();
    setUndoCount(hist.current.length);
  };

  const commit = (next: Stroke[]) => {
    working.current = next;
    onStrokes(next);
  };

  const pointAt = (e: {
    clientX: number;
    clientY: number;
    pointerType: string;
    pressure: number;
  }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return toLogical(e.clientX, e.clientY, r, pressureOf(e));
  };

  const erase = (e: React.PointerEvent | PointerEvent) => {
    const next = eraseAt(working.current, pointAt(e));
    if (next !== working.current) {
      working.current = next;
      paintBase();
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || drag.current) return;
    onActivate?.();
    if (penOnly && e.pointerType === 'touch') {
      // Con "solo el lápiz dibuja", el dedo desplaza la página en vez de rayar.
      drag.current = { kind: 'scroll', id: e.pointerId, y: e.clientY };
      return;
    }
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* puntero sintético */
    }
    snapshot();
    if (tool === 'er') {
      drag.current = { kind: 'erase', id: e.pointerId };
      erase(e);
      return;
    }
    drag.current = {
      kind: 'stroke',
      id: e.pointerId,
      stroke: { t: tool, c: color, w: size, pts: [pointAt(e)] },
    };
    requestFrame();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (d.kind === 'scroll') {
      window.scrollBy(0, d.y - e.clientY);
      d.y = e.clientY;
      return;
    }
    const native = e.nativeEvent;
    const evs = native.getCoalescedEvents?.() ?? [];
    for (const ev of evs.length ? evs : [native]) {
      if (d.kind === 'erase') {
        erase(ev);
        continue;
      }
      const q = pointAt(ev);
      const last = d.stroke.pts[d.stroke.pts.length - 1]!;
      if (Math.hypot(q[0] - last[0], q[1] - last[1]) < 1) continue;
      d.stroke.pts.push(q);
    }
    if (d.kind === 'stroke') requestFrame();
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.kind === 'scroll') return;
    if (d.kind === 'stroke') {
      commit([...working.current, d.stroke]);
      paintBase();
      return;
    }
    // Borrador: si no tocó nada, se descarta el punto de deshacer.
    const before = hist.current[hist.current.length - 1];
    if (before === working.current) {
      hist.current.pop();
      setUndoCount(hist.current.length);
    } else commit(working.current);
  };

  const undo = () => {
    const prev = hist.current.pop();
    setUndoCount(hist.current.length);
    if (prev) commit(prev);
  };

  const clearAll = () => {
    if (!working.current.length) return;
    snapshot();
    commit([]);
    toast('Lienzo borrado. Usa Deshacer si te arrepientes.');
  };

  const pickColor = (c: string) => {
    setColor(c);
    if (tool === 'er') setTool('pen');
  };

  const toolBtn = (t: Tool, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      className={tool === t ? 'on' : ''}
      aria-pressed={tool === t}
      title={label}
      aria-label={label}
      onClick={() => setTool(t)}
    >
      {icon}
    </button>
  );

  return (
    <div {...attrs} className={'draw' + (className ? ' ' + className : '')} contentEditable={false}>
      <div className="dtools" role="toolbar" aria-label="Herramientas de dibujo">
        {toolBtn('pen', 'Lápiz', <IconPen />)}
        {toolBtn('hl', 'Resaltador', <IconHighlighter />)}
        {toolBtn('er', 'Borrador', <IconEraser />)}
        <span className="sep" />
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={'sw' + (color === c ? ' on' : '')}
            style={{ '--c': c === 'ink' ? 'var(--ink)' : c } as React.CSSProperties}
            aria-pressed={color === c}
            aria-label={`Color ${COLOR_NAMES[c]}`}
            title={`Color ${COLOR_NAMES[c]}`}
            onClick={() => pickColor(c)}
          />
        ))}
        <input
          type="range"
          min={1}
          max={12}
          value={size}
          aria-label="Grosor"
          title={`Grosor ${size}`}
          onChange={(e) => setSize(Number(e.target.value))}
        />
        <span className="sep" />
        <button
          type="button"
          title="Deshacer"
          aria-label="Deshacer"
          disabled={!undoCount}
          onClick={undo}
        >
          <IconUndo />
        </button>
        <button type="button" title="Borrar todo" aria-label="Borrar todo" onClick={clearAll}>
          <IconTrash />
        </button>
        <button
          type="button"
          title="Más espacio"
          aria-label="Más espacio"
          onClick={() => onHeight(h + EXTRA_SPACE)}
        >
          <IconTaller />
        </button>
        <button
          type="button"
          className={penOnly ? 'on' : ''}
          aria-pressed={penOnly}
          title="Solo el lápiz dibuja (los dedos desplazan la página)"
          aria-label="Solo el lápiz dibuja"
          onClick={() => {
            updateSettings({ penOnly: !penOnly });
            toast(
              penOnly ? 'Ahora el dedo también dibuja' : 'Solo el lápiz dibuja; el dedo desplaza',
            );
          }}
        >
          <IconPenOnly />
        </button>
      </div>
      <div
        ref={padRef}
        className={'pad' + (background ? ' hasbg' : '')}
        style={background ? { backgroundImage: background } : undefined}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Dibujo con ${strokes.length} ${strokes.length === 1 ? 'trazo' : 'trazos'}`}
          data-strokes={strokes.length}
          className={tool === 'er' ? 'erasing' : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onLostPointerCapture={onPointerEnd}
        />
      </div>
    </div>
  );
}
