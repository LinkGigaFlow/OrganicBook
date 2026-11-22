import type { Block, Stroke, TextBlockType } from '@cuaderno/shared';
import {
  DOMParser as PMDOMParser,
  DOMSerializer,
  type Fragment,
  type Node as PMNode,
  type Schema,
} from '@tiptap/pm/model';
import { sanitizeInline } from '../../../lib/html';
import { esc, uid } from '../../../lib/text';

/** Tipos de bloque con texto editable (los que se pueden convertir entre sí). */
export const TEXT_TYPES = [
  'p',
  'h1',
  'h2',
  'h3',
  'bullet',
  'num',
  'todo',
  'quote',
  'code',
] as const;
export type TextType = (typeof TEXT_TYPES)[number];
export const isTextType = (t: string): t is TextType =>
  (TEXT_TYPES as readonly string[]).includes(t);

/** Nodos de ProseMirror que corresponden a un bloque del modelo. */
export const BLOCK_NODE_NAMES = [
  'paragraph',
  'heading',
  'bullet',
  'num',
  'todo',
  'quote',
  'codeBlock',
  'horizontalRule',
  'pageLink',
  'image',
  'drawing',
  'rawBlock',
] as const;

const attr = (k: string, v: string) => ` ${k}="${esc(v)}"`;

/** Bloques → HTML que entiende el esquema del editor. */
export function blocksToHtml(blocks: Block[]): string {
  return blocks
    .map((b) => {
      const id = attr('data-id', b.id);
      switch (b.type) {
        case 'p':
          return `<p${id}>${b.html}</p>`;
        case 'h1':
        case 'h2':
        case 'h3':
          return `<${b.type}${id}>${b.html}</${b.type}>`;
        case 'bullet':
        case 'num':
        case 'quote':
          return `<div data-block="${b.type}"${id}>${b.html}</div>`;
        case 'todo':
          return `<div data-block="todo"${id}${attr('data-checked', String(!!b.checked))}>${b.html}</div>`;
        case 'code':
          return `<pre${id}><code>${b.html}</code></pre>`;
        case 'divider':
          return `<hr${id}>`;
        case 'link':
          return `<div data-block="link"${id}${attr('data-page-id', b.pageId)}></div>`;
        case 'img':
          return `<figure data-block="img"${id}${attr('data-file-id', b.fileId)}${attr('data-cap', b.cap)}${attr('data-size', b.size)}></figure>`;
        case 'draw':
          return `<div data-block="draw"${id}${attr('data-h', String(b.h))}${attr('data-strokes', JSON.stringify(b.strokes))}></div>`;
        default:
          return `<div data-block="raw"${id}${attr('data-json', JSON.stringify(b))}></div>`;
      }
    })
    .join('');
}

/** Contenido en línea de un nodo → HTML limpio del modelo. */
export function inlineHtml(node: PMNode, schema: Schema): string {
  const div = document.createElement('div');
  div.append(DOMSerializer.fromSchema(schema).serializeFragment(node.content));
  return sanitizeInline(div.innerHTML);
}

/** Un nodo de bloque → bloque del modelo. */
export function nodeToBlock(node: PMNode, schema: Schema): Block {
  const id = (node.attrs.id as string | null) || uid();
  switch (node.type.name) {
    case 'paragraph':
      return { id, type: 'p', html: inlineHtml(node, schema) };
    case 'heading':
      return {
        id,
        type: `h${Math.min(3, Math.max(1, node.attrs.level as number))}` as TextBlockType,
        html: inlineHtml(node, schema),
      };
    case 'bullet':
    case 'num':
    case 'quote':
      return { id, type: node.type.name, html: inlineHtml(node, schema) };
    case 'todo':
      return { id, type: 'todo', html: inlineHtml(node, schema), checked: !!node.attrs.checked };
    case 'codeBlock':
      return { id, type: 'code', html: esc(node.textContent) };
    case 'horizontalRule':
      return { id, type: 'divider' };
    case 'pageLink':
      return { id, type: 'link', pageId: node.attrs.pageId as string };
    case 'image':
      return {
        id,
        type: 'img',
        fileId: node.attrs.fileId as string,
        cap: sanitizeInline(node.attrs.cap as string),
        size: node.attrs.size as 's' | 'm' | 'l',
      };
    case 'drawing':
      return {
        id,
        type: 'draw',
        strokes: node.attrs.strokes as Stroke[],
        h: node.attrs.h as number,
      };
    case 'rawBlock': {
      try {
        return { ...(JSON.parse(node.attrs.json as string) as Block), id };
      } catch {
        return { id, type: 'p', html: '' };
      }
    }
    default:
      return { id, type: 'p', html: esc(node.textContent) };
  }
}

/** Documento del editor → lista de bloques. */
export function docToBlocks(doc: PMNode, schema: Schema): Block[] {
  const out: Block[] = [];
  doc.forEach((n) => out.push(nodeToBlock(n, schema)));
  return out;
}

/** Bloques → fragmento de nodos de ProseMirror (para pegar o insertar). */
export function blocksToFragment(blocks: Block[], schema: Schema): Fragment {
  const div = document.createElement('div');
  div.innerHTML = blocksToHtml(blocks);
  return PMDOMParser.fromSchema(schema).parse(div).content;
}

/** HTML en línea → fragmento en línea de ProseMirror. */
export function inlineFragment(html: string, schema: Schema): Fragment {
  const p = document.createElement('p');
  p.innerHTML = html;
  return (
    PMDOMParser.fromSchema(schema).parse(p).firstChild?.content ??
    schema.nodes.paragraph!.create().content
  );
}
