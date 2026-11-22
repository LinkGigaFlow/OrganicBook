import type { Editor } from '@tiptap/core';
import { Fragment, type Node as PMNode, type Schema } from '@tiptap/pm/model';
import { type EditorState, TextSelection, type Transaction } from '@tiptap/pm/state';
import { uid } from '../../../lib/text';
import type { TextType } from './convert';

export type BlockKind = TextType | 'divider';

export type FoundBlock = { node: PMNode; pos: number; index: number };

/** Busca un bloque de primer nivel por su id. */
export function findBlock(doc: PMNode, id: string): FoundBlock | null {
  let found: FoundBlock | null = null;
  doc.forEach((node, offset, index) => {
    if (!found && node.attrs.id === id) found = { node, pos: offset, index };
  });
  return found;
}

/** Bloque de primer nivel que contiene una posición. */
export function blockAt(doc: PMNode, pos: number): FoundBlock | null {
  const clamped = Math.max(0, Math.min(pos, doc.content.size));
  const $p = doc.resolve(clamped);
  if ($p.depth >= 1) {
    const index = $p.index(0);
    return { node: $p.node(1), pos: $p.before(1), index };
  }
  const index = $p.index(0);
  const node = doc.maybeChild(index);
  if (!node) return null;
  let start = 0;
  for (let i = 0; i < index; i++) start += doc.child(i).nodeSize;
  return { node, pos: start, index };
}

/** Bloque de la selección actual (también para atómicos seleccionados). */
export function currentBlock(state: EditorState): FoundBlock | null {
  return blockAt(state.doc, state.selection.from);
}

/** Tipo de nodo y atributos para un tipo de bloque de texto. */
function nodeFor(schema: Schema, kind: TextType): { type: string; attrs: Record<string, unknown> } {
  switch (kind) {
    case 'p':
      return { type: 'paragraph', attrs: {} };
    case 'h1':
    case 'h2':
    case 'h3':
      return { type: 'heading', attrs: { level: Number(kind[1]) } };
    case 'code':
      return { type: 'codeBlock', attrs: {} };
    case 'todo':
      return { type: 'todo', attrs: { checked: false } };
    default:
      void schema;
      return { type: kind, attrs: {} };
  }
}

/** Contenido en línea de un bloque de código: los saltos de línea pasan a `hardBreak`. */
function codeToInline(schema: Schema, text: string): Fragment {
  const parts: PMNode[] = [];
  text.split('\n').forEach((line, i) => {
    if (i > 0) parts.push(schema.nodes.hardBreak!.create());
    if (line) parts.push(schema.text(line));
  });
  return Fragment.from(parts);
}

/** Texto plano de un bloque en línea; los `hardBreak` pasan a salto de línea. */
function inlineToText(node: PMNode): string {
  let s = '';
  node.forEach((c) => {
    if (c.isText) s += c.text;
    else if (c.type.name === 'hardBreak') s += '\n';
    else s += c.textContent;
  });
  return s;
}

/** Crea el nodo de un tipo de bloque de texto con el contenido de otro bloque. */
export function convertedNode(schema: Schema, from: PMNode, kind: TextType): PMNode {
  const { type, attrs } = nodeFor(schema, kind);
  const nodeType = schema.nodes[type]!;
  const id = from.attrs.id as string;
  let content: Fragment;
  if (type === 'codeBlock') {
    const text = from.type.name === 'codeBlock' ? from.textContent : inlineToText(from);
    content = text ? Fragment.from(schema.text(text)) : Fragment.empty;
  } else if (from.type.name === 'codeBlock') {
    content = codeToInline(schema, from.textContent);
  } else if (from.isTextblock) {
    content = from.content;
  } else {
    content = Fragment.empty;
  }
  const checked = type === 'todo' && from.type.name === 'todo' ? from.attrs.checked : false;
  return nodeType.create({ ...attrs, id, ...(type === 'todo' ? { checked } : {}) }, content);
}

const emptyParagraph = (schema: Schema) => schema.nodes.paragraph!.create({ id: uid() });

/** Convierte un bloque en otro tipo, conservando su texto. */
export function convertBlock(tr: Transaction, id: string, kind: BlockKind): Transaction {
  const schema = tr.doc.type.schema;
  const found = findBlock(tr.doc, id);
  if (!found) return tr;
  const { node, pos } = found;

  if (kind === 'divider') {
    const hr = schema.nodes.horizontalRule!.create({ id });
    tr.replaceWith(pos, pos + node.nodeSize, hr);
    const after = pos + hr.nodeSize;
    const next = tr.doc.nodeAt(after);
    if (!next || next.type.name !== 'paragraph') tr.insert(after, emptyParagraph(schema));
    tr.setSelection(TextSelection.near(tr.doc.resolve(after + 1)));
    return tr;
  }

  const replacement = convertedNode(schema, node, kind);
  tr.replaceWith(pos, pos + node.nodeSize, replacement);
  const end = pos + 1 + replacement.content.size;
  tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(end, tr.doc.content.size))));
  return tr;
}

/** Mueve un bloque una posición arriba (-1) o abajo (+1). */
export function moveBlock(tr: Transaction, id: string, dir: -1 | 1): Transaction {
  const found = findBlock(tr.doc, id);
  if (!found) return tr;
  const { node, pos, index } = found;
  const sibling = tr.doc.maybeChild(index + dir);
  if (!sibling) return tr;
  if (dir === -1) {
    const sPos = pos - sibling.nodeSize;
    tr.replaceWith(sPos, pos + node.nodeSize, [node, sibling]);
  } else {
    tr.replaceWith(pos, pos + node.nodeSize + sibling.nodeSize, [sibling, node]);
  }
  return tr;
}

/** Duplica un bloque justo debajo, con id nuevo. */
export function duplicateBlock(tr: Transaction, id: string): Transaction {
  const found = findBlock(tr.doc, id);
  if (!found) return tr;
  const { node, pos } = found;
  const copy = node.type.create({ ...node.attrs, id: uid() }, node.content, node.marks);
  tr.insert(pos + node.nodeSize, copy);
  return tr;
}

/** Elimina un bloque. El documento nunca queda vacío. */
export function deleteBlock(tr: Transaction, id: string): Transaction {
  const found = findBlock(tr.doc, id);
  if (!found) return tr;
  const { node, pos } = found;
  tr.delete(pos, pos + node.nodeSize);
  if (tr.doc.childCount === 0) tr.insert(0, emptyParagraph(tr.doc.type.schema));
  tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size))));
  return tr;
}

/** Reemplaza un bloque por un enlace a subpágina y deja un párrafo vacío debajo si hace falta. */
export function blockToPageLink(tr: Transaction, id: string, pageId: string): Transaction {
  const schema = tr.doc.type.schema;
  const found = findBlock(tr.doc, id);
  if (!found) return tr;
  const link = schema.nodes.pageLink!.create({ id, pageId });
  tr.replaceWith(found.pos, found.pos + found.node.nodeSize, link);
  const after = found.pos + link.nodeSize;
  const next = tr.doc.nodeAt(after);
  if (!next || next.type.name !== 'paragraph') tr.insert(after, emptyParagraph(schema));
  return tr;
}

/** Ejecuta una operación de bloque en el editor. */
export function run(editor: Editor, op: (tr: Transaction) => Transaction, focus = true) {
  const tr = op(editor.state.tr);
  if (!tr.docChanged && !tr.selectionSet) return;
  editor.view.dispatch(tr.scrollIntoView());
  if (focus) editor.view.focus();
}
