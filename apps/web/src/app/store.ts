import type { Settings } from '@cuaderno/shared';
import { create } from 'zustand';

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
  settings: Settings;
  openPage: (id: string | null) => void;
  updateSettings: (patch: Partial<Settings>) => void;
};

/** Estado global de la app: página actual y ajustes. */
export const useAppStore = create<AppState>()((set) => ({
  currentPageId: null,
  settings: defaultSettings,
  openPage: (id) => set({ currentPageId: id }),
  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
}));
