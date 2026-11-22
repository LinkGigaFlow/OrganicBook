import type { Settings } from '@cuaderno/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const defaultSettings: Settings = {
  skin: 'auto',
  accent: '#3b5bdb',
  font: 'sans',
  size: 'm',
  width: 'normal',
  lang: 'es-CL',
  penOnly: false,
};

type AppState = {
  currentPageId: string | null;
  /** Páginas expandidas en el árbol de la barra lateral. */
  expanded: Record<string, boolean>;
  /** Cajón de páginas abierto (pantallas de menos de 860 px). */
  drawerOpen: boolean;
  query: string;
  /** Página recién creada cuyo título debe recibir el foco. */
  focusTitleFor: string | null;
  settings: Settings;
  openPage: (id: string | null, opts?: { focusTitle?: boolean }) => void;
  toggleExpanded: (id: string, open?: boolean) => void;
  setDrawer: (open: boolean) => void;
  setQuery: (q: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
};

/** Estado global de la app. La página actual y el árbol abierto se recuerdan entre visitas. */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentPageId: null,
      expanded: {},
      drawerOpen: false,
      query: '',
      focusTitleFor: null,
      settings: defaultSettings,
      openPage: (id, opts) =>
        set({ currentPageId: id, drawerOpen: false, focusTitleFor: opts?.focusTitle ? id : null }),
      toggleExpanded: (id, open) =>
        set((s) => ({ expanded: { ...s.expanded, [id]: open ?? !s.expanded[id] } })),
      setDrawer: (drawerOpen) => set({ drawerOpen }),
      setQuery: (query) => set({ query }),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    {
      name: 'cuaderno-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        currentPageId: s.currentPageId,
        expanded: s.expanded,
        settings: s.settings,
      }),
    },
  ),
);
