import type { AnyPage, Block } from '@cuaderno/shared';
import { inlineToMd, mdLineToHtml } from './html';
import { esc, strip, uid } from './text';

const LIST_TYPES = new Set(['bullet', 'num', 'todo']);

/** Texto plano de un bloque de código (su `html` guarda el texto escapado). */
function codeText(html: string): string {
  const t = document.createElement('template');
  t.innerHTML = html;
  return t.content.textContent ?? '';
}

export type TitleLookup = (pageId: string) => string | undefined;

/** Bloques → Markdown. LaTeX como `$$...$$`; las listas seguidas van sin línea en blanco. */
export function blocksToMarkdown(blocks: Block[], titleOf: TitleLookup = () => undefined): string {
  const out: string[] = [];
  let n = 0;
  let prevList = false;

  for (const b of blocks) {
    n = b.type === 'num' ? n + 1 : 0;
    let line: string;
    switch (b.type) {
      case 'p':
        line = inlineToMd(b.html);
        break;
      case 'h1':
        line = '# ' + inlineToMd(b.html);
        break;
      case 'h2':
        line = '## ' + inlineToMd(b.html);
        break;
      case 'h3':
        line = '### ' + inlineToMd(b.html);
        break;
      case 'bullet':
        line = '- ' + inlineToMd(b.html);
        break;
      case 'num':
        line = `${n}. ` + inlineToMd(b.html);
        break;
      case 'todo':
        line = `- [${b.checked ? 'x' : ' '}] ` + inlineToMd(b.html);
        break;
      case 'quote':
        line = '> ' + inlineToMd(b.html);
        break;
      case 'code':
        line = '```\n' + codeText(b.html) + '\n```';
        break;
      case 'divider':
        line = '---';
        break;
      case 'math':
        line = '$$\n' + b.tex + '\n$$';
        break;
      case 'img':
        line = `![${strip(b.cap) || 'imagen'}](archivo:${b.fileId})`;
        break;
      case 'draw':
        line = '*(dibujo a mano)*';
        break;
      case 'link': {
        const title = titleOf(b.pageId);
        line = `→ ${title === undefined ? 'Página eliminada' : title || 'Sin título'}`;
        break;
      }
    }
    if (b.type === 'p' && !line.trim()) {
      prevList = false;
      continue;
    }
    const isList = LIST_TYPES.has(b.type);
    out.push((isList && prevList ? '' : '\n') + line);
    prevList = isList;
  }
  return out.join('\n').replace(/^\n+/, '') + '\n';
}

/** Página completa → Markdown, con el icono y el título como encabezado. */
export function pageToMarkdown(page: AnyPage, titleOf?: TitleLookup): string {
  const head = `# ${page.icon} ${page.title || 'Sin título'}\n\n`;
  if (page.kind !== 'page') return head;
  return head + blocksToMarkdown(page.blocks, titleOf);
}

/** Markdown → bloques (para pegar). Reconoce títulos, listas, tareas, citas, código, `---` y `$$`. */
export function markdownToBlocks(md: string): Block[] {
  const out: Block[] = [];
  let code: string[] | null = null;
  let math: string[] | null = null;
  const text = (type: 'p' | 'h1' | 'h2' | 'h3' | 'bullet' | 'num' | 'quote', s: string) =>
    out.push({ id: uid(), type, html: mdLineToHtml(s) });

  for (const l of md.replace(/\r/g, '').split('\n')) {
    if (code) {
      if (/^```/.test(l)) {
        out.push({ id: uid(), type: 'code', html: esc(code.join('\n')) });
        code = null;
      } else code.push(l);
      continue;
    }
    if (math) {
      if (/^\s*\$\$\s*$/.test(l)) {
        out.push({ id: uid(), type: 'math', tex: math.join('\n') });
        math = null;
      } else math.push(l);
      continue;
    }
    if (/^\s*\$\$\s*$/.test(l)) {
      math = [];
      continue;
    }
    const oneLineMath = l.match(/^\s*\$\$(.+)\$\$\s*$/);
    if (oneLineMath) {
      out.push({ id: uid(), type: 'math', tex: oneLineMath[1]!.trim() });
      continue;
    }
    if (/^```/.test(l)) {
      code = [];
      continue;
    }
    if (!l.trim()) continue;

    let m: RegExpMatchArray | null;
    if ((m = l.match(/^(#{1,3})\s+(.*)/))) text(`h${m[1]!.length}` as 'h1' | 'h2' | 'h3', m[2]!);
    else if ((m = l.match(/^\s*[-*]\s+\[( |x)\]\s+(.*)/i)))
      out.push({
        id: uid(),
        type: 'todo',
        html: mdLineToHtml(m[2]!),
        checked: m[1]!.toLowerCase() === 'x',
      });
    else if (/^(-{3,}|\*{3,}|_{3,})$/.test(l.trim())) out.push({ id: uid(), type: 'divider' });
    else if ((m = l.match(/^\s*[-*+]\s+(.*)/))) text('bullet', m[1]!);
    else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) text('num', m[1]!);
    else if ((m = l.match(/^>\s?(.*)/))) text('quote', m[1]!);
    else text('p', l);
  }
  if (code) out.push({ id: uid(), type: 'code', html: esc(code.join('\n')) });
  if (math) out.push({ id: uid(), type: 'math', tex: math.join('\n') });
  return out.length ? out : [{ id: uid(), type: 'p', html: '' }];
}
