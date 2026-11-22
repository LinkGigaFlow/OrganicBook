import type { Extensions } from '@tiptap/core';
import Bold from '@tiptap/extension-bold';
import Code from '@tiptap/extension-code';
import CodeBlock from '@tiptap/extension-code-block';
import Document from '@tiptap/extension-document';
import HardBreak from '@tiptap/extension-hard-break';
import Heading from '@tiptap/extension-heading';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Italic from '@tiptap/extension-italic';
import Link from '@tiptap/extension-link';
import Paragraph from '@tiptap/extension-paragraph';
import Strike from '@tiptap/extension-strike';
import Text from '@tiptap/extension-text';
import Underline from '@tiptap/extension-underline';
import { Dropcursor, Focus, Gapcursor, Placeholder, UndoRedo } from '@tiptap/extensions';
import { BlockIds, BlockKeymap, BlockShortcuts, InlineMarkdownOnLeave } from './behavior';
import { Bullet, Num, PageLink, Quote, RawBlock, TexInline, Todo } from './nodes';

const PLACEHOLDER: Record<string, string> = {
  paragraph: 'Escribe, o pulsa / para ver bloques',
  bullet: 'Lista',
  num: 'Lista',
  todo: 'Tarea',
  quote: 'Cita',
  codeBlock: 'Código',
};

/** Extensiones del editor de bloques. Solo los atajos de bloque usan reglas de entrada. */
export function blockEditorExtensions(): Extensions {
  return [
    Document,
    Text,
    Paragraph,
    Heading.configure({ levels: [1, 2, 3] }),
    Bullet,
    Num,
    Todo,
    Quote,
    CodeBlock.configure({ HTMLAttributes: { spellcheck: 'false' } }),
    HorizontalRule,
    PageLink,
    RawBlock,
    TexInline,
    HardBreak,
    Bold,
    Italic,
    Code,
    Strike,
    Underline,
    Link.configure({
      autolink: false,
      linkOnPaste: false,
      openOnClick: true,
      protocols: ['http', 'https'],
      HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow' },
      isAllowedUri: (url) => /^https?:\/\//i.test(url),
    }),
    UndoRedo,
    Dropcursor,
    Gapcursor,
    Focus.configure({ mode: 'shallowest' }),
    Placeholder.configure({
      showOnlyCurrent: false,
      includeChildren: false,
      placeholder: ({ node }) =>
        node.type.name === 'heading'
          ? `Título ${node.attrs.level as number}`
          : (PLACEHOLDER[node.type.name] ?? ''),
    }),
    BlockIds,
    BlockShortcuts,
    BlockKeymap,
    InlineMarkdownOnLeave,
  ];
}
