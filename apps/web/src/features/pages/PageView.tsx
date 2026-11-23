import type { AnyPage, Block } from '@cuaderno/shared';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createSubpage } from '../../app/actions';
import { useAppStore } from '../../app/store';
import { type AnchorRect, Popover } from '../../components/ui/Popover';
import { registerFlush } from '../../lib/flush';
import { pages } from '../../lib/pages';
import { OrganicView } from '../organic/OrganicView';
import { BlockEditor, type BlockEditorHandle } from './editor/BlockEditor';

const EMOJIS = [
  '📄',
  '🌀',
  '📓',
  '🗂️',
  '📅',
  '💡',
  '✅',
  '🎨',
  '📚',
  '🧪',
  '💻',
  '🏋️',
  '🍎',
  '✈️',
  '⭐',
  '🔥',
  '🎵',
  '🌱',
  '🧠',
];

const TITLE_DELAY = 300;

/** Página de bloques: icono, título editable y editor. Se monta de nuevo al cambiar de página. */
export function PageView({ page }: { page: AnyPage }) {
  const editor = useRef<BlockEditorHandle>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [iconMenu, setIconMenu] = useState<AnchorRect | null>(null);
  const openPage = useAppStore((s) => s.openPage);
  const focusTitleFor = useAppStore((s) => s.focusTitleFor);
  // Los bloques iniciales se leen una sola vez: después el editor es la fuente de verdad.
  const [initialBlocks] = useState<Block[]>(() => (page.kind === 'page' ? page.blocks : []));

  /* ---------- título ---------- */
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTitle = useRef<string | null>(null);
  const flushTitle = useRef(async () => {
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = null;
    const t = pendingTitle.current;
    pendingTitle.current = null;
    if (t !== null) await pages.update(page.id, { title: t });
  });

  useLayoutEffect(() => {
    if (title.current) title.current.textContent = page.title;
    // Solo al montar: después el título lo maneja el propio elemento editable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const f = flushTitle.current;
    const off = registerFlush(f);
    return () => {
      off();
      void f();
    };
  }, []);

  useEffect(() => {
    if (focusTitleFor !== page.id || !title.current) return;
    title.current.focus();
    useAppStore.setState({ focusTitleFor: null });
  }, [focusTitleFor, page.id]);

  const onTitleInput = () => {
    const el = title.current;
    if (!el) return;
    if (el.innerHTML === '<br>') el.innerHTML = '';
    pendingTitle.current = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => void flushTitle.current(), TITLE_DELAY);
  };

  /** El lector del cuaderno orgánico edita el título como "tema central". */
  const setTitle = (t: string) => {
    if (title.current) title.current.textContent = t;
    pendingTitle.current = t.replace(/\s+/g, ' ').trim();
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => void flushTitle.current(), TITLE_DELAY);
  };

  return (
    <article className={'doc' + (page.kind === 'organic' ? ' organic' : '')}>
      <button
        type="button"
        id="icon"
        aria-label="Cambiar icono"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setIconMenu({ left: r.left, top: r.top, bottom: r.bottom });
        }}
      >
        {page.icon}
      </button>
      <h1
        id="title"
        ref={title}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        role="textbox"
        aria-label="Título de la página"
        data-ph="Sin título"
        onInput={onTitleInput}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (page.kind === 'page') editor.current?.focusStart();
            else e.currentTarget.blur();
          }
        }}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData('text/plain').replace(/\s+/g, ' ');
          document.execCommand('insertText', false, text);
        }}
      />

      {page.kind === 'page' ? (
        <>
          <BlockEditor
            ref={editor}
            initialBlocks={initialBlocks}
            onSave={(blocks) => pages.update(page.id, { blocks })}
            createSubpage={() => createSubpage(page.id)}
            openSubpage={(id) => openPage(id, { focusTitle: true })}
          />
          <div
            className="tail"
            data-testid="tail"
            onClick={() => editor.current?.focusEnd()}
            aria-hidden="true"
          />
        </>
      ) : (
        <OrganicView
          page={page}
          getTitle={() => title.current?.textContent ?? ''}
          setTitle={setTitle}
        />
      )}

      {iconMenu ? (
        <Popover anchor={iconMenu} label="Icono" onClose={() => setIconMenu(null)}>
          <div className="lb">Icono</div>
          <div className="emo">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                role="menuitem"
                aria-label={`Icono ${e}`}
                onClick={() => {
                  setIconMenu(null);
                  void pages.update(page.id, { icon: e });
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </Popover>
      ) : null}
    </article>
  );
}
