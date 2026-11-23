import { Extension, InputRule } from '@tiptap/core';
import { Fragment, type Node as PMNode } from '@tiptap/pm/model';
import {
  type EditorState,
  NodeSelection,
  Plugin,
  PluginKey,
  TextSelection,
  type Transaction,
} from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { inlineMd } from '../../../lib/html';
import { uid } from '../../../lib/text';
import { convertedNode, findBlock } from './blockOps';
import { BLOCK_NODE_NAMES, inlineFragment, inlineHtml } from './convert';
import { openWhenMounted } from './mathFocus';

const LIST_NODES = new Set(['bullet', 'num', 'todo']);

/* ------------------------------------------------------------------ */
/* Ids de bloque                                                       */
/* ------------------------------------------------------------------ */

/** Cada bloque de primer nivel lleva `data-id`; los duplicados o faltantes reciben uno nuevo. */
export const BlockIds = Extension.create({
  name: 'blockIds',
  addGlobalAttributes: () => [
    {
      types: [...BLOCK_NODE_NAMES],
      attributes: {
        id: {
          default: null,
          parseHTML: (el) => el.getAttribute('data-id'),
          renderHTML: (a) => (a.id ? { 'data-id': a.id } : {}),
        },
      },
    },
  ],
  addProseMirrorPlugins: () => [
    new Plugin({
      key: new PluginKey('blockIds'),
      appendTransaction: (trs, _old, state) => {
        if (!trs.some((t) => t.docChanged)) return null;
        const seen = new Set<string>();
        let tr: Transaction | null = null;
        state.doc.forEach((node, offset) => {
          const id = node.attrs.id as string | null | undefined;
          if (id && !seen.has(id)) {
            seen.add(id);
            return;
          }
          if (!('id' in node.attrs)) return;
          tr ??= state.tr;
          const fresh = uid();
          seen.add(fresh);
          tr.setNodeMarkup(offset, undefined, { ...node.attrs, id: fresh });
        });
        if (tr) (tr as Transaction).setMeta('addToHistory', false);
        return tr;
      },
    }),
  ],
});

/* ------------------------------------------------------------------ */
/* Atajos Markdown al inicio de un párrafo                             */
/* ------------------------------------------------------------------ */

type ShortcutTarget =
  | { kind: 'text'; node: string; attrs?: Record<string, unknown> }
  | { kind: 'divider' }
  | { kind: 'math' };

function blockRule(find: RegExp, target: ShortcutTarget, wholeLine = false) {
  return new InputRule({
    find,
    handler: ({ state, range }) => {
      const $from = state.doc.resolve(range.from);
      if ($from.depth !== 1 || $from.parent.type.name !== 'paragraph') return null;
      // Algunos atajos (```, --- y $$) solo valen si la línea no tiene más texto.
      if (wholeLine && $from.parent.content.size !== range.to - range.from) return null;
      const tr = state.tr;
      const blockPos = $from.before(1);
      const id = $from.parent.attrs.id as string;
      tr.delete(range.from, range.to);
      const schema = state.schema;

      if (target.kind === 'divider') {
        const para = tr.doc.nodeAt(blockPos)!;
        const hr = schema.nodes.horizontalRule!.create({ id });
        tr.replaceWith(blockPos, blockPos + para.nodeSize, [
          hr,
          schema.nodes.paragraph!.create({ id: uid() }, para.content),
        ]);
        tr.setSelection(TextSelection.create(tr.doc, blockPos + hr.nodeSize + 1));
        return;
      }
      if (target.kind === 'math') {
        const math = schema.nodes.mathBlock!.create({ id, tex: '' });
        tr.replaceWith(blockPos, blockPos + tr.doc.nodeAt(blockPos)!.nodeSize, [
          math,
          schema.nodes.paragraph!.create({ id: uid() }),
        ]);
        tr.setSelection(NodeSelection.create(tr.doc, blockPos));
        openWhenMounted(id);
        return;
      }
      const type = schema.nodes[target.node]!;
      tr.setNodeMarkup(blockPos, type, { id, ...target.attrs });
    },
  });
}

export const BlockShortcuts = Extension.create({
  name: 'blockShortcuts',
  addInputRules: () => [
    blockRule(/^#\s$/, { kind: 'text', node: 'heading', attrs: { level: 1 } }),
    blockRule(/^##\s$/, { kind: 'text', node: 'heading', attrs: { level: 2 } }),
    blockRule(/^###\s$/, { kind: 'text', node: 'heading', attrs: { level: 3 } }),
    blockRule(/^[-*+]\s$/, { kind: 'text', node: 'bullet' }),
    blockRule(/^1[.)]\s$/, { kind: 'text', node: 'num' }),
    blockRule(/^\[\s?\]\s$/, { kind: 'text', node: 'todo', attrs: { checked: false } }),
    blockRule(/^\[x\]\s$/i, { kind: 'text', node: 'todo', attrs: { checked: true } }),
    blockRule(/^>\s$/, { kind: 'text', node: 'quote' }),
    blockRule(/^```$/, { kind: 'text', node: 'codeBlock' }, true),
    blockRule(/^---$/, { kind: 'divider' }, true),
    blockRule(/^\$\$$/, { kind: 'math' }, true),
  ],
});

/* ------------------------------------------------------------------ */
/* Enter y Backspace                                                   */
/* ------------------------------------------------------------------ */

function handleEnter(
  state: EditorState,
  dispatch: (tr: Transaction) => void,
  mod: boolean,
): boolean {
  const schema = state.schema;
  const { selection } = state;

  // Bloque atómico seleccionado (separador, subpágina…): nuevo párrafo debajo.
  if (selection instanceof NodeSelection && selection.$from.depth === 0) {
    const after = selection.to;
    const tr = state.tr.insert(after, schema.nodes.paragraph!.create({ id: uid() }));
    tr.setSelection(TextSelection.create(tr.doc, after + 1));
    dispatch(tr.scrollIntoView());
    return true;
  }

  const { $from } = selection;
  if ($from.depth !== 1) return false;
  const block = $from.parent;
  const name = block.type.name;

  if (name === 'codeBlock') {
    if (!mod) {
      dispatch(state.tr.insertText('\n').scrollIntoView());
      return true;
    }
    const after = $from.after(1);
    const tr = state.tr.insert(after, schema.nodes.paragraph!.create({ id: uid() }));
    tr.setSelection(TextSelection.create(tr.doc, after + 1));
    dispatch(tr.scrollIntoView());
    return true;
  }

  const isList = LIST_NODES.has(name);
  // Lista vacía + Enter = párrafo.
  if (isList && block.content.size === 0) {
    dispatch(
      state.tr.setNodeMarkup($from.before(1), schema.nodes.paragraph, { id: block.attrs.id }),
    );
    return true;
  }

  const tr = state.tr;
  if (!selection.empty) tr.deleteSelection();
  const $pos = tr.selection.$from;
  const nextType = isList ? block.type : schema.nodes.paragraph!;
  const nextAttrs = isList
    ? { ...block.attrs, id: uid(), ...(name === 'todo' ? { checked: false } : {}) }
    : { id: uid() };

  // Al inicio de un bloque con texto: párrafo vacío encima y el bloque sigue igual.
  if ($pos.parentOffset === 0 && $pos.parent.content.size > 0) {
    const before = $pos.before(1);
    tr.insert(before, nextType.create(nextAttrs));
    dispatch(tr.scrollIntoView());
    return true;
  }

  tr.split($pos.pos, 1, [{ type: nextType, attrs: nextAttrs }]);
  dispatch(tr.scrollIntoView());
  return true;
}

function handleBackspace(state: EditorState, dispatch: (tr: Transaction) => void): boolean {
  const { selection, schema } = state;
  if (!selection.empty) return false;
  const { $from } = selection;
  if ($from.depth !== 1 || $from.parentOffset !== 0) return false;
  const block = $from.parent;
  const name = block.type.name;
  const blockPos = $from.before(1);

  // Al inicio de cualquier bloque que no sea párrafo: se convierte en párrafo.
  if (name !== 'paragraph') {
    const p = convertedNode(schema, block, 'p');
    const tr = state.tr.replaceWith(blockPos, blockPos + block.nodeSize, p);
    tr.setSelection(TextSelection.create(tr.doc, blockPos + 1));
    dispatch(tr);
    return true;
  }

  const index = $from.index(0);
  if (index === 0) return false;
  const prev = state.doc.child(index - 1);

  // Párrafo vacío después de un bloque atómico: se borra el párrafo.
  if (!prev.isTextblock && block.content.size === 0) {
    const tr = state.tr.delete(blockPos, blockPos + block.nodeSize);
    tr.setSelection(NodeSelection.create(tr.doc, blockPos - prev.nodeSize));
    dispatch(tr);
    return true;
  }

  // Unir con un bloque de código anterior: el texto se agrega como texto plano.
  if (prev.type.name === 'codeBlock') {
    const text = block.textContent;
    const tr = state.tr.delete(blockPos, blockPos + block.nodeSize);
    const end = blockPos - 1;
    if (text) tr.insertText(text, end);
    tr.setSelection(TextSelection.create(tr.doc, end));
    dispatch(tr);
    return true;
  }
  return false; // El comportamiento normal une con el bloque anterior.
}

export const BlockKeymap = Extension.create({
  name: 'blockKeymap',
  priority: 1000,
  addKeyboardShortcuts() {
    const view = () => this.editor.view;
    return {
      Enter: () => handleEnter(view().state, view().dispatch, false),
      'Mod-Enter': () => {
        const { $from } = view().state.selection;
        if ($from.parent.type.name !== 'codeBlock') return false;
        return handleEnter(view().state, view().dispatch, true);
      },
      Backspace: () => handleBackspace(view().state, view().dispatch),
      Tab: () => {
        const { $from } = view().state.selection;
        if ($from.parent.type.name !== 'codeBlock') return false;
        view().dispatch(view().state.tr.insertText('  '));
        return true;
      },
    };
  },
});

/* ------------------------------------------------------------------ */
/* Formato en línea al salir del bloque                                */
/* ------------------------------------------------------------------ */

const INLINE_MD_NODES = new Set(['paragraph', 'heading', 'bullet', 'num', 'todo', 'quote']);

/** Aplica `**negrita**`, `*cursiva*`, `` `código` ``, `~~tachado~~`, `[texto](url)` y `$fórmula$` a un bloque. */
export function applyInlineMarkdown(view: EditorView, id: string): boolean {
  const found = findBlock(view.state.doc, id);
  if (!found || !INLINE_MD_NODES.has(found.node.type.name)) return false;
  const { node, pos } = found;
  if (!/[*`~[$]/.test(node.textContent)) return false;
  const schema = view.state.schema;
  const html = inlineHtml(node, schema);
  const converted = inlineMd(html);
  if (converted === html) return false;
  const content: Fragment = inlineFragment(converted, schema);
  const tr = view.state.tr.replaceWith(pos + 1, pos + node.nodeSize - 1, content);
  view.dispatch(tr);
  return true;
}

function blockIdAt(state: EditorState): string | null {
  const { $from } = state.selection;
  if ($from.depth < 1) return null;
  return ($from.node(1) as PMNode).attrs.id ?? null;
}

export const InlineMarkdownOnLeave = Extension.create({
  name: 'inlineMarkdownOnLeave',
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey('inlineMarkdownOnLeave'),
        view: () => ({
          update: (view, prev) => {
            const before = blockIdAt(prev);
            if (!before || before === blockIdAt(view.state)) return;
            queueMicrotask(() => {
              if (!editor.isDestroyed) applyInlineMarkdown(view, before);
            });
          },
        }),
        props: {
          handleDOMEvents: {
            blur: (view) => {
              const id = blockIdAt(view.state);
              if (id)
                queueMicrotask(() => {
                  if (!editor.isDestroyed) applyInlineMarkdown(view, id);
                });
              return false;
            },
          },
        },
      }),
    ];
  },
});
