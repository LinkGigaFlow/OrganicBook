import { esc } from './text';

/**
 * HTML en línea permitido dentro de los bloques (SPEC: `b, i, code, s, u, a, br, span.tex`).
 * El servidor aplicará la misma lista en la Fase 8.
 */
const ALLOWED: Record<string, string> = {
  B: 'b',
  STRONG: 'b',
  I: 'i',
  EM: 'i',
  CODE: 'code',
  S: 's',
  DEL: 's',
  STRIKE: 's',
  U: 'u',
  A: 'a',
  BR: 'br',
};

const SAFE_URL = /^https?:\/\//i;

/** Limpia HTML en línea dejando solo las etiquetas permitidas. */
export function sanitizeInline(html: string | undefined | null): string {
  const t = document.createElement('template');
  t.innerHTML = html ?? '';
  const out = document.createElement('div');

  const walk = (src: Node, dst: Element) => {
    for (const n of Array.from(src.childNodes)) {
      if (n.nodeType === Node.TEXT_NODE) {
        dst.append((n as Text).data);
        continue;
      }
      if (n.nodeType !== Node.ELEMENT_NODE) continue;
      const el = n as HTMLElement;
      if (el.tagName === 'SPAN' && el.classList.contains('tex')) {
        const s = document.createElement('span');
        s.className = 'tex';
        s.dataset.tex = el.dataset.tex ?? '';
        dst.append(s);
        continue;
      }
      const tag = ALLOWED[el.tagName];
      if (tag) {
        if (tag === 'a') {
          const href = el.getAttribute('href') ?? '';
          if (!SAFE_URL.test(href)) {
            walk(el, dst);
            continue;
          }
          const a = document.createElement('a');
          a.setAttribute('href', href);
          dst.append(a);
          walk(el, a);
          continue;
        }
        const c = document.createElement(tag);
        dst.append(c);
        if (tag !== 'br') walk(el, c);
        continue;
      }
      // Etiqueta no permitida: se conserva su contenido.
      if (['DIV', 'P', 'LI'].includes(el.tagName) && dst.childNodes.length) {
        dst.append(document.createElement('br'));
      }
      walk(el, dst);
    }
  };

  walk(t.content, out);
  // Une etiquetas vecinas iguales (<b>a</b><b>b</b> → <b>ab</b>) para un HTML estable.
  return out.innerHTML.replace(/<\/(b|i|s|u|code)><\1>/g, '');
}

/**
 * `$fórmula$` dentro del texto. No convierte montos como `$500 y $300`: el contenido no puede
 * empezar ni terminar con espacio y el `$` de cierre no puede ir seguido de un dígito o letra.
 */
export const INLINE_TEX = /(^|[^\\$\w])\$([^\s$<>](?:[^$<>]*?[^\s$<>])?)\$(?![\w$])/g;

/** Formato en línea (sin código ni fórmulas) sobre texto escapado. */
function mdMarks(text: string): string {
  return text
    .replace(/\*\*([^*<>]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*\w])\*([^*<>\s][^*<>]*)\*(?!\*)/g, '$1<i>$2</i>')
    .replace(/~~([^~<>]+)~~/g, '<s>$1</s>')
    .replace(/\[([^\]<>]+)\]\((https?:\/\/[^)\s<>"]+)\)/g, '<a href="$2">$1</a>');
}

/** Separa las fórmulas `$...$` (su contenido no recibe formato) del resto del texto. */
function texAndMarks(text: string): string {
  let out = '';
  let last = 0;
  for (const m of text.matchAll(INLINE_TEX)) {
    const start = m.index + m[1]!.length;
    out += mdMarks(text.slice(last, start)) + `<span class="tex" data-tex="${m[2]}"></span>`;
    last = m.index + m[0].length;
  }
  return out + mdMarks(text.slice(last));
}

/** Aplica Markdown en línea a texto ya escapado (sin tocar el código en línea). */
function mdOnEscapedText(text: string): string {
  return text
    .split(/(`[^`<>]+`)/g)
    .map((part, i) => (i % 2 === 1 ? `<code>${part.slice(1, -1)}</code>` : texAndMarks(part)))
    .join('');
}

/**
 * Convierte `**negrita**`, `*cursiva*`, `` `código` ``, `~~tachado~~`, `[texto](url)` y `$fórmula$`
 * en HTML. Solo transforma texto que no esté ya dentro de código, enlaces o fórmulas.
 */
export function inlineMd(html: string): string {
  const t = document.createElement('template');
  t.innerHTML = html;
  const walker = document.createTreeWalker(t.content, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n as Text);

  for (const node of texts) {
    if (node.parentElement?.closest('code, a, span.tex')) continue;
    const escaped = esc(node.data);
    const converted = mdOnEscapedText(escaped);
    if (converted === escaped) continue;
    const tpl = document.createElement('template');
    tpl.innerHTML = converted;
    node.replaceWith(tpl.content);
  }
  return sanitizeInline(t.innerHTML);
}

/** HTML en línea → Markdown. */
export function inlineToMd(html: string): string {
  const t = document.createElement('template');
  t.innerHTML = html ?? '';
  const f = (n: Node): string =>
    Array.from(n.childNodes)
      .map((c) => {
        if (c.nodeType === Node.TEXT_NODE) return (c as Text).data.replace(/\xa0/g, ' ');
        if (c.nodeType !== Node.ELEMENT_NODE) return '';
        const el = c as HTMLElement;
        const inner = f(el);
        switch (el.tagName) {
          case 'B':
            return `**${inner}**`;
          case 'I':
            return `*${inner}*`;
          case 'CODE':
            return '`' + inner + '`';
          case 'S':
            return `~~${inner}~~`;
          case 'U':
            return `<u>${inner}</u>`;
          case 'A':
            return `[${inner}](${el.getAttribute('href') ?? ''})`;
          case 'BR':
            return '<br>';
          case 'SPAN':
            return el.classList.contains('tex') ? `$${el.dataset.tex ?? ''}$` : inner;
          default:
            return inner;
        }
      })
      .join('');
  return f(t.content);
}

/** Markdown en línea (una línea) → HTML seguro. */
export function mdLineToHtml(line: string): string {
  const escaped = esc(line)
    .replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/g, '<u>$1</u>')
    .replace(/&lt;br&gt;/g, '<br>');
  return sanitizeInline(mdOnEscapedText(escaped));
}
