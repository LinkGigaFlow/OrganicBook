import type { Center, Note, OrganicPage } from '@cuaderno/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { registerFlush } from '../../lib/flush';
import { pages } from '../../lib/pages';

const SAVE_DELAY = 300;

/**
 * Estado del cuaderno orgánico abierto. Los cambios se ven al instante y se guardan en Dexie
 * con una pequeña espera (solo centro, notas y estilo: el título lo guarda la página).
 */
export function useOrganicDoc(initial: OrganicPage) {
  const [doc, setDoc] = useState(initial);
  const ref = useRef(doc);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  const save = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return;
    dirty.current = false;
    const d = ref.current;
    await pages.update(d.id, { center: d.center, notes: d.notes, style: d.style });
  }, []);

  const update = useCallback(
    (fn: (d: OrganicPage) => OrganicPage) => {
      const next = fn(ref.current);
      if (next === ref.current) return;
      ref.current = next;
      setDoc(next);
      dirty.current = true;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(), SAVE_DELAY);
    },
    [save],
  );

  const updateNote = useCallback(
    (id: string, patch: Partial<Note> | ((n: Note) => Partial<Note>)) =>
      update((d) => ({
        ...d,
        notes: d.notes.map((n) =>
          n.id === id ? { ...n, ...(typeof patch === 'function' ? patch(n) : patch) } : n,
        ),
      })),
    [update],
  );

  const updateCenter = useCallback(
    (patch: Partial<Center>) => update((d) => ({ ...d, center: { ...d.center, ...patch } })),
    [update],
  );

  useEffect(() => {
    const off = registerFlush(save);
    const onHide = () => void save();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      off();
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
      void save();
    };
  }, [save]);

  /** Lectura actual sin esperar a React (para manejadores de eventos). */
  const current = useCallback(() => ref.current, []);

  return { doc, update, updateNote, updateCenter, current, save };
}

export type OrganicDoc = ReturnType<typeof useOrganicDoc>;
