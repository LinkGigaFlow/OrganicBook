import type { Note, OrganicPage } from '@cuaderno/shared';
import { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { IconBook, IconPlay, IconPlus } from '../../components/ui/icons';
import { useFileUrl } from '../../lib/files';
import { sanitizeInline } from '../../lib/html';
import { texToHtml, useTexReady } from '../../lib/tex';
import { formatDuration } from '../voice/recorder';
import { dimmedBg, KIND_ICON, styleVars } from './look';
import {
  BOARD_STYLES,
  boardDims,
  cardCenter,
  dropTarget,
  firstMath,
  groupsOf,
  hasSheetBg,
  KIND_LABEL,
  linkPath,
  mdPreview,
  NOTE_COLORS,
  rotationOf,
} from './model';
import { StrokesThumb } from './StrokesThumb';

const WAVE = [6, 12, 18, 9, 15, 8, 20, 12, 7, 14, 10, 16];

/** Espera antes de arrastrar con el dedo (un deslizamiento rápido sigue desplazando la página). */
export const TOUCH_HOLD_MS = 240;
/** Movimiento mínimo (px) para empezar a arrastrar con mouse o lápiz. */
const MOUSE_SLOP = 6;
/** Movimiento (px) que cancela la espera táctil: el dedo está desplazando la página. */
const TOUCH_SLOP = 10;

type Props = {
  page: OrganicPage;
  /** Abre el lector en `index` (0 = centro, 1.. = notas). */
  onOpen: (index: number) => void;
  /** Abre un montón en modo cuaderno. */
  onOpenPile: (g: string) => void;
  onAdd: (anchor: DOMRect) => void;
  onDropImages: (files: File[]) => void;
  /** Suelta un montón o nota en una posición normalizada (0..1). */
  onMoveGroup: (g: string, x: number, y: number) => void;
  /** Suelta un montón o nota sobre otro: se apilan. */
  onStack: (moving: string, target: string) => void;
};

type Drag = {
  g: string;
  pointer: number;
  touch: boolean;
  sx: number;
  sy: number;
  left: number;
  top: number;
  on: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  el: HTMLElement;
};
type DragView = { g: string; left: number; top: number; target: string | null };

/** Tablero: centro fijo, montones y notas alrededor, y líneas curvas hasta el centro. */
export function Board({
  page,
  onOpen,
  onOpenPile,
  onAdd,
  onDropImages,
  onMoveGroup,
  onStack,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(0);
  const c = page.center;
  const sheetBg = useFileUrl(hasSheetBg(c) ? c.bgFileId : undefined).url;
  const centerImg = useFileUrl(c.mode === 'image' ? c.fileId : undefined).url;
  const [over, setOver] = useState(false);
  const [view, setView] = useState<DragView | null>(null);
  const viewRef = useRef<DragView | null>(null);
  const drag = useRef<Drag | null>(null);
  /** Tras soltar un arrastre, el clic que sigue no abre la nota. */
  const justDragged = useRef(false);
  const stopDrag = useRef<() => void>(() => {});

  const show = (v: DragView | null) => {
    viewRef.current = v;
    setView(v);
  };

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // Mientras se arrastra con el dedo, la página no se desplaza.
    const noScroll = (e: TouchEvent) => {
      if (drag.current?.on) e.preventDefault();
    };
    el.addEventListener('touchmove', noScroll, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener('touchmove', noScroll);
      stopDrag.current();
    };
  }, []);

  const D = boardDims(W || 800);
  const style = BOARD_STYLES[page.style.bg] ?? BOARD_STYLES.pizarra;

  // Fondo del tablero: estilo, foto de fondo de todo el tablero o imagen del centro "de fondo".
  const boardStyle: CSSProperties = { ...styleVars(page), height: D.H };
  if (sheetBg && c.bgScope === 'tablero') {
    boardStyle.backgroundImage = dimmedBg(sheetBg, c.bgDim);
    boardStyle.backgroundSize = 'cover';
    boardStyle.backgroundPosition = 'center';
  } else if (c.mode === 'image' && centerImg && c.imgMode === 'fondo') {
    boardStyle.backgroundImage = dimmedBg(centerImg, 0.4);
    boardStyle.backgroundSize = 'cover';
    boardStyle.backgroundPosition = 'center';
  } else if (style.img) {
    boardStyle.backgroundImage = style.img;
    boardStyle.backgroundSize = style.size ?? 'auto';
  }

  const groups = groupsOf(page.notes);
  // Centro (px) de cada grupo; el que se arrastra sigue al puntero.
  const centers = groups.map(({ g, notes }) =>
    view?.g === g
      ? ([view.left + D.nw / 2, view.top + D.nh / 2] as [number, number])
      : cardCenter(notes[0]!.x, notes[0]!.y, D),
  );

  /* ---------- arrastre libre ---------- */
  const startDrag = (d: Drag) => {
    d.on = true;
    try {
      d.el.setPointerCapture(d.pointer);
    } catch {
      /* el puntero ya no existe */
    }
    if (d.touch) navigator.vibrate?.(12);
    show({ g: d.g, left: d.left, top: d.top, target: null });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLElement>, g: string, i: number) => {
    if (e.button !== 0 || drag.current) return;
    const [x, y] = centers[i]!;
    const d: Drag = {
      g,
      pointer: e.pointerId,
      touch: e.pointerType === 'touch',
      sx: e.clientX,
      sy: e.clientY,
      left: x - D.nw / 2,
      top: y - D.nh / 2,
      on: false,
      timer: null,
      el: e.currentTarget,
    };
    drag.current = d;
    // Con el dedo: mantener presionado; con mouse o lápiz: arrastrar directo.
    if (d.touch) d.timer = setTimeout(() => drag.current === d && startDrag(d), TOUCH_HOLD_MS);

    const others = groups
      .map((gr, k) => ({ g: gr.g, center: centers[k]! }))
      .filter((o) => o.g !== g);

    const cleanup = () => {
      if (d.timer) clearTimeout(d.timer);
      if (drag.current === d) drag.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancelled);
    };
    const cancel = () => {
      cleanup();
      if (viewRef.current) show(null);
    };
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== d.pointer) return;
      const dx = ev.clientX - d.sx;
      const dy = ev.clientY - d.sy;
      if (!d.on) {
        if (d.touch) {
          // El dedo se movió antes de la espera: está desplazando la página.
          if (Math.hypot(dx, dy) > TOUCH_SLOP) cancel();
          return;
        }
        if (Math.hypot(dx, dy) < MOUSE_SLOP) return;
        startDrag(d);
      }
      ev.preventDefault();
      const left = Math.min(Math.max(d.left + dx, 4), D.W - D.nw - 4);
      const top = Math.min(Math.max(d.top + dy, 4), D.H - D.nh - 4);
      const target = dropTarget([left + D.nw / 2, top + D.nh / 2], others, D.nw);
      show({ g: d.g, left, top, target });
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== d.pointer) return;
      const was = d.on;
      cleanup();
      const v = viewRef.current;
      if (!was || !v) return;
      justDragged.current = true;
      setTimeout(() => (justDragged.current = false), 0);
      if (v.target) onStack(d.g, v.target);
      else onMoveGroup(d.g, (v.left + D.nw / 2) / D.W, (v.top + D.nh / 2) / D.H);
      show(null);
    };
    const cancelled = (ev: PointerEvent) => {
      if (ev.pointerId === d.pointer) cancel();
    };
    stopDrag.current = cleanup;
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancelled);
  };

  return (
    <div
      ref={box}
      className={'board' + (over ? ' over' : '') + (view ? ' dragging' : '')}
      style={boardStyle}
      data-testid="board"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
        if (!files.length) return;
        e.preventDefault();
        onDropImages(files);
      }}
    >
      {W ? (
        <svg className="links" viewBox={`0 0 ${D.W} ${D.H}`} aria-hidden="true">
          {centers.map((p, i) => {
            const l = linkPath(p, D, i % 2 ? 0.16 : -0.16);
            return l ? (
              <g key={groups[i]!.g}>
                <path d={l.d} />
                <circle cx={l.end[0].toFixed(1)} cy={l.end[1].toFixed(1)} r="4.5" />
              </g>
            ) : null;
          })}
        </svg>
      ) : null}

      <Center page={page} D={D} sheetBg={sheetBg} centerImg={centerImg} onOpen={() => onOpen(0)} />

      {groups.map(({ g, notes }, i) => {
        const [x, y] = centers[i]!;
        const top = notes[0]!;
        const index = page.notes.indexOf(top);
        const pile = notes.length > 1;
        const open = () => (pile ? onOpenPile(g) : onOpen(index + 1));
        const title = top.title || KIND_LABEL[top.kind];
        return (
          <div
            key={g}
            className={
              'og' +
              (pile ? ' pile' : '') +
              (view?.g === g ? ' dragging' : '') +
              (view?.target === g ? ' drop' : '')
            }
            role="button"
            tabIndex={0}
            aria-label={
              pile ? `Montón de ${notes.length} notas: ${title}` : `${title}, nota ${index + 1}`
            }
            data-g={g}
            style={{ left: x - D.nw / 2, top: y - D.nh / 2, width: D.nw, height: D.nh }}
            onPointerDown={(e) => onPointerDown(e, g, i)}
            onContextMenu={(e) => e.preventDefault()}
            onClick={() => {
              if (!justDragged.current) open();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open();
              }
            }}
          >
            {pile
              ? notes.slice(1, 3).map((n, k) => (
                  <span
                    key={n.id}
                    className="layer"
                    aria-hidden="true"
                    style={
                      {
                        '--nc': NOTE_COLORS[n.color] ?? NOTE_COLORS.amarillo,
                        '--lr': k ? '-6deg' : '5deg',
                        '--lx': k ? '-7px' : '7px',
                        '--ly': k ? '5px' : '3px',
                      } as CSSProperties
                    }
                  />
                ))
              : null}
            <NoteFace note={top} number={pile ? null : index + 1} ink={page.style.ink} />
            {pile ? (
              <span className="pcount" aria-hidden="true">
                <IconBook />
                {notes.length}
              </span>
            ) : null}
          </div>
        );
      })}

      <button
        type="button"
        className="onew"
        aria-label="Añadir nota"
        onClick={(e) => onAdd(e.currentTarget.getBoundingClientRect())}
      >
        <IconPlus />
      </button>
    </div>
  );
}

function Center({
  page,
  D,
  sheetBg,
  centerImg,
  onOpen,
}: {
  page: OrganicPage;
  D: ReturnType<typeof boardDims>;
  sheetBg: string | null;
  centerImg: string | null;
  onOpen: () => void;
}) {
  const c = page.center;
  const sheet = !!sheetBg && c.bgScope === 'hoja';
  let inner: ReactNode;
  if (c.mode === 'draw' && (c.strokes.length || sheet)) {
    inner = (
      <StrokesThumb
        strokes={c.strokes}
        ink={page.style.ink}
        sheetH={sheet ? c.h : undefined}
        imageUrl={sheet ? sheetBg : null}
        dim={c.bgDim}
      />
    );
  } else if (c.mode === 'image' && c.fileId && c.imgMode === 'postal') {
    inner = (
      <figure className="postal">
        {centerImg ? <img src={centerImg} alt="" draggable={false} /> : <div className="ph-img" />}
        <figcaption dangerouslySetInnerHTML={{ __html: sanitizeInline(c.cap) }} />
      </figure>
    );
  } else {
    const html = c.mode === 'text' ? c.html : c.mode === 'image' && c.fileId ? c.cap : '';
    inner = (
      <div className="ctext">
        {html.trim() ? (
          <span dangerouslySetInnerHTML={{ __html: sanitizeInline(html) }} />
        ) : (
          <span className="ph">
            {c.mode === 'draw'
              ? 'Toca para dibujar el tema central'
              : 'Toca para escribir, dibujar o poner una imagen'}
          </span>
        )}
      </div>
    );
  }
  const style: CSSProperties & Record<string, string | number> = {
    left: D.W / 2 - D.cw / 2,
    top: D.H / 2 - D.ch / 2,
    width: D.cw,
    height: D.ch,
    '--ch': `${D.ch}px`,
  };
  if (sheet && c.mode === 'text') style.backgroundImage = dimmedBg(sheetBg!, c.bgDim);
  return (
    <div
      className={'ocenter' + (sheet ? ' hasbg' : '') + ` m-${c.mode}`}
      role="button"
      tabIndex={0}
      aria-label="Tema central"
      style={style}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      {inner}
    </div>
  );
}

/** Cara de una tarjeta: encabezado y vista previa según el tipo. */
function NoteFace({ note: n, number, ink }: { note: Note; number: number | null; ink: string }) {
  const ready = useTexReady();
  const img = useFileUrl(n.kind === 'img' ? n.fileId : undefined).url;
  const title = n.title || KIND_LABEL[n.kind];
  let preview: ReactNode;

  if (n.kind === 'md') {
    const text = mdPreview(n.blocks);
    const math = firstMath(n.blocks);
    preview = (
      <>
        {math ? (
          <div
            className="pmath"
            data-ready={ready}
            dangerouslySetInnerHTML={{ __html: texToHtml(math.tex, true) }}
          />
        ) : null}
        {text || !math ? <p className="ptext">{text || <i>Vacía</i>}</p> : null}
      </>
    );
  } else if (n.kind === 'voice') {
    preview = (
      <>
        <div className="pvoice">
          <IconPlay />
          <i aria-hidden="true">
            {WAVE.map((h, k) => (
              <b key={k} style={{ height: h }} />
            ))}
          </i>
          <span>{n.audioFileId ? formatDuration(n.dur ?? 0) : 'Sin audio'}</span>
        </div>
        {n.text ? <p className="ptext">{n.text.slice(0, 200)}</p> : null}
      </>
    );
  } else if (n.kind === 'draw') {
    preview = (
      <div className="thumb">
        <StrokesThumb strokes={n.strokes ?? []} ink={ink} />
      </div>
    );
  } else {
    preview = (
      <div className="thumb">{img ? <img src={img} alt="" draggable={false} /> : null}</div>
    );
  }

  return (
    <div
      className={`onote k-${n.kind}`}
      data-note={n.id}
      style={
        {
          '--nc': NOTE_COLORS[n.color] ?? NOTE_COLORS.amarillo,
          '--r': `${rotationOf(n.id)}deg`,
        } as CSSProperties
      }
    >
      <div className="ohead">
        {KIND_ICON[n.kind]}
        <b>{title}</b>
        {number ? <span className="onum">{number}</span> : null}
      </div>
      {preview}
    </div>
  );
}
