import type { Note, OrganicPage } from '@cuaderno/shared';
import { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { IconPlay, IconPlus } from '../../components/ui/icons';
import { useFileUrl } from '../../lib/files';
import { sanitizeInline } from '../../lib/html';
import { texToHtml, useTexReady } from '../../lib/tex';
import { formatDuration } from '../voice/recorder';
import {
  BOARD_STYLES,
  boardDims,
  cardCenter,
  firstMath,
  hasSheetBg,
  KIND_LABEL,
  linkPath,
  mdPreview,
  NOTE_COLORS,
  rotationOf,
} from './model';
import { dimmedBg, KIND_ICON, styleVars } from './look';
import { StrokesThumb } from './StrokesThumb';

const WAVE = [6, 12, 18, 9, 15, 8, 20, 12, 7, 14, 10, 16];

type Props = {
  page: OrganicPage;
  onOpen: (index: number) => void;
  onAdd: (anchor: DOMRect) => void;
  onDropImages: (files: File[]) => void;
};

/** Tablero: centro fijo, tarjetas alrededor y líneas curvas hasta el centro. */
export function Board({ page, onOpen, onAdd, onDropImages }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(0);
  const c = page.center;
  const sheetBg = useFileUrl(hasSheetBg(c) ? c.bgFileId : undefined).url;
  const centerImg = useFileUrl(c.mode === 'image' ? c.fileId : undefined).url;
  const [over, setOver] = useState(false);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
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

  const positions = page.notes.map((n) => cardCenter(n.x, n.y, D));

  return (
    <div
      ref={box}
      className={'board' + (over ? ' over' : '')}
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
          {positions.map((p, i) => {
            const l = linkPath(p, D, i % 2 ? 0.16 : -0.16);
            return l ? (
              <g key={page.notes[i]!.id}>
                <path d={l.d} />
                <circle cx={l.end[0].toFixed(1)} cy={l.end[1].toFixed(1)} r="4.5" />
              </g>
            ) : null;
          })}
        </svg>
      ) : null}

      <Center page={page} D={D} sheetBg={sheetBg} centerImg={centerImg} onOpen={() => onOpen(0)} />

      {page.notes.map((n, i) => {
        const [x, y] = positions[i]!;
        return (
          <NoteCard
            key={n.id}
            note={n}
            index={i}
            ink={page.style.ink}
            style={{ left: x - D.nw / 2, top: y - D.nh / 2, width: D.nw, height: D.nh }}
            onOpen={() => onOpen(i + 1)}
          />
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

function NoteCard({
  note: n,
  index,
  ink,
  style,
  onOpen,
}: {
  note: Note;
  index: number;
  ink: string;
  style: CSSProperties;
  onOpen: () => void;
}) {
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
      className={`og onote k-${n.kind}`}
      role="button"
      tabIndex={0}
      aria-label={`${title}, nota ${index + 1}`}
      data-note={n.id}
      style={
        {
          ...style,
          '--nc': NOTE_COLORS[n.color] ?? NOTE_COLORS.amarillo,
          '--r': `${rotationOf(n.id)}deg`,
        } as CSSProperties
      }
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="ohead">
        {KIND_ICON[n.kind]}
        <b>{title}</b>
        <span className="onum">{index + 1}</span>
      </div>
      {preview}
    </div>
  );
}
