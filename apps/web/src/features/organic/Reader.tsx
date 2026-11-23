import type { OrganicPage } from '@cuaderno/shared';
import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  IconClose,
  IconLeft,
  IconOrbit,
  IconOut,
  IconRight,
  IconTrash,
} from '../../components/ui/icons';
import { toast } from '../../components/ui/toast-store';
import { Modal } from '../../components/ui/Modal';
import { KIND_ICON, styleVars } from './look';
import {
  CenterEditor,
  DrawNoteEditor,
  ImageEditor,
  MdNoteEditor,
  type PickImage,
  VoiceEditor,
} from './editors';
import { COLOR_KEYS, cycle, KIND_LABEL, moveInSequence, NOTE_COLORS, takeOut } from './model';
import type { OrganicDoc } from './useOrganicDoc';

/** Distancia mínima (px) de un deslizamiento con el dedo para pasar de nota. */
export const SWIPE_MIN = 70;

const isEditable = (el: Element | null) =>
  !!el && ((el as HTMLElement).isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

type Props = {
  doc: OrganicDoc;
  /** Montón abierto en modo cuaderno (solo sus hojas), o `null` para todo el cuaderno. */
  pile: string | null;
  index: number;
  onIndex: (i: number) => void;
  /** El montón cambió de grupo (se sacó la hoja que le daba nombre). */
  onPile: (g: string) => void;
  onClose: () => void;
  pickImage: PickImage;
  pageTitle: string;
  onPageTitle: (t: string) => void;
  createSubpage: () => Promise<string>;
  openSubpage: (id: string) => void;
};

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Duración de la animación de pasar hoja (ms). */
const LEAF_MS = 600;

/**
 * Lector: recorre centro → nota 1 → … → centro, con edición según el tipo. Con `pile`, es el
 * modo cuaderno: solo las hojas del montón, en papel liso con espiral.
 */
export function Reader({
  doc,
  pile,
  index,
  onIndex,
  onPile,
  onClose,
  pickImage,
  pageTitle,
  onPageTitle,
  createSubpage,
  openSubpage,
}: Props) {
  const page: OrganicPage = doc.doc;
  const sheets = pile ? page.notes.filter((n) => n.g === pile) : null;
  const count = sheets ? sheets.length : page.notes.length + 1;
  const i = Math.max(0, Math.min(index, count - 1));
  const note = sheets ? (sheets[i] ?? null) : i > 0 ? page.notes[i - 1]! : null;
  /** Posición de la primera nota en el recorrido (con el centro, las notas empiezan en 1). */
  const first = sheets ? 0 : 1;
  const [dir, setDir] = useState(0);
  const [leaf, setLeaf] = useState<{ key: number; dir: number; title: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const titleOf = (n: typeof note) => (n ? n.title || KIND_LABEL[n.kind] : '');

  /** Cambia de nota; en modo cuaderno, una hoja gira sobre el borde izquierdo. */
  const goTo = (k: number, d: number) => {
    if (k === i) return;
    setDir(d);
    if (sheets && !reducedMotion()) {
      const next = sheets[k] ?? null;
      setLeaf({ key: Date.now(), dir: d, title: titleOf(d > 0 ? note : next) });
    }
    onIndex(k);
  };
  const go = (d: number) => {
    if (count < 2) return;
    goTo(cycle(i, d, count), d);
  };

  // Un montón que se queda sin hojas cierra el lector.
  useEffect(() => {
    if (sheets && !sheets.length) onClose();
  });
  const goRef = useRef(go);
  const closeRef = useRef(onClose);
  useLayoutEffect(() => {
    goRef.current = go;
    closeRef.current = onClose;
  });

  // Teclado: flechas para navegar y Esc para cerrar (no mientras se escribe).
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.defaultPrevented || document.querySelector('.modal, .pop')) return;
      if (isEditable(document.activeElement)) return;
      if (e.key === 'ArrowRight') goRef.current(1);
      else if (e.key === 'ArrowLeft') goRef.current(-1);
      else if (e.key === 'Escape') closeRef.current();
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);

  // Al abrir: foco en el lector (para el teclado) y sin desplazar la página de atrás.
  useEffect(() => {
    // Si un editor ya tomó el foco (nota nueva), se respeta.
    if (!card.current?.contains(document.activeElement))
      card.current?.focus({ preventScroll: true });
    document.body.classList.add('reading');
    return () => document.body.classList.remove('reading');
  }, []);

  const title = note ? note.title : pageTitle;
  const kindLabel = note ? KIND_LABEL[note.kind] : 'Tema central';
  const headColor = note ? (NOTE_COLORS[note.color] ?? NOTE_COLORS.amarillo) : 'var(--obg)';
  const headInk = note ? '#2a2a2a' : 'var(--oink)';

  const removeNote = () => {
    if (!note) return;
    doc.update((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== note.id) }));
    setConfirmDelete(false);
    setDir(0);
    setLeaf(null);
    if (sheets && sheets.length <= 1) onClose();
    else onIndex(Math.min(i, count - 2));
  };

  const move = (d: -1 | 1) => {
    if (!note) return;
    const j = i + d;
    if (j < first || j >= count) return;
    doc.update((p) => ({ ...p, notes: moveInSequence(p.notes, note.id, d, pile) }));
    setDir(0);
    setLeaf(null);
    onIndex(j);
  };

  /** "Sacar del montón": la nota queda suelta al lado. Con una sola hoja, se cierra. */
  const takeOutNote = () => {
    if (!note || !sheets) return;
    doc.update((p) => ({ ...p, notes: takeOut(p.notes, note.id) }));
    const rest = sheets.filter((n) => n.id !== note.id);
    if (note.id === pile && rest[0]) onPile(rest[0].id);
    toast('Nota sacada del montón');
    setLeaf(null);
    if (sheets.length - 1 < 2) onClose();
    else onIndex(Math.min(i, sheets.length - 2));
  };

  let body: React.ReactNode;
  if (!note) {
    body = <CenterEditor page={page} onChange={doc.updateCenter} pickImage={pickImage} />;
  } else if (note.kind === 'md') {
    body = (
      <MdNoteEditor
        note={note}
        onBlocks={(blocks) => doc.updateNote(note.id, { blocks })}
        createSubpage={createSubpage}
        openSubpage={openSubpage}
      />
    );
  } else if (note.kind === 'draw') {
    body = <DrawNoteEditor note={note} onChange={(p) => doc.updateNote(note.id, p)} />;
  } else if (note.kind === 'img') {
    body = (
      <ImageEditor
        fileId={note.fileId}
        cap={note.cap ?? ''}
        capPlaceholder="Añade una descripción"
        pickImage={pickImage}
        onFile={(fileId) => doc.updateNote(note.id, { fileId })}
        onCap={(cap) => doc.updateNote(note.id, { cap })}
      />
    );
  } else {
    body = <VoiceEditor note={note} onChange={(p) => doc.updateNote(note.id, p)} />;
  }

  return createPortal(
    <div
      className="reader"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={card}
        className={'rcard' + (sheets ? ' nb' : '')}
        role="dialog"
        aria-modal="true"
        aria-label={
          sheets ? `Hoja ${i + 1} de ${count}` : note ? `Nota ${i} de ${count - 1}` : 'Tema central'
        }
        tabIndex={-1}
        onTouchStart={(e) => {
          const t = e.touches[0];
          const target = e.target as Element;
          if (
            !t ||
            e.touches.length > 1 ||
            target.closest('.pad, .dtools, input, textarea, select')
          ) {
            swipe.current = null;
            return;
          }
          swipe.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(e) => {
          const s = swipe.current;
          swipe.current = null;
          const t = e.changedTouches[0];
          if (!s || !t) return;
          const dx = t.clientX - s.x;
          const dy = t.clientY - s.y;
          if (Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
        }}
        style={{ ...styleVars(page), '--hc': headColor, '--hink': headInk } as CSSProperties}
      >
        <div className="rhead">
          <span className="rkind" aria-hidden="true">
            {note ? KIND_ICON[note.kind] : <IconOrbit />}
          </span>
          <input
            key={note?.id ?? 'center'}
            className="rtitle"
            aria-label="Título"
            placeholder={kindLabel}
            defaultValue={title}
            onChange={(e) =>
              note
                ? doc.updateNote(note.id, { title: e.target.value })
                : onPageTitle(e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
          <span className="rpos" aria-live="polite">
            {sheets ? `Hoja ${i + 1} de ${count}` : note ? `${i} de ${count - 1}` : 'Centro'}
          </span>
          <button type="button" aria-label="Volver al cuaderno" onClick={onClose}>
            <IconClose />
          </button>
        </div>

        {note ? (
          <div className="rtools">
            {COLOR_KEYS.map((c) => (
              <button
                key={c}
                type="button"
                className={'nc' + (note.color === c ? ' on' : '')}
                style={{ '--c': NOTE_COLORS[c] } as CSSProperties}
                aria-label={`Color ${c}`}
                aria-pressed={note.color === c}
                onClick={() => doc.updateNote(note.id, { color: c })}
              />
            ))}
            <span className="grow" />
            {sheets ? (
              <button
                type="button"
                aria-label="Sacar del montón"
                title="Sacar del montón"
                onClick={takeOutNote}
              >
                <IconOut />
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Mover antes"
              title="Mover antes"
              disabled={i <= first}
              onClick={() => move(-1)}
            >
              <IconLeft />
            </button>
            <button
              type="button"
              aria-label="Mover después"
              title="Mover después"
              disabled={i >= count - 1}
              onClick={() => move(1)}
            >
              <IconRight />
            </button>
            <button
              type="button"
              className="danger"
              aria-label="Eliminar nota"
              title="Eliminar nota"
              onClick={() => setConfirmDelete(true)}
            >
              <IconTrash />
            </button>
          </div>
        ) : null}

        <div className="rstage">
          <div
            key={note?.id ?? 'center'}
            className={'rbody' + (!sheets && dir > 0 ? ' inR' : !sheets && dir < 0 ? ' inL' : '')}
            data-testid="reader-body"
          >
            {body}
          </div>
          {leaf ? (
            <div
              key={leaf.key}
              className={'leaf ' + (leaf.dir > 0 ? 'fwd' : 'back')}
              aria-hidden="true"
              style={{ animationDuration: `${LEAF_MS}ms` }}
              onAnimationEnd={() => setLeaf((l) => (l?.key === leaf.key ? null : l))}
            >
              <b>{leaf.title}</b>
            </div>
          ) : null}
        </div>

        <div className="rnav">
          <button type="button" aria-label="Anterior" onClick={() => go(-1)} disabled={count < 2}>
            <IconLeft />
            <span>Anterior</span>
          </button>
          <div className="dots" role="tablist" aria-label={sheets ? 'Hojas' : 'Notas'}>
            {Array.from({ length: count }, (_, k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={k === i}
                className={(k === i ? 'on' : '') + (!sheets && k === 0 ? ' c' : '')}
                aria-label={sheets ? `Hoja ${k + 1}` : k ? `Nota ${k}` : 'Centro'}
                onClick={() => goTo(k, k > i ? 1 : -1)}
              />
            ))}
          </div>
          <button type="button" aria-label="Siguiente" onClick={() => go(1)} disabled={count < 2}>
            <span>Siguiente</span>
            <IconRight />
          </button>
        </div>
      </div>

      {confirmDelete && note ? (
        <Modal
          title={`¿Eliminar «${note.title || KIND_LABEL[note.kind]}»?`}
          onClose={() => setConfirmDelete(false)}
        >
          <p>La nota se quitará del cuaderno.</p>
          <div className="acts">
            <button type="button" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </button>
            <button type="button" className="del" onClick={removeNote}>
              Eliminar
            </button>
          </div>
        </Modal>
      ) : null}
    </div>,
    document.body,
  );
}
