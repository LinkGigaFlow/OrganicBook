import type { Settings } from '@cuaderno/shared';
import { useEffect } from 'react';
import { useAppStore } from '../../app/store';

/** Colores de acento (SPEC). */
export const ACCENTS = ['#3b5bdb', '#0c8599', '#2b8a3e', '#e8590c', '#d6336c', '#7048e8'] as const;

export const SKINS: [Settings['skin'], string][] = [
  ['auto', 'Automático'],
  ['light', 'Claro'],
  ['dark', 'Oscuro'],
  ['sepia', 'Sepia'],
];
export const FONTS: [Settings['font'], string][] = [
  ['sans', 'Sans'],
  ['serif', 'Serif'],
  ['mono', 'Mono'],
];
export const SIZES: [Settings['size'], string][] = [
  ['s', '15 px'],
  ['m', '16 px'],
  ['l', '18 px'],
];
export const WIDTHS: [Settings['width'], string][] = [
  ['normal', 'Normal'],
  ['wide', 'Ancho'],
];

/** Color de fondo de cada tema (para la barra del sistema en el celular). */
const THEME_BG = { light: '#ffffff', dark: '#191919', sepia: '#f7f1e5' } as const;

export function themeColor(skin: Settings['skin'], prefersDark: boolean): string {
  if (skin === 'auto') return prefersDark ? THEME_BG.dark : THEME_BG.light;
  return THEME_BG[skin];
}

/** Aplica la apariencia al documento: atributos `data-*` en <html> y el color de acento. */
export function applyAppearance(s: Settings, root: HTMLElement = document.documentElement) {
  root.dataset.skin = s.skin;
  root.dataset.font = s.font;
  root.dataset.size = s.size;
  root.dataset.width = s.width;
  root.style.setProperty('--ac', s.accent);
  const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
  }
  meta.content = themeColor(s.skin, dark);
}

/** Mantiene la apariencia al día con los ajustes (y con el tema del sistema en "Automático"). */
export function useAppearance() {
  const settings = useAppStore((s) => s.settings);
  useEffect(() => {
    applyAppearance(settings);
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyAppearance(settings);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [settings]);
}
