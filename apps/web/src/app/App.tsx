import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Toast } from '../components/ui/Toast';
import { VoiceBubble } from '../features/voice/VoiceBubble';
import { db } from '../lib/db';
import { childrenOf, isAlive, pages as repo } from '../lib/pages';
import { PageView } from '../features/pages/PageView';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useAppStore } from './store';

export function App() {
  const [seeded, setSeeded] = useState(false);
  const all = useLiveQuery(() => db.pages.toArray(), []);
  const currentId = useAppStore((s) => s.currentPageId);
  const drawerOpen = useAppStore((s) => s.drawerOpen);
  const setDrawer = useAppStore((s) => s.setDrawer);

  useEffect(() => {
    void repo.seedIfEmpty().finally(() => setSeeded(true));
  }, []);

  const alive = (all ?? []).filter(isAlive);
  const current = alive.find((p) => p.id === currentId);

  // Si la página guardada ya no existe, abre la primera (o crea una si no queda ninguna).
  useEffect(() => {
    if (!seeded || current) return;
    let cancelled = false;
    void (async () => {
      const list = await db.pages.toArray();
      if (cancelled) return;
      if (list.some((p) => p.id === currentId && isAlive(p))) return; // aún cargando
      const first = childrenOf(list, null)[0];
      const id = first ? first.id : (await repo.create(null)).id;
      if (!cancelled) useAppStore.getState().openPage(id);
    })();
    return () => {
      cancelled = true;
    };
  }, [seeded, current, currentId]);

  return (
    <div className={'app' + (drawerOpen ? ' drawer' : '')}>
      <Sidebar pages={alive} currentId={current?.id ?? null} />
      <div className="scrim" onClick={() => setDrawer(false)} aria-hidden="true" />
      <main>
        {current ? (
          <>
            <TopBar pages={alive} page={current} />
            <PageView key={current.id} page={current} />
          </>
        ) : (
          <div className="loading" aria-busy="true" />
        )}
      </main>
      <VoiceBubble />
      <Toast />
    </div>
  );
}
