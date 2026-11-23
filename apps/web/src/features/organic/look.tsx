import type { Note, OrganicPage } from '@cuaderno/shared';
import type { CSSProperties, ReactNode } from 'react';
import { IconImage, IconMic, IconPen, IconText } from '../../components/ui/icons';
import { BOARD_FONTS, BOARD_STYLES } from './model';

export const KIND_ICON: Record<Note['kind'], ReactNode> = {
  md: <IconText />,
  voice: <IconMic />,
  draw: <IconPen />,
  img: <IconImage />,
};

/** Fondo oscurecido con una foto (CSS). */
export const dimmedBg = (url: string, dim: number) =>
  `linear-gradient(rgba(0,0,0,${dim}),rgba(0,0,0,${dim})),url("${url}")`;

/** Variables de estilo del cuaderno (fondo, tinta y letra). */
export function styleVars(page: OrganicPage): CSSProperties {
  const s = BOARD_STYLES[page.style.bg] ?? BOARD_STYLES.pizarra;
  return {
    '--obg': s.bg,
    '--oink': page.style.ink,
    '--ofont': BOARD_FONTS[page.style.font] ?? BOARD_FONTS.mano,
  } as CSSProperties;
}
