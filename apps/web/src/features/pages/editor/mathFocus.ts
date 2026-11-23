/** Ecuaciones recién creadas cuyo editor debe abrirse al aparecer (por id de bloque). */
const pending = new Set<string>();

export const openWhenMounted = (id: string) => void pending.add(id);

/** Devuelve true (una sola vez) si el bloque pidió abrir su editor. */
export const takeOpenRequest = (id: string) => pending.delete(id);
