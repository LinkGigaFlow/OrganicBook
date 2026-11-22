/** Identificador corto y aleatorio para páginas y bloques. */
export function uid(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

/** Escapa texto para insertarlo en HTML. */
export function esc(s: unknown): string {
  return String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string,
  );
}

/** Texto plano de un fragmento HTML. */
export function strip(html: string | undefined | null): string {
  if (!html) return '';
  const t = document.createElement('template');
  t.innerHTML = html;
  return (t.content.textContent ?? '').replace(/\xa0/g, ' ').trim();
}

/** Normaliza para buscar sin tildes ni mayúsculas. */
export function norm(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
