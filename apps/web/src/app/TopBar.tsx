import type { AnyPage } from '@cuaderno/shared';
import { useState } from 'react';
import { Modal } from '../components/ui/Modal';
import { IconMenu, IconMic, IconMore } from '../components/ui/icons';
import { SettingsDialog } from '../features/settings/SettingsDialog';
import { toggleDictation, useDictation } from '../features/voice/dictation';
import { type AnchorRect, Popover } from '../components/ui/Popover';
import { toast } from '../components/ui/toast-store';
import { db } from '../lib/db';
import { flushPending } from '../lib/flush';
import { pageToMarkdown } from '../lib/markdown';
import { ancestryOf, descendantsOf } from '../lib/pages';
import {
  createOrganicAndOpen,
  createPageAndOpen,
  deleteAndNavigate,
  duplicateAndOpen,
} from './actions';
import { useAppStore } from './store';

type Dialog = { kind: 'md'; text: string } | { kind: 'delete'; subpages: number } | null;

export function TopBar({ pages, page }: { pages: AnyPage[]; page: AnyPage }) {
  const openPage = useAppStore((s) => s.openPage);
  const drawerOpen = useAppStore((s) => s.drawerOpen);
  const setDrawer = useAppStore((s) => s.setDrawer);
  const dictating = useDictation((s) => s.active);
  const [menu, setMenu] = useState<AnchorRect | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const chain = ancestryOf(pages, page.id);
  const title = page.title || 'Sin título';

  const act = async (v: string) => {
    setMenu(null);
    if (v === 'md') {
      await flushPending();
      const fresh = (await db.pages.get(page.id)) ?? page;
      const all = await db.pages.toArray();
      const titleOf = (id: string) => {
        const p = all.find((x) => x.id === id && !x.deletedAt);
        return p ? p.title : undefined;
      };
      setDialog({ kind: 'md', text: pageToMarkdown(fresh, titleOf) });
    }
    if (v === 'sub') await createPageAndOpen(page.id);
    if (v === 'osub') await createOrganicAndOpen(page.id);
    if (v === 'dup') await duplicateAndOpen(page.id);
    if (v === 'del') setDialog({ kind: 'delete', subpages: descendantsOf(pages, page.id).length });
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Markdown copiado');
    } catch {
      document.querySelector<HTMLTextAreaElement>('#mdTxt')?.select();
      toast('Selecciona el texto y cópialo a mano');
    }
  };

  return (
    <div className="top">
      <button
        type="button"
        id="menuBtn"
        aria-label="Abrir páginas"
        aria-expanded={drawerOpen}
        onClick={() => setDrawer(!drawerOpen)}
      >
        <IconMenu />
      </button>
      <nav id="crumbs" aria-label="Ruta de la página">
        {chain.map((p, i) => (
          <span key={p.id} className="crumb">
            {i > 0 ? (
              <span className="sl" aria-hidden="true">
                /
              </span>
            ) : null}
            <button
              type="button"
              aria-current={p.id === page.id ? 'page' : undefined}
              onClick={() => openPage(p.id)}
            >
              {p.icon} {p.title || 'Sin título'}
            </button>
          </span>
        ))}
      </nav>
      <button
        type="button"
        id="micBtn"
        className={dictating ? 'rec' : undefined}
        aria-label={dictating ? 'Detener dictado' : 'Dictar por voz'}
        aria-pressed={dictating}
        title={dictating ? 'Detener dictado' : 'Dictar por voz'}
        // No quita el foco del editor: el texto va donde está el cursor.
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggleDictation}
      >
        <IconMic />
      </button>
      <button
        type="button"
        id="setBtn"
        aria-label="Personalizar"
        title="Personalizar"
        onClick={() => setSettingsOpen(true)}
      >
        <span className="aa" aria-hidden="true">
          Aa
        </span>
      </button>
      <button
        type="button"
        id="moreBtn"
        aria-label="Opciones de página"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setMenu({ left: r.left, top: r.top, bottom: r.bottom });
        }}
      >
        <IconMore />
      </button>

      {menu ? (
        <Popover anchor={menu} label="Opciones de página" onClose={() => setMenu(null)}>
          <div className="lb">Página</div>
          <button type="button" role="menuitem" onClick={() => void act('md')}>
            Ver y copiar como Markdown
          </button>
          <button type="button" role="menuitem" onClick={() => void act('sub')}>
            Nueva subpágina
          </button>
          <button type="button" role="menuitem" onClick={() => void act('osub')}>
            Nuevo cuaderno orgánico dentro
          </button>
          <button type="button" role="menuitem" onClick={() => void act('dup')}>
            Duplicar página
          </button>
          <button type="button" role="menuitem" className="danger" onClick={() => void act('del')}>
            Eliminar página
          </button>
        </Popover>
      ) : null}

      {settingsOpen ? <SettingsDialog onClose={() => setSettingsOpen(false)} /> : null}

      {dialog?.kind === 'md' ? (
        <Modal title="Markdown" onClose={() => setDialog(null)}>
          <textarea id="mdTxt" readOnly value={dialog.text} aria-label="Markdown de la página" />
          <div className="acts">
            <button type="button" onClick={() => setDialog(null)}>
              Cerrar
            </button>
            <button
              type="button"
              className="pri"
              data-autofocus
              onClick={() => void copy(dialog.text)}
            >
              Copiar
            </button>
          </div>
        </Modal>
      ) : null}

      {dialog?.kind === 'delete' ? (
        <Modal title={`¿Eliminar «${title}»?`} onClose={() => setDialog(null)}>
          <p>
            {dialog.subpages
              ? `También se borrarán sus ${dialog.subpages} subpágina${dialog.subpages === 1 ? '' : 's'}. `
              : ''}
            No se puede deshacer.
          </p>
          <div className="acts">
            <button type="button" data-autofocus onClick={() => setDialog(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="del"
              onClick={() => {
                setDialog(null);
                void deleteAndNavigate(page.id);
              }}
            >
              Eliminar
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
