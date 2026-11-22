import type { Block } from '@cuaderno/shared';
import { blocksToMarkdown, markdownToBlocks } from './markdown';

const withoutIds = (bs: Block[]) =>
  bs.map((b) => Object.fromEntries(Object.entries(b).filter(([k]) => k !== 'id')));

describe('Markdown', () => {
  const blocks: Block[] = [
    { id: '1', type: 'h1', html: 'Título' },
    { id: '2', type: 'h2', html: 'Sección <i>dos</i>' },
    { id: '3', type: 'h3', html: 'Tres' },
    { id: '4', type: 'p', html: 'Texto con <b>negrita</b>, <code>código</code> y <s>tachado</s>' },
    { id: '5', type: 'bullet', html: 'uno' },
    { id: '6', type: 'bullet', html: 'dos' },
    { id: '7', type: 'num', html: 'primero' },
    { id: '8', type: 'num', html: 'segundo' },
    { id: '9', type: 'todo', html: 'hecha', checked: true },
    { id: '10', type: 'todo', html: 'pendiente', checked: false },
    { id: '11', type: 'quote', html: 'Una cita' },
    { id: '12', type: 'code', html: 'if (a &lt; b) {\n  return;\n}' },
    { id: '13', type: 'divider' },
    { id: '14', type: 'math', tex: '\\frac{a}{b}' },
    { id: '15', type: 'p', html: 'Enlace <a href="https://ejemplo.cl">aquí</a>' },
    { id: '16', type: 'img', fileId: 'abc-123', cap: 'Mi foto', size: 'l' },
    { id: '17', type: 'img', fileId: 'def', cap: '', size: 'l' },
  ];

  it('exportar y volver a pegar da los mismos bloques', () => {
    const md = blocksToMarkdown(blocks);
    expect(withoutIds(markdownToBlocks(md))).toEqual(withoutIds(blocks));
  });

  it('exporta listas seguidas sin líneas en blanco y numera', () => {
    const md = blocksToMarkdown(blocks);
    expect(md).toContain('- uno\n- dos\n1. primero\n2. segundo\n- [x] hecha\n- [ ] pendiente');
    expect(md).toContain('```\nif (a < b) {\n  return;\n}\n```');
    expect(md).toContain('$$\n\\frac{a}{b}\n$$');
  });

  it('omite párrafos vacíos y muestra el título de las subpáginas', () => {
    const md = blocksToMarkdown(
      [
        { id: 'a', type: 'p', html: '' },
        { id: 'b', type: 'link', pageId: 'x' },
        { id: 'c', type: 'link', pageId: 'gone' },
      ],
      (id) => (id === 'x' ? 'Ideas' : undefined),
    );
    expect(md).toBe('→ Ideas\n\n→ Página eliminada\n');
  });

  it('reconoce $$ en una línea y listas con * y +', () => {
    expect(withoutIds(markdownToBlocks('$$x^2$$\n* a\n+ b\n2) c\n***'))).toEqual([
      { type: 'math', tex: 'x^2' },
      { type: 'bullet', html: 'a' },
      { type: 'bullet', html: 'b' },
      { type: 'num', html: 'c' },
      { type: 'divider' },
    ]);
  });

  it('escapa el HTML del texto pegado', () => {
    expect(withoutIds(markdownToBlocks('<img src=x onerror=alert(1)>\nhola'))).toEqual([
      { type: 'p', html: '&lt;img src=x onerror=alert(1)&gt;' },
      { type: 'p', html: 'hola' },
    ]);
  });
});
