import type { Block } from '@cuaderno/shared';
import type { Editor } from '@tiptap/core';
import { Slice } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { EditorContent, useEditor } from '@tiptap/react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { IconGrip } from '../../../components/ui/icons';
import { type AnchorRect, Popover } from '../../../components/ui/Popover';
import { blocksToMarkdown, markdownToBlocks } from '../../../lib/markdown';
import { registerFlush } from '../../../lib/flush';
import { norm, uid } from '../../../lib/text';
import { toast } from '../../../components/ui/toast-store';
import { isImage, storeImage } from '../../../lib/files';
import {
  blockAt,
  blockToDrawing,
  blockToPageLink,
  convertBlock,
  deleteBlock,
  duplicateBlock,
  findBlock,
  insertImages,
  moveBlock,
  run,
  setImageSize,
} from './blockOps';
import {
  blocksToFragment,
  blocksToHtml,
  docToBlocks,
  isTextType,
  nodeToBlock,
  TEXT_TYPES,
} from './convert';
import { blockEditorExtensions } from './extensions';
import { LABEL, MENU_ITEMS, type MenuItem, type MenuKind } from './items';

const SAVE_DELAY = 350;

export type BlockEditorHandle = {
  /** Enfoca el inicio del primer bloque de texto (crea uno si hace falta). */
  focusStart: () => void;
  /** Enfoca el final; si el último bloque no es un párrafo vacío, agrega uno. */
  focusEnd: () => void;
};

type Props = {
  initialBlocks: Block[];
  onSave: (blocks: Block[]) => Promise<void> | void;
  /** Crea una subpágina y devuelve su id. */
  createSubpage: () => Promise<string>;
  /** Abre la subpágina recién creada desde el menú `/`. */
  openSubpage: (id: string) => void;
};

type SlashState = {
  blockId: string;
  query: string;
  items: MenuItem[];
  index: number;
  anchor: AnchorRect;
};
type HandleState = { blockId: string; top: number };
type BlockMenuState = { blockId: string; anchor: AnchorRect };

const SIZES = [
  ['s', 'Pequeña'],
  ['m', 'Mediana'],
  ['l', 'Completa'],
] as const;

const imagesIn = (list: FileList | null | undefined) => Array.from(list ?? []).filter(isImage);

/** Lee si la selección está en un párrafo que empieza con `/` (menú de bloques). */
function readSlash(editor: Editor, prevIndex: number): SlashState | null {
  const { state, view } = editor;
  const { $from, empty } = state.selection;
  if (!empty || $from.depth !== 1 || $from.parent.type.name !== 'paragraph') return null;
  const text = $from.parent.textContent;
  if (!text.startsWith('/') || text.length >= 24 || /\s/.test(text.slice(1))) return null;
  const q = norm(text.slice(1));
  const touch = window.matchMedia('(pointer: coarse)').matches;
  const items = MENU_ITEMS.filter(
    (it) => (touch || !it.touchOnly) && (!q || norm(`${it.label} ${it.kw}`).includes(q)),
  );
  if (!items.length) return null;
  const c = view.coordsAtPos($from.before(1) + 1);
  return {
    blockId: $from.parent.attrs.id as string,
    query: q,
    items,
    index: Math.min(prevIndex, items.length - 1),
    anchor: { left: c.left, top: c.top, bottom: c.bottom },
  };
}

/** Elemento DOM del bloque de primer nivel que contiene `el`. */
function topBlockElement(view: EditorView, el: Element | null): HTMLElement | null {
  let cur: Element | null = el;
  while (cur && cur.parentElement !== view.dom) cur = cur.parentElement;
  return cur instanceof HTMLElement ? cur : null;
}

export const BlockEditor = forwardRef<BlockEditorHandle, Props>(function BlockEditor(
  { initialBlocks, onSave, createSubpage, openSubpage },
  ref,
) {
  const wrap = useRef<HTMLDivElement>(null);
  const [slash, setSlash] = useState<SlashState | null>(null);
  const slashRef = useRef<SlashState | null>(null);
  const [handle, setHandle] = useState<HandleState | null>(null);
  const [blockMenu, setBlockMenu] = useState<BlockMenuState | null>(null);
  const pickRef = useRef<(item: MenuItem) => void>(() => {});
  const followSelection = useRef<(ed: Editor) => void>(() => {});

  const setSlashBoth = (s: SlashState | null) => {
    slashRef.current = s;
    setSlash(s);
  };

  /* ---------- guardado con espera ---------- */
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Editor | null>(null);
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  });
  const flush = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const ed = pending.current;
    pending.current = null;
    if (ed) await onSaveRef.current(docToBlocks(ed.state.doc, ed.schema));
  }, []);
  useEffect(() => registerFlush(flush), [flush]);

  /* ---------- imágenes ---------- */
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  /** Bloque donde van las imágenes elegidas con el selector de archivos. */
  const pickTarget = useRef<string | null>(null);

  /** Reduce, guarda como archivo y agrega bloques de imagen después de `targetId`. */
  const addImages = async (list: File[], targetId: string | null) => {
    const ids: string[] = [];
    for (const f of list) {
      try {
        ids.push(await storeImage(f));
      } catch {
        toast('No pude leer esa imagen');
      }
    }
    const ed = editorRef.current;
    if (!ed || ed.isDestroyed || !ids.length) return;
    run(ed, (tr) => insertImages(tr, targetId, ids));
  };
  const addImagesRef = useRef(addImages);
  addImagesRef.current = addImages;

  const currentBlockId = (view: EditorView) =>
    (blockAt(view.state.doc, view.state.selection.from)?.node.attrs.id as string | undefined) ??
    null;

  const onFilesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = imagesIn(e.target.files);
    e.target.value = '';
    const target = pickTarget.current;
    pickTarget.current = null;
    if (list.length) void addImages(list, target);
  };

  /* ---------- pegar ---------- */
  const handlePaste = (view: EditorView, event: ClipboardEvent): boolean => {
    const data = event.clipboardData;
    if (!data) return false;
    const pasted = imagesIn(data.files);
    if (pasted.length) {
      event.preventDefault();
      void addImages(pasted, currentBlockId(view));
      return true;
    }
    const text = data.getData('text/plain');
    if (!text) return false;
    const { state } = view;
    const { $from } = state.selection;
    if ($from.parent.type.name === 'codeBlock') {
      view.dispatch(state.tr.insertText(text).scrollIntoView());
      return true;
    }
    if (!text.trim().includes('\n')) {
      view.dispatch(state.tr.insertText(text.replace(/\r?\n/g, ' ')).scrollIntoView());
      return true;
    }
    const blocks = markdownToBlocks(text);
    const frag = blocksToFragment(blocks, state.schema);
    const tr = state.tr;
    if (!state.selection.empty) tr.deleteSelection();
    const cur = blockAt(tr.doc, tr.selection.from);
    if (!cur) return false;
    let start: number;
    if (cur.node.type.name === 'paragraph' && cur.node.content.size === 0) {
      tr.replaceWith(cur.pos, cur.pos + cur.node.nodeSize, frag);
      start = cur.pos;
    } else {
      start = cur.pos + cur.node.nodeSize;
      tr.insert(start, frag);
    }
    const end = start + frag.size;
    tr.setSelection(TextSelection.near(tr.doc.resolve(end), -1));
    view.dispatch(tr.scrollIntoView());
    return true;
  };

  const editorRef = useRef<Editor | null>(null);
  const editor: Editor | null = useEditor({
    extensions: blockEditorExtensions(),
    content: blocksToHtml(
      initialBlocks.length ? initialBlocks : [{ id: uid(), type: 'p', html: '' }],
    ),
    enableInputRules: ['blockShortcuts'],
    enablePasteRules: false,
    editorProps: {
      attributes: { class: 'blocks', 'aria-label': 'Contenido de la página', spellcheck: 'true' },
      handlePaste: (view, event) => handlePaste(view, event),
      // Soltar imágenes sobre el editor: van debajo del bloque donde se sueltan.
      handleDrop: (view, event) => {
        const dropped = imagesIn(event.dataTransfer?.files);
        if (!dropped.length) return false;
        event.preventDefault();
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
        const b = at ? blockAt(view.state.doc, at.pos) : null;
        void addImagesRef.current(
          dropped,
          (b?.node.attrs.id as string | undefined) ?? currentBlockId(view),
        );
        return true;
      },
      // Al copiar, el texto plano sale como Markdown para poder pegarlo en otra página.
      clipboardTextSerializer: (slice: Slice): string => {
        const ed: Editor | null = editorRef.current;
        const plain = slice.content.textBetween(0, slice.content.size, '\n', '\n');
        if (!ed || !slice.content.firstChild?.isBlock || slice.content.childCount < 2) return plain;
        try {
          const doc = ed.schema.topNodeType.create(null, slice.content);
          return blocksToMarkdown(docToBlocks(doc, ed.schema)).trimEnd();
        } catch {
          return plain;
        }
      },
      handleKeyDown: (_view, e) => {
        const s = slashRef.current;
        if (!s) return false;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const d = e.key === 'ArrowDown' ? 1 : -1;
          setSlashBoth({ ...s, index: (s.index + d + s.items.length) % s.items.length });
          return true;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          pickRef.current(s.items[s.index]!);
          return true;
        }
        if (e.key === 'Escape') {
          setSlashBoth(null);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      pending.current = ed;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flush, SAVE_DELAY);
    },
    onTransaction: ({ editor: ed }) => {
      setSlashBoth(readSlash(ed, slashRef.current?.index ?? 0));
      // En pantallas táctiles el asa sigue al bloque de la selección.
      if (window.matchMedia('(hover: none)').matches) followSelection.current(ed);
    },
    onBlur: () => {
      setTimeout(() => {
        if (!document.activeElement?.closest('.pop')) setSlashBoth(null);
      }, 150);
    },
  });
  editorRef.current = editor;

  // Guardar al salir de la página, al cerrar o al ocultar la pestaña.
  useEffect(() => {
    const onHide = () => void flush();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
      void flush();
    };
  }, [flush]);

  // Imágenes soltadas fuera del editor (márgenes, zona inferior): van al final de la página.
  useEffect(() => {
    const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      // Si el editor ya lo recibió (soltado sobre un bloque), no se repite.
      const handled = e.defaultPrevented;
      e.preventDefault();
      if (handled) return;
      const dropped = imagesIn(e.dataTransfer?.files);
      if (dropped.length) void addImagesRef.current(dropped, null);
    };
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  /* ---------- asa de bloque ---------- */
  const placeHandle = (el: HTMLElement) => {
    const box = wrap.current;
    const ed = editorRef.current;
    if (!box || !ed) return;
    const id = el.dataset.id ?? el.querySelector<HTMLElement>('[data-id]')?.dataset.id;
    if (!id) return;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight) || r.height;
    const pad = parseFloat(cs.paddingTop) || 0;
    const firstLine = Math.min(r.height, lh + pad * 2);
    const top = r.top - box.getBoundingClientRect().top + firstLine / 2 - 15;
    setHandle((h) =>
      h && h.blockId === id && Math.abs(h.top - top) < 1 ? h : { blockId: id, top },
    );
  };

  const showHandleForSelection = (ed: Editor) => {
    const b = blockAt(ed.state.doc, ed.state.selection.from);
    if (!b) return;
    const el = ed.view.nodeDOM(b.pos);
    if (el instanceof HTMLElement) placeHandle(el);
  };
  followSelection.current = showHandleForSelection;

  const onMouseMove = (e: React.MouseEvent) => {
    const ed = editorRef.current;
    if (!ed || blockMenu) return;
    const target = e.target as Element;
    if (target.closest('.hd')) return;
    const el = topBlockElement(ed.view, target);
    if (el) placeHandle(el);
  };

  /* ---------- acciones ---------- */
  const pick = async (item: MenuItem) => {
    const ed = editorRef.current;
    const s = slashRef.current;
    setSlashBoth(null);
    if (!ed || !s) return;
    const found = findBlock(ed.state.doc, s.blockId);
    if (!found) return;
    // Borra el "/consulta" escrito.
    const tr = ed.state.tr.delete(found.pos + 1, found.pos + found.node.nodeSize - 1);
    ed.view.dispatch(tr);
    await applyKind(s.blockId, item.k);
  };
  pickRef.current = (item) => void pick(item);

  const applyKind = async (blockId: string, k: MenuKind) => {
    const ed = editorRef.current;
    if (!ed) return;
    if (k === 'page') {
      const pageId = await createSubpage();
      run(ed, (tr) => blockToPageLink(tr, blockId, pageId), false);
      await flush();
      openSubpage(pageId);
      return;
    }
    if (k === 'img' || k === 'camera') {
      pickTarget.current = blockId;
      (k === 'img' ? fileInput : cameraInput).current?.click();
      return;
    }
    if (k === 'draw') {
      run(ed, (tr) => blockToDrawing(tr, blockId), false);
      return;
    }
    run(ed, (tr) => convertBlock(tr, blockId, k));
  };

  const blockAction = (blockId: string, action: string) => {
    const ed = editorRef.current;
    setBlockMenu(null);
    if (!ed) return;
    if (action.startsWith('conv:')) {
      void applyKind(blockId, action.slice(5) as MenuKind);
      return;
    }
    if (action.startsWith('size:')) {
      run(ed, (tr) => setImageSize(tr, blockId, action.slice(5) as 's' | 'm' | 'l'), false);
      return;
    }
    if (action === 'up') run(ed, (tr) => moveBlock(tr, blockId, -1));
    if (action === 'down') run(ed, (tr) => moveBlock(tr, blockId, 1));
    if (action === 'dup') run(ed, (tr) => duplicateBlock(tr, blockId));
    if (action === 'del') run(ed, (tr) => deleteBlock(tr, blockId));
  };

  // El foco se mueve de inmediato (sin esperar un cuadro) para no perder lo que se escribe.
  useImperativeHandle(ref, () => ({
    focusStart: () => {
      const ed = editorRef.current;
      if (!ed) return;
      const tr = ed.state.tr;
      const first = tr.doc.firstChild;
      if (!first || !first.isTextblock)
        tr.insert(0, ed.schema.nodes.paragraph!.create({ id: uid() }));
      tr.setSelection(TextSelection.create(tr.doc, 1));
      ed.view.dispatch(tr.scrollIntoView());
      ed.view.focus();
    },
    focusEnd: () => {
      const ed = editorRef.current;
      if (!ed) return;
      const tr = ed.state.tr;
      const last = tr.doc.lastChild;
      if (!last || last.type.name !== 'paragraph' || last.content.size > 0) {
        tr.insert(tr.doc.content.size, ed.schema.nodes.paragraph!.create({ id: uid() }));
      }
      tr.setSelection(TextSelection.create(tr.doc, tr.doc.content.size - 1));
      ed.view.dispatch(tr.scrollIntoView());
      ed.view.focus();
    },
  }));

  const menuBlock = blockMenu && editor ? findBlock(editor.state.doc, blockMenu.blockId) : null;
  const menuModel = menuBlock && editor ? nodeToBlock(menuBlock.node, editor.schema) : null;
  const menuType = menuModel?.type ?? null;

  return (
    <div
      ref={wrap}
      className="editor-wrap"
      onMouseMove={onMouseMove}
      onMouseLeave={() =>
        !blockMenu && !window.matchMedia('(hover: none)').matches && setHandle(null)
      }
    >
      {handle ? (
        <button
          type="button"
          className={'hd' + (blockMenu ? ' on' : '')}
          style={{ top: handle.top }}
          aria-label="Opciones del bloque"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setBlockMenu({
              blockId: handle.blockId,
              anchor: { left: r.left, top: r.top, bottom: r.bottom },
            });
          }}
        >
          <IconGrip />
        </button>
      ) : null}

      <EditorContent editor={editor} />

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        aria-label="Subir imagen"
        onChange={onFilesPicked}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        aria-label="Tomar foto"
        onChange={onFilesPicked}
      />

      {slash ? (
        <Popover
          anchor={slash.anchor}
          label="Bloques"
          onClose={() => setSlashBoth(null)}
          keepOpenWithin={() => editorRef.current?.view.dom ?? null}
          preventFocusSteal
        >
          <div className="lb">Bloques</div>
          {slash.items.map((it, i) => (
            <button
              key={it.k}
              type="button"
              role="menuitem"
              className={i === slash.index ? 'on' : ''}
              ref={(el) => {
                if (el && i === slash.index) el.scrollIntoView({ block: 'nearest' });
              }}
              onClick={() => pickRef.current(it)}
            >
              <span className="bi">{it.icon}</span>
              <span>
                <b>{it.label}</b>
                <small>{it.desc}</small>
              </span>
            </button>
          ))}
        </Popover>
      ) : null}

      {blockMenu && menuBlock ? (
        <Popover
          anchor={blockMenu.anchor}
          label="Opciones del bloque"
          onClose={() => setBlockMenu(null)}
        >
          {menuType && isTextType(menuType) ? (
            <>
              <div className="lb">Convertir en</div>
              {TEXT_TYPES.filter((k) => k !== menuType).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="menuitem"
                  onClick={() => blockAction(blockMenu.blockId, `conv:${k}`)}
                >
                  {LABEL[k]}
                </button>
              ))}
            </>
          ) : null}
          {menuModel?.type === 'img' ? (
            <>
              <div className="lb">Tamaño</div>
              {SIZES.map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  role="menuitemradio"
                  aria-checked={menuModel.size === v}
                  onClick={() => blockAction(blockMenu.blockId, `size:${v}`)}
                >
                  {l}
                  {menuModel.size === v ? ' ✓' : ''}
                </button>
              ))}
            </>
          ) : null}
          <div className="lb">Bloque</div>
          <button
            type="button"
            role="menuitem"
            onClick={() => blockAction(blockMenu.blockId, 'up')}
          >
            Mover arriba
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => blockAction(blockMenu.blockId, 'down')}
          >
            Mover abajo
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => blockAction(blockMenu.blockId, 'dup')}
          >
            Duplicar
          </button>
          <button
            type="button"
            role="menuitem"
            className="danger"
            onClick={() => blockAction(blockMenu.blockId, 'del')}
          >
            Eliminar
          </button>
        </Popover>
      ) : null}
    </div>
  );
});
