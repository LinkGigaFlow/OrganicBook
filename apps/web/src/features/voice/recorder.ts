import { useEffect, useRef, useState } from 'react';
import { files } from '../../lib/files';
import { MSG } from './speech';

/** Tamaño máximo de un audio (SPEC: 15 MB). */
export const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

/** Formatos preferidos: Opus en WebM (Chrome, Firefox) o MP4/AAC (Safari). */
const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

export function pickMimeType(
  isSupported: (t: string) => boolean = (t) =>
    typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t),
): string | undefined {
  return MIME_CANDIDATES.find((t) => isSupported(t));
}

export class RecorderError extends Error {
  constructor(
    message: string,
    readonly reason: 'unsupported' | 'insecure' | 'blocked' | 'no-mic' | 'busy' | 'failed',
  ) {
    super(message);
  }
}

export function recordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window.MediaRecorder !== 'undefined'
  );
}

/** Traduce el error de `getUserMedia` a un mensaje claro. */
export function micErrorFrom(err: unknown): RecorderError {
  const name = (err as { name?: string } | null)?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return new RecorderError(MSG.blocked, 'blocked');
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return new RecorderError(MSG.noMic, 'no-mic');
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return new RecorderError(MSG.busy, 'busy');
    default:
      return new RecorderError('No se pudo usar el micrófono.', 'failed');
  }
}

export type Recording = { blob: Blob; mime: string; dur: number };

export type ActiveRecording = {
  /** Termina y entrega el audio. */
  stop: () => Promise<Recording>;
  /** Termina y descarta el audio. */
  cancel: () => void;
  readonly startedAt: number;
};

/**
 * Pide el micrófono y empieza a grabar. Lanza `RecorderError` con un mensaje en español si el
 * navegador no lo permite o el micrófono está bloqueado.
 */
export async function startRecording(opts: { maxBytes?: number } = {}): Promise<ActiveRecording> {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    throw new RecorderError(MSG.insecure, 'insecure');
  }
  if (!recordingSupported()) {
    throw new RecorderError(
      'Este navegador no permite grabar audio. Prueba con Chrome, Edge, Firefox o Safari.',
      'unsupported',
    );
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    throw micErrorFrom(err);
  }

  const mime = pickMimeType();
  let rec: MediaRecorder;
  try {
    rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    throw new RecorderError('No se pudo iniciar la grabación.', 'failed');
  }

  const chunks: Blob[] = [];
  let bytes = 0;
  const maxBytes = opts.maxBytes ?? MAX_AUDIO_BYTES;
  const startedAt = performance.now();
  let endedAt = 0;
  const release = () => stream.getTracks().forEach((t) => t.stop());

  const done = new Promise<Recording>((resolve) => {
    rec.ondataavailable = (e) => {
      if (!e.data.size) return;
      chunks.push(e.data);
      bytes += e.data.size;
      // Límite de tamaño: se corta la grabación antes de pasar los 15 MB.
      if (bytes >= maxBytes * 0.95 && rec.state === 'recording') rec.stop();
    };
    rec.onstop = () => {
      endedAt ||= performance.now();
      release();
      const type = rec.mimeType || mime || 'audio/webm';
      resolve({ blob: new Blob(chunks, { type }), mime: type, dur: (endedAt - startedAt) / 1000 });
    };
  });

  rec.start(1000);
  return {
    startedAt,
    stop: () => {
      if (rec.state !== 'inactive') {
        endedAt = performance.now();
        rec.stop();
      }
      return done;
    },
    cancel: () => {
      rec.ondataavailable = null;
      if (rec.state !== 'inactive') rec.stop();
      release();
    },
  };
}

/** Guarda una grabación como archivo local; devuelve su `fileId`. */
export const saveRecording = (r: Recording) => files.put(r.blob);

export type RecorderState =
  { status: 'idle' } | { status: 'starting' } | { status: 'recording'; elapsed: number };

/**
 * Estado de grabación para la interfaz (botón Grabar/Detener y tiempo transcurrido).
 * Se reutiliza en las notas de voz del cuaderno orgánico.
 */
export function useRecorder(onError: (message: string) => void) {
  const [state, setState] = useState<RecorderState>({ status: 'idle' });
  const active = useRef<ActiveRecording | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  useEffect(
    () => () => {
      clearTimer();
      active.current?.cancel();
    },
    [],
  );

  const start = async () => {
    if (active.current || state.status === 'starting') return;
    setState({ status: 'starting' });
    try {
      const r = await startRecording();
      active.current = r;
      setState({ status: 'recording', elapsed: 0 });
      timer.current = setInterval(
        () => setState({ status: 'recording', elapsed: (performance.now() - r.startedAt) / 1000 }),
        250,
      );
    } catch (err) {
      setState({ status: 'idle' });
      onError(err instanceof RecorderError ? err.message : 'No se pudo grabar.');
    }
  };

  /** Detiene y devuelve la grabación (o `null` si no había). */
  const stop = async (): Promise<Recording | null> => {
    const r = active.current;
    if (!r) return null;
    active.current = null;
    clearTimer();
    const out = await r.stop();
    setState({ status: 'idle' });
    return out;
  };

  const cancel = () => {
    active.current?.cancel();
    active.current = null;
    clearTimer();
    setState({ status: 'idle' });
  };

  return { state, start, stop, cancel };
}

/** 75 → «1:15». */
export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
