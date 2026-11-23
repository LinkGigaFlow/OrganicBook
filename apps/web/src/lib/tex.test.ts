import { inlineMd, mdLineToHtml } from './html';
import { blocksToMarkdown, markdownToBlocks } from './markdown';
import { insertSnippet, loadTex, SYMBOLS, TEMPLATES, texReady, texToHtml } from './tex';

describe('KaTeX local', () => {
  beforeAll(async () => {
    await loadTex();
  });

  it('carga KaTeX desde el paquete de la app', () => {
    expect(texReady()).toBe(true);
    expect(texToHtml('x^2', false)).toContain('class="katex"');
    expect(texToHtml('x^2', true)).toContain('katex-display');
  });

  it('mhchem: \\ce{H2O} se ve como fórmula química, sin errores', () => {
    const html = texToHtml('\\ce{H2O}', false);
    expect(html).not.toContain('katex-error');
    expect(html).toContain('H');
    expect(html).toContain('msub');
  });

  it('hay 22 símbolos y todas las plantillas se renderizan sin errores', () => {
    expect(SYMBOLS).toHaveLength(22);
    expect(TEMPLATES.map(([l]) => l)).toEqual([
      'Fórmula cuadrática',
      'Matriz 2×2',
      'Sistema de ecuaciones',
      'Pasos alineados',
      'Derivada',
      'Integral definida',
      'Límite',
      'Sumatoria',
      'Probabilidad condicional',
      'Química',
    ]);
    for (const [, t] of TEMPLATES) expect(texToHtml(t, true)).not.toContain('katex-error');
    for (const [l, s] of SYMBOLS) {
      expect(texToHtml(l, false)).not.toContain('katex-error');
      expect(texToHtml(`x${s.replace('|', 'a')}b`, false)).not.toContain('katex-error');
    }
  });

  it('LaTeX inválido no rompe: se marca el error', () => {
    expect(texToHtml('\\frac{', false)).toContain('katex-error');
    expect(texToHtml('  ', true)).toContain('Ecuación vacía');
  });
});

describe('insertSnippet', () => {
  it('deja el cursor en el hueco', () => {
    const ta = document.createElement('textarea');
    document.body.append(ta);
    ta.value = 'a + ';
    ta.selectionStart = ta.selectionEnd = 4;
    insertSnippet(ta, '\\frac{|}{}');
    expect(ta.value).toBe('a + \\frac{}{}');
    expect(ta.selectionStart).toBe(10);
    ta.remove();
  });
});

describe('fórmulas en línea con $...$', () => {
  it('convierte $...$ en una fórmula atómica', () => {
    expect(inlineMd('La energía $E=mc^2$ es famosa')).toBe(
      'La energía <span class="tex" data-tex="E=mc^2"></span> es famosa',
    );
  });

  it('no convierte montos: «$500 y $300»', () => {
    expect(inlineMd('Cuesta $500 y $300')).toBe('Cuesta $500 y $300');
    expect(inlineMd('de $5 a $10 pesos')).toBe('de $5 a $10 pesos');
    expect(inlineMd('escapado \\$x$')).toBe('escapado \\$x$');
  });

  it('el contenido de la fórmula no recibe formato y conserva < y &', () => {
    const html = inlineMd('$a*b*c$ y $x&lt;y$ y **negrita** y $\\begin{matrix}1&2\\end{matrix}$');
    expect(html).toContain('data-tex="a*b*c"');
    expect(html).toContain('data-tex="x&lt;y"');
    expect(html).toContain('<b>negrita</b>');
    expect(html).toContain('data-tex="\\begin{matrix}1&amp;2\\end{matrix}"');
    expect(html).not.toContain('<i>');
  });

  it('no toca el $ dentro de código', () => {
    expect(mdLineToHtml('`$x$` y $y$')).toBe(
      '<code>$x$</code> y <span class="tex" data-tex="y"></span>',
    );
  });

  it('exportar y volver a pegar conserva fórmulas en línea y en bloque', () => {
    const md = blocksToMarkdown([
      { id: '1', type: 'p', html: 'Área <span class="tex" data-tex="\\pi r^2"></span> total' },
      { id: '2', type: 'math', tex: '\\ce{2H2 + O2 -> 2H2O}' },
    ]);
    expect(md).toBe('Área $\\pi r^2$ total\n\n$$\n\\ce{2H2 + O2 -> 2H2O}\n$$\n');
    const back = markdownToBlocks(md).map((b) =>
      Object.fromEntries(Object.entries(b).filter(([k]) => k !== 'id')),
    );
    expect(back).toEqual([
      { type: 'p', html: 'Área <span class="tex" data-tex="\\pi r^2"></span> total' },
      { type: 'math', tex: '\\ce{2H2 + O2 -> 2H2O}' },
    ]);
  });
});
