import type { Block, OrganicPage } from '@cuaderno/shared';
import { useRef, useState } from 'react';
import { useAppStore } from '../../app/store';
import { createSubpage } from '../../app/actions';
import { IconImage, IconMic, IconPen, IconSigma, IconText } from '../../components/ui/icons';
import { type AnchorRect, Popover } from '../../components/ui/Popover';
import { toast } from '../../components/ui/toast-store';
import { isImage, storeImage } from '../../lib/files';
import { openWhenMounted } from '../pages/editor/mathFocus';
import { Board } from './Board';
import { createNote, type NewNoteKind } from './model';
import { Reader } from './Reader';
import { useOrganicDoc } from './useOrganicDoc';

const NEW_NOTES: { k: NewNoteKind; label: string; icon: React.ReactNode }[] = [
  { k: 'md', label: 'Nota', icon: <IconText /> },
  { k: 'tex', label: 'LaTeX', icon: <IconSigma /> },
  { k: 'voice', label: 'Voz', icon: <IconMic /> },
  { k: 'draw', label: 'Lápiz', icon: <IconPen /> },
  { k: 'img', label: 'Imagen', icon: <IconImage /> },
];

type Props = {
  page: OrganicPage;
  getTitle: () => string;
  setTitle: (t: string) => void;
};

/** Cuaderno orgánico: tablero, barra propia y lector. */
export function OrganicView({ page, getTitle, setTitle }: Props) {
  const doc = useOrganicDoc(page);
  const [reader, setReader] = useState<number | null>(null);
  const [addMenu, setAddMenu] = useState<AnchorRect | null>(null);
  const openPage = useAppStore((s) => s.openPage);

  /* ---------- imágenes ---------- */
  const fileInput = useRef<HTMLInputElement>(null);
  /** Qué hacer con las imágenes elegidas: crear notas o entregar el archivo a un editor. */
  const onPicked = useRef<((files: File[]) => void) | null>(null);

  const store = async (list: File[]) => {
    const ids: string[] = [];
    for (const f of list) {
      try {
        ids.push(await storeImage(f));
      } catch {
        toast('No pude leer esa imagen');
      }
    }
    return ids;
  };

  /** Crea notas de imagen y abre la primera en el lector. */
  const addImageNotes = async (list: File[]) => {
    const ids = await store(list.filter(isImage));
    if (!ids.length) return;
    const first = doc.current().notes.length + 1;
    doc.update((d) => {
      const notes = d.notes.slice();
      for (const fileId of ids) notes.push(createNote({ ...d, notes }, 'img', { fileId }));
      return { ...d, notes };
    });
    setReader(first);
  };

  const pickFiles = (multiple: boolean, then: (files: File[]) => void) => {
    const input = fileInput.current;
    if (!input) return;
    input.multiple = multiple;
    onPicked.current = then;
    input.click();
  };

  const pickImage = (done: (fileId: string) => void) =>
    pickFiles(false, (list) => {
      void store(list.filter(isImage).slice(0, 1)).then((ids) => ids[0] && done(ids[0]));
    });

  /* ---------- notas nuevas ---------- */
  const addNote = (k: NewNoteKind) => {
    setAddMenu(null);
    if (k === 'img') {
      pickFiles(true, (list) => void addImageNotes(list));
      return;
    }
    const d = doc.current();
    const note = createNote(d, k);
    if (k === 'tex') {
      const math = note.blocks?.[0] as Block | undefined;
      if (math) openWhenMounted(math.id);
    }
    doc.update((p) => ({ ...p, notes: [...p.notes, note] }));
    setReader(d.notes.length + 1);
  };

  const closeReader = () => {
    setReader(null);
    void doc.save();
  };

  return (
    <>
      <Board
        page={doc.doc}
        onOpen={setReader}
        onAdd={(r) => setAddMenu({ left: r.left, top: r.top, bottom: r.bottom })}
        onDropImages={(list) => void addImageNotes(list)}
      />

      {reader === null ? (
        <div className="otb" role="toolbar" aria-label="Agregar al cuaderno">
          {NEW_NOTES.map((it) => (
            <button key={it.k} type="button" onClick={() => addNote(it.k)}>
              {it.icon}
              <span>{it.label}</span>
            </button>
          ))}
        </div>
      ) : null}

      {addMenu ? (
        <Popover anchor={addMenu} label="Nueva nota" onClose={() => setAddMenu(null)}>
          <div className="lb">Nueva nota</div>
          {NEW_NOTES.map((it) => (
            <button key={it.k} type="button" role="menuitem" onClick={() => addNote(it.k)}>
              <span className="bi">{it.icon}</span>
              <span>
                <b>{it.k === 'tex' ? 'Nota LaTeX' : it.k === 'md' ? 'Nota' : it.label}</b>
              </span>
            </button>
          ))}
        </Popover>
      ) : null}

      {reader !== null ? (
        <Reader
          doc={doc}
          index={reader}
          onIndex={setReader}
          onClose={closeReader}
          pickImage={pickImage}
          pageTitle={getTitle()}
          onPageTitle={setTitle}
          createSubpage={() => createSubpage(page.id)}
          openSubpage={(id) => {
            closeReader();
            openPage(id, { focusTitle: true });
          }}
        />
      ) : null}

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        aria-label="Elegir imagen"
        onChange={(e) => {
          const list = Array.from(e.target.files ?? []);
          e.target.value = '';
          const then = onPicked.current;
          onPicked.current = null;
          if (list.length && then) then(list);
        }}
      />
    </>
  );
}
