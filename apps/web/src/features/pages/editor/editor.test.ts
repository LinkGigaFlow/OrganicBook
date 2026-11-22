import type { Block } from '@cuaderno/shared';
import { Editor, getSchema } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { convertBlock, duplicateBlock, moveBlock } from './blockOps';
import { blocksToFragment, blocksToHtml, docToBlocks } from './convert';
import { blockEditorExtensions } from './extensions';

const schema = getSchema(blockEditorExtensions());

const sample: Block[] = [
  { id: 'a', type: 'h1', html: 'Título <i>uno</i>' },
  {
    id: 'b',
    type: 'p',
    html: 'Hola <b>mundo</b> <a href="https://x.cl">x</a> <span class="tex" data-tex="x^2"></span>',
  },
  { id: 'c', type: 'bullet', html: 'viñeta' },
  { id: 'd', type: 'num', html: 'número' },
  { id: 'e', type: 'todo', html: 'tarea', checked: true },
  { id: 'f', type: 'quote', html: 'cita' },
  { id: 'g', type: 'code', html: 'a &lt; b\n  c' },
  { id: 'h', type: 'divider' },
  { id: 'i', type: 'link', pageId: 'p2' },
  { id: 'j', type: 'math', tex: '\\int_0^1 x\\,dx' },
  { id: 'k', type: 'draw', strokes: [{ t: 'pen', c: 'ink', w: 3, pts: [[1, 2, 0.5]] }], h: 300 },
  { id: 'l', type: 'p', html: 'uno<br>dos' },
];

describe('conversión bloques ↔ editor', () => {
  it('conserva todos los tipos de bloque, sus ids y su contenido', () => {
    const doc = schema.topNodeType.create(null, blocksToFragment(sample, schema));
    expect(docToBlocks(doc, schema)).toEqual(sample);
  });
});

/** Editor sin interfaz con texto de párrafos simples (sin vistas de React). */
function makeEditor(blocks: Block[]) {
  return new Editor({
    extensions: blockEditorExtensions(),
    content: blocksToHtml(blocks),
    enableInputRules: ['blockShortcuts'],
    enablePasteRules: false,
  });
}

/** Simula escribir texto al final del bloque actual (activa las reglas de entrada). */
function type(editor: Editor, text: string) {
  for (const ch of text) {
    const { from, to } = editor.state.selection;
    const handled = editor.view.someProp('handleTextInput', (f) =>
      f(editor.view, from, to, ch, () => editor.state.tr.insertText(ch, from, to)),
    );
    if (!handled) editor.view.dispatch(editor.state.tr.insertText(ch, from, to));
  }
}

function press(editor: Editor, key: string, opts: KeyboardEventInit = {}) {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
  editor.view.someProp('handleKeyDown', (f) => f(editor.view, ev));
}

const blocksOf = (editor: Editor) => docToBlocks(editor.state.doc, editor.schema);
const types = (editor: Editor) => blocksOf(editor).map((b) => b.type);

function caretAt(editor: Editor, pos: number) {
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, pos)));
}

describe('atajos Markdown', () => {
  it.each([
    ['# ', 'h1'],
    ['## ', 'h2'],
    ['### ', 'h3'],
    ['- ', 'bullet'],
    ['* ', 'bullet'],
    ['1. ', 'num'],
    ['[] ', 'todo'],
    ['> ', 'quote'],
    ['```', 'code'],
  ])('«%s» convierte el párrafo en %s', (prefix, expected) => {
    const ed = makeEditor([{ id: 'p', type: 'p', html: '' }]);
    ed.commands.focus('start');
    type(ed, prefix + 'hola');
    const [b] = blocksOf(ed);
    expect(b?.type).toBe(expected);
    expect(b && 'html' in b ? b.html : '').toBe('hola');
    expect(b?.id).toBe('p');
    ed.destroy();
  });

  it('[x] crea una tarea marcada y --- un separador', () => {
    const ed = makeEditor([{ id: 'p', type: 'p', html: '' }]);
    ed.commands.focus('start');
    type(ed, '[x] listo');
    expect(blocksOf(ed)[0]).toMatchObject({ type: 'todo', checked: true, html: 'listo' });
    ed.destroy();

    const ed2 = makeEditor([{ id: 'p', type: 'p', html: '' }]);
    ed2.commands.focus('start');
    type(ed2, '---');
    expect(types(ed2)).toEqual(['divider', 'p']);
    ed2.destroy();
  });

  it('no aplica atajos fuera de un párrafo', () => {
    const ed = makeEditor([{ id: 'q', type: 'quote', html: '' }]);
    ed.commands.focus('start');
    type(ed, '# x');
    expect(blocksOf(ed)[0]).toMatchObject({ type: 'quote', html: '# x' });
    ed.destroy();
  });
});

describe('Enter y Backspace', () => {
  it('Enter divide el bloque y las listas continúan', () => {
    const ed = makeEditor([{ id: 'l', type: 'bullet', html: 'unodos' }]);
    caretAt(ed, 4);
    press(ed, 'Enter');
    const bs = blocksOf(ed);
    expect(bs.map((b) => [b.type, 'html' in b ? b.html : ''])).toEqual([
      ['bullet', 'uno'],
      ['bullet', 'dos'],
    ]);
    expect(new Set(bs.map((b) => b.id)).size).toBe(2);
    ed.destroy();
  });

  it('Enter en un título crea un párrafo; en una lista vacía la vuelve párrafo', () => {
    const ed = makeEditor([{ id: 'h', type: 'h2', html: 'Hola' }]);
    ed.commands.focus('end');
    press(ed, 'Enter');
    expect(types(ed)).toEqual(['h2', 'p']);
    ed.destroy();

    const ed2 = makeEditor([{ id: 't', type: 'todo', html: '', checked: false }]);
    ed2.commands.focus('start');
    press(ed2, 'Enter');
    expect(types(ed2)).toEqual(['p']);
    ed2.destroy();
  });

  it('Enter en código agrega una línea; Ctrl+Enter sale del bloque', () => {
    const ed = makeEditor([{ id: 'c', type: 'code', html: 'a' }]);
    ed.commands.focus('end');
    press(ed, 'Enter');
    expect(blocksOf(ed)).toEqual([{ id: 'c', type: 'code', html: 'a\n' }]);
    press(ed, 'Enter', { ctrlKey: true });
    expect(types(ed)).toEqual(['code', 'p']);
    ed.destroy();
  });

  it('Backspace al inicio convierte en párrafo y luego une con el anterior', () => {
    const ed = makeEditor([
      { id: 'a', type: 'p', html: 'uno' },
      { id: 'b', type: 'h2', html: 'dos' },
    ]);
    caretAt(ed, 6); // inicio del título
    press(ed, 'Backspace');
    expect(types(ed)).toEqual(['p', 'p']);
    ed.destroy();
  });
});

describe('opciones de bloque', () => {
  const start: Block[] = [
    { id: 'a', type: 'p', html: 'A' },
    { id: 'b', type: 'p', html: 'B' },
  ];

  it('mueve, duplica y convierte', () => {
    const ed = makeEditor(start);
    ed.view.dispatch(moveBlock(ed.state.tr, 'b', -1));
    expect(blocksOf(ed).map((b) => b.id)).toEqual(['b', 'a']);
    ed.view.dispatch(duplicateBlock(ed.state.tr, 'a'));
    const ids = blocksOf(ed).map((b) => b.id);
    expect(ids).toHaveLength(3);
    expect(ids[2]).not.toBe('a');
    ed.view.dispatch(convertBlock(ed.state.tr, 'a', 'code'));
    expect(blocksOf(ed)[1]).toEqual({ id: 'a', type: 'code', html: 'A' });
    ed.view.dispatch(convertBlock(ed.state.tr, 'a', 'h3'));
    expect(blocksOf(ed)[1]).toEqual({ id: 'a', type: 'h3', html: 'A' });
    ed.destroy();
  });
});
