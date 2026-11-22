import { type ReactNode, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { type AnchorRect, placeFloating } from './place';

export type { AnchorRect };

type Props = {
  anchor: AnchorRect;
  onClose: () => void;
  children: ReactNode;
  label: string;
  className?: string;
  /** No cierra al tocar fuera si el toque cae dentro de este elemento (p. ej. el editor). */
  keepOpenWithin?: () => HTMLElement | null;
  /** Evita que el menú robe el foco (menú `/` mientras se escribe). */
  preventFocusSteal?: boolean;
};

export function Popover({
  anchor,
  onClose,
  children,
  label,
  className,
  keepOpenWithin,
  preventFocusSteal,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useLayoutEffect(() => {
    close.current = onClose;
  });

  useLayoutEffect(() => {
    if (ref.current) placeFloating(ref.current, anchor);
  }, [anchor]);

  useLayoutEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      if (keepOpenWithin?.()?.contains(t)) return;
      close.current();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('keydown', key);
    };
  }, [keepOpenWithin]);

  return createPortal(
    <div
      ref={ref}
      className={'pop ' + (className ?? '')}
      role="menu"
      aria-label={label}
      onPointerDown={preventFocusSteal ? (e) => e.preventDefault() : undefined}
    >
      {children}
    </div>,
    document.body,
  );
}
