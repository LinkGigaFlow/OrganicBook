import type { ReactNode } from 'react';
import { IconPage, IconTodo } from '../../../components/ui/icons';
import type { TextType } from './convert';

export type MenuKind = TextType | 'divider' | 'page';

export type MenuItem = { k: MenuKind; label: string; desc: string; kw: string; icon: ReactNode };

/** Bloques disponibles en el menú `/` (los de imagen, dibujo, voz y LaTeX llegan en sus fases). */
export const MENU_ITEMS: MenuItem[] = [
  { k: 'p', label: 'Texto', desc: 'Un párrafo normal', kw: 'parrafo texto', icon: 'Aa' },
  { k: 'h1', label: 'Título 1', desc: 'Encabezado grande', kw: 'heading h1 #', icon: 'H1' },
  { k: 'h2', label: 'Título 2', desc: 'Encabezado mediano', kw: 'heading h2', icon: 'H2' },
  { k: 'h3', label: 'Título 3', desc: 'Encabezado pequeño', kw: 'heading h3', icon: 'H3' },
  { k: 'bullet', label: 'Lista', desc: 'Lista con viñetas', kw: 'bullet viñetas', icon: '•' },
  { k: 'num', label: 'Lista numerada', desc: '1, 2, 3…', kw: 'numero ordenada', icon: '1.' },
  {
    k: 'todo',
    label: 'Tareas',
    desc: 'Casillas para marcar',
    kw: 'todo check pendiente',
    icon: <IconTodo />,
  },
  { k: 'quote', label: 'Cita', desc: 'Texto destacado', kw: 'quote', icon: '❝' },
  { k: 'code', label: 'Código', desc: 'Bloque monoespaciado', kw: 'code programa', icon: '{ }' },
  { k: 'divider', label: 'Separador', desc: 'Línea horizontal', kw: 'linea divider hr', icon: '—' },
  {
    k: 'page',
    label: 'Subpágina',
    desc: 'Página dentro de esta',
    kw: 'page pagina',
    icon: <IconPage />,
  },
];

export const LABEL: Record<MenuKind, string> = Object.fromEntries(
  MENU_ITEMS.map((i) => [i.k, i.label]),
) as Record<MenuKind, string>;
