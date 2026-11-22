import { useEffect, useState } from 'react';
import { db, type CuadernoDB } from './db';
import { uid } from './text';

/** Lado mayor máximo de una imagen guardada. */
export const MAX_IMAGE_SIDE = 1600;
/** Calidad JPEG de las imágenes reducidas. */
export const JPEG_QUALITY = 0.85;
/** Los PNG pequeños se dejan en PNG para conservar la transparencia. */
const KEEP_PNG_BELOW = 500_000;

/** Tamaño final de una imagen para que su lado mayor no pase de `max` (nunca la agranda). */
export function fitWithin(w: number, h: number, max = MAX_IMAGE_SIDE): { w: number; h: number } {
  const s = Math.min(1, max / Math.max(w, h, 1));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

/** Formato de salida: PNG pequeño se mantiene, todo lo demás pasa a JPEG. */
export function outputType(file: Blob): 'image/png' | 'image/jpeg' {
  return file.type === 'image/png' && file.size < KEEP_PNG_BELOW ? 'image/png' : 'image/jpeg';
}

export const isImage = (f: Blob) => f.type.startsWith('image/');

/** Reduce una imagen a máx. 1600 px (JPEG 85 %) respetando la orientación de la foto. */
export async function shrinkImage(file: Blob, max = MAX_IMAGE_SIDE): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const { w, h } = fitWithin(bmp.width, bmp.height, max);
    const type = outputType(file);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Sin canvas 2D');
    if (type === 'image/jpeg') {
      // JPEG no tiene transparencia: fondo blanco en vez de negro.
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, w, h);
    return await new Promise<Blob>((res, rej) =>
      canvas.toBlob(
        (b) => (b ? res(b) : rej(new Error('No se pudo codificar'))),
        type,
        JPEG_QUALITY,
      ),
    );
  } finally {
    bmp.close();
  }
}

/** Archivos binarios (imágenes, audio) guardados aparte de los documentos. */
export class FileRepo {
  constructor(private readonly d: CuadernoDB = db) {}

  /** Guarda un archivo y devuelve su `fileId`. */
  async put(blob: Blob): Promise<string> {
    const id = uid();
    await this.d.files.add({
      id,
      blob,
      mime: blob.type || 'application/octet-stream',
      size: blob.size,
      createdAt: new Date().toISOString(),
    });
    return id;
  }

  async get(id: string): Promise<Blob | undefined> {
    return (await this.d.files.get(id))?.blob;
  }
}

export const files = new FileRepo();

/** Reduce y guarda una imagen; devuelve su `fileId`. */
export async function storeImage(file: Blob): Promise<string> {
  return files.put(await shrinkImage(file));
}

type UrlState = { id: string; url: string | null; missing: boolean };

/** URL temporal (`blob:`) de un archivo guardado; se libera al desmontar. */
export function useFileUrl(fileId: string | undefined): { url: string | null; missing: boolean } {
  const [state, setState] = useState<UrlState | null>(null);
  useEffect(() => {
    if (!fileId) return;
    let url: string | null = null;
    let alive = true;
    void files.get(fileId).then((blob) => {
      if (!alive) return;
      url = blob ? URL.createObjectURL(blob) : null;
      setState({ id: fileId, url, missing: !blob });
    });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [fileId]);
  if (!fileId) return { url: null, missing: true };
  if (!state || state.id !== fileId) return { url: null, missing: false };
  return { url: state.url, missing: state.missing };
}
