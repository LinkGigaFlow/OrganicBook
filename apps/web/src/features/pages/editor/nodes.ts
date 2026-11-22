import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { PageLinkView } from './PageLinkView';
import { RawBlockView } from './RawBlockView';

/** Bloque de texto plano de una sola "línea" lógica (sin anidar), con contenido en línea. */
function flatTextNode(name: 'bullet' | 'num' | 'quote') {
  return Node.create({
    name,
    group: 'block',
    content: 'inline*',
    defining: true,
    parseHTML: () => [{ tag: `div[data-block="${name}"]` }],
    renderHTML: ({ HTMLAttributes }) => [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-block': name }),
      0,
    ],
  });
}

export const Bullet = flatTextNode('bullet');
export const Num = flatTextNode('num');
export const Quote = flatTextNode('quote');

/** Tarea con casilla. La casilla vive fuera del área editable. */
export const Todo = Node.create({
  name: 'todo',
  group: 'block',
  content: 'inline*',
  defining: true,
  addAttributes: () => ({
    checked: {
      default: false,
      parseHTML: (el) => el.getAttribute('data-checked') === 'true',
      renderHTML: (a) => ({ 'data-checked': a.checked ? 'true' : 'false' }),
    },
  }),
  parseHTML: () => [{ tag: 'div[data-block="todo"]' }],
  renderHTML: ({ HTMLAttributes }) => [
    'div',
    mergeAttributes(HTMLAttributes, { 'data-block': 'todo' }),
    0,
  ],
  addNodeView:
    () =>
    ({ node, getPos, editor }) => {
      const dom = document.createElement('div');
      dom.dataset.block = 'todo';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.className = 'ck';
      box.contentEditable = 'false';
      box.setAttribute('aria-label', 'Hecho');
      const content = document.createElement('div');
      content.className = 'todo-text';
      dom.append(box, content);

      let current = node;
      const sync = () => {
        box.checked = !!current.attrs.checked;
        dom.classList.toggle('done', !!current.attrs.checked);
        dom.dataset.id = current.attrs.id ?? '';
      };
      sync();

      box.addEventListener('mousedown', (e) => e.preventDefault());
      box.addEventListener('change', () => {
        const pos = typeof getPos === 'function' ? getPos() : undefined;
        if (pos === undefined) return;
        editor.view.dispatch(
          editor.state.tr.setNodeMarkup(pos, undefined, {
            ...current.attrs,
            checked: box.checked,
          }),
        );
      });

      return {
        dom,
        contentDOM: content,
        update: (n) => {
          if (n.type !== current.type) return false;
          current = n;
          sync();
          return true;
        },
        ignoreMutation: (m) => m.target === box || (m.type === 'attributes' && m.target === dom),
        stopEvent: (e) => e.target === box,
      };
    },
});

/** Enlace a una subpágina (bloque atómico). */
export const PageLink = Node.create({
  name: 'pageLink',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes: () => ({
    pageId: {
      default: '',
      parseHTML: (el) => el.getAttribute('data-page-id') ?? '',
      renderHTML: (a) => ({ 'data-page-id': a.pageId }),
    },
  }),
  parseHTML: () => [{ tag: 'div[data-block="link"]' }],
  renderHTML: ({ HTMLAttributes }) => [
    'div',
    mergeAttributes(HTMLAttributes, { 'data-block': 'link' }),
  ],
  addNodeView: () => ReactNodeViewRenderer(PageLinkView),
});

/**
 * Bloques que se editan en fases posteriores (ecuación, imagen, dibujo).
 * Se conservan intactos como JSON para no perder datos.
 */
export const RawBlock = Node.create({
  name: 'rawBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes: () => ({
    json: {
      default: '{}',
      parseHTML: (el) => el.getAttribute('data-json') ?? '{}',
      renderHTML: (a) => ({ 'data-json': a.json }),
    },
  }),
  parseHTML: () => [{ tag: 'div[data-block="raw"]' }],
  renderHTML: ({ HTMLAttributes }) => [
    'div',
    mergeAttributes(HTMLAttributes, { 'data-block': 'raw' }),
  ],
  addNodeView: () => ReactNodeViewRenderer(RawBlockView),
});

/** Fórmula en línea `<span class="tex" data-tex="…">`. Se edita en la Fase 3; aquí se conserva. */
export const TexInline = Node.create({
  name: 'texInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({
    tex: {
      default: '',
      parseHTML: (el) => el.getAttribute('data-tex') ?? '',
      renderHTML: (a) => ({ 'data-tex': a.tex }),
    },
  }),
  parseHTML: () => [{ tag: 'span.tex' }],
  renderHTML: ({ HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes, { class: 'tex' })],
});
