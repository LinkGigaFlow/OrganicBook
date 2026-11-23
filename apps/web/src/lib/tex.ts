import { useSyncExternalStore } from 'react';
import { esc } from './text';

/**
 * KaTeX + mhchem van empaquetados con la app (sin CDN) en un trozo aparte que se carga la
 * primera vez que hace falta. Mientras carga, las fórmulas se muestran como código.
 */
type Katex = typeof import('katex').default;

let katex: Katex | null = null;
let loading: Promise<Katex> | null = null;
const listeners = new Set<() => void>();

export function loadTex(): Promise<Katex> {
  loading ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(
    async ([mod]) => {
      await import('katex/contrib/mhchem');
      katex = mod.default;
      listeners.forEach((l) => l());
      return katex;
    },
  );
  return loading;
}

export const texReady = () => katex !== null;

/** Vuelve a pintar cuando KaTeX termina de cargar. */
export function useTexReady(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      void loadTex();
      return () => listeners.delete(cb);
    },
    texReady,
    texReady,
  );
}

/** HTML de una fórmula. Si está vacía muestra un marcador; si tiene errores, KaTeX los marca en rojo. */
export function texToHtml(tex: string, display: boolean): string {
  if (!tex.trim()) {
    return display
      ? '<span class="mph">Ecuación vacía · toca para escribir LaTeX</span>'
      : '<span class="mph">□</span>';
  }
  if (!katex) return `<code class="tex-raw">${esc(tex)}</code>`;
  try {
    return katex.renderToString(tex, {
      displayMode: display,
      throwOnError: false,
      strict: 'ignore',
      trust: false,
      output: 'htmlAndMathml',
    });
  } catch {
    return `<code class="tex-raw">${esc(tex)}</code>`;
  }
}

/** Botones de símbolos: [lo que se muestra, lo que se inserta (`|` = dónde queda el cursor)]. */
export const SYMBOLS: [label: string, snippet: string][] = [
  ['x^{2}', '^{|}'],
  ['x_{i}', '_{|}'],
  ['\\frac{a}{b}', '\\frac{|}{}'],
  ['\\sqrt{x}', '\\sqrt{|}'],
  ['\\sum', '\\sum_{i=1}^{n} |'],
  ['\\int', '\\int_{a}^{b} | \\,dx'],
  ['\\lim', '\\lim_{x \\to |}'],
  ['\\vec{v}', '\\vec{|}'],
  ['\\alpha', '\\alpha'],
  ['\\beta', '\\beta'],
  ['\\pi', '\\pi'],
  ['\\theta', '\\theta'],
  ['\\Delta', '\\Delta'],
  ['\\infty', '\\infty'],
  ['\\pm', '\\pm '],
  ['\\cdot', '\\cdot '],
  ['\\leq', '\\leq '],
  ['\\geq', '\\geq '],
  ['\\neq', '\\neq '],
  ['\\approx', '\\approx '],
  ['\\to', '\\to '],
  ['\\Rightarrow', '\\Rightarrow '],
];

export const TEMPLATES: [label: string, tex: string][] = [
  ['Fórmula cuadrática', 'x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}'],
  ['Matriz 2×2', '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}'],
  ['Sistema de ecuaciones', '\\begin{cases} 2x + y = 5 \\\\ x - y = 1 \\end{cases}'],
  ['Pasos alineados', '\\begin{aligned} f(x) &= (x+1)^2 \\\\ &= x^2 + 2x + 1 \\end{aligned}'],
  ['Derivada', '\\frac{d}{dx}\\left( x^n \\right) = n\\,x^{n-1}'],
  ['Integral definida', '\\int_{a}^{b} f(x)\\,dx = F(b) - F(a)'],
  ['Límite', '\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1'],
  ['Sumatoria', '\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}'],
  ['Probabilidad condicional', 'P(A \\mid B) = \\frac{P(B \\mid A)\\,P(A)}{P(B)}'],
  ['Química', '\\ce{2H2 + O2 -> 2H2O}'],
];

/** Inserta un fragmento en un campo de texto y deja el cursor en el hueco (`|`). */
export function insertSnippet(ta: HTMLTextAreaElement, snippet: string) {
  const hole = snippet.indexOf('|');
  const text = snippet.replace('|', '');
  const start = ta.selectionStart;
  ta.setRangeText(text, start, ta.selectionEnd, 'end');
  if (hole >= 0) ta.selectionStart = ta.selectionEnd = start + hole;
  ta.focus();
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}
