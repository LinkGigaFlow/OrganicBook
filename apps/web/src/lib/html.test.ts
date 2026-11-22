import { inlineMd, inlineToMd, mdLineToHtml, sanitizeInline } from './html';

describe('sanitizeInline', () => {
  it('deja solo las etiquetas permitidas', () => {
    expect(sanitizeInline('<strong>a</strong><em>b</em><script>x</script><u>c</u>')).toBe(
      '<b>a</b><i>b</i>x<u>c</u>',
    );
  });

  it('quita enlaces que no son http(s) y conserva su texto', () => {
    expect(sanitizeInline('<a href="javascript:alert(1)">x</a>')).toBe('x');
    expect(sanitizeInline('<a href="https://a.cl" target="_blank" onclick="x">a</a>')).toBe(
      '<a href="https://a.cl">a</a>',
    );
  });

  it('conserva las fórmulas en línea', () => {
    expect(sanitizeInline('<span class="tex" data-tex="E=mc^2" style="x">…</span>')).toBe(
      '<span class="tex" data-tex="E=mc^2"></span>',
    );
  });
});

describe('inlineMd', () => {
  it('convierte negrita, cursiva, código, tachado y enlaces', () => {
    expect(inlineMd('**a** *b* `c` ~~d~~ [e](https://e.cl)')).toBe(
      '<b>a</b> <i>b</i> <code>c</code> <s>d</s> <a href="https://e.cl">e</a>',
    );
  });

  it('no convierte dentro del código en línea', () => {
    expect(inlineMd('`**x**`')).toBe('<code>**x**</code>');
    expect(inlineMd('<code>*y*</code> *z*')).toBe('<code>*y*</code> <i>z</i>');
  });

  it('no toca asteriscos sueltos ni multiplicaciones', () => {
    expect(inlineMd('2 * 3 * 4')).toBe('2 * 3 * 4');
  });
});

describe('Markdown en línea, ida y vuelta', () => {
  it.each([
    '<b>negrita</b> y <i>cursiva</i>',
    '<code>x &lt; y</code>',
    '<s>no</s> <u>sí</u>',
    'uno<br>dos',
    '<a href="https://ejemplo.cl/?a=1&amp;b=2">enlace</a>',
  ])('%s', (html) => {
    expect(mdLineToHtml(inlineToMd(html))).toBe(html);
  });
});
