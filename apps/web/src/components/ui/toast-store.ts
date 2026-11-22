import { create } from 'zustand';

type ToastState = { message: string | null; seq: number; show: (m: string) => void };

export const useToast = create<ToastState>()((set) => ({
  message: null,
  seq: 0,
  show: (message) => set((s) => ({ message, seq: s.seq + 1 })),
}));

/** Muestra un aviso breve arriba de la pantalla. */
export const toast = (m: string) => useToast.getState().show(m);
