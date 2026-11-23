import type { Stroke } from '@cuaderno/shared';
import { useEffect, useRef } from 'react';
import { paintThumb } from '../../lib/draw';

type Props = {
  strokes: Stroke[];
  ink: string;
  /** Hoja completa con foto de fondo (los trazos en su posición real). */
  sheetH?: number;
  imageUrl?: string | null;
  dim?: number;
  className?: string;
};

/** Miniatura de un dibujo que se repinta al cambiar de tamaño. */
export function StrokesThumb({ strokes, ink, sheetH, imageUrl, dim, className }: Props) {
  const cv = useRef<HTMLCanvasElement>(null);
  const img = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const canvas = cv.current;
    if (!canvas) return;
    let image: HTMLImageElement | null = null;
    const paint = () => paintThumb(canvas, strokes, ink, { sheetH, image, dim });
    if (sheetH && imageUrl) {
      image = img.current?.src === imageUrl ? img.current : new Image();
      img.current = image;
      if (image.src !== imageUrl) image.src = imageUrl;
      if (!image.complete) image.addEventListener('load', paint, { once: true });
    }
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(canvas);
    return () => {
      ro.disconnect();
      image?.removeEventListener('load', paint);
    };
  }, [strokes, ink, sheetH, imageUrl, dim]);

  return (
    <canvas
      ref={cv}
      className={className}
      role="img"
      aria-label={`Dibujo con ${strokes.length} ${strokes.length === 1 ? 'trazo' : 'trazos'}`}
    />
  );
}
