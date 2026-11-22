/** Guardados pendientes (con espera) que deben completarse antes de leer o exportar una página. */
const flushers = new Set<() => Promise<void> | void>();

export function registerFlush(fn: () => Promise<void> | void): () => void {
  flushers.add(fn);
  return () => flushers.delete(fn);
}

export async function flushPending(): Promise<void> {
  await Promise.all(Array.from(flushers, (f) => f()));
}
