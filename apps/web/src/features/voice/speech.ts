import type { Settings } from '@cuaderno/shared';

/** Idiomas del dictado (SPEC: es-CL, es-ES, es-MX o en-US). */
export const LANGS: { value: Settings['lang']; label: string }[] = [
  { value: 'es-CL', label: 'Español (Chile)' },
  { value: 'es-ES', label: 'Español (España)' },
  { value: 'es-MX', label: 'Español (México)' },
  { value: 'en-US', label: 'English (US)' },
];

/* Tipos mínimos de Web Speech API (no vienen en la librería DOM de TypeScript). */
type Alternative = { transcript: string };
type SpeechResult = { isFinal: boolean; length: number; 0: Alternative };
export type SpeechResultEvent = {
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
};
export type SpeechErrorEvent = { error: string; message?: string };
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechCtor = new () => SpeechRecognitionLike;

function speechCtor(): SpeechCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechCtor;
    webkitSpeechRecognition?: SpeechCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechSupported = () => speechCtor() !== null;

export const MSG = {
  unsupported:
    'Este navegador no trae dictado por voz. Prueba con Chrome o Edge (en iPhone, Safari); también puedes grabar una nota de voz.',
  insecure: 'El micrófono solo funciona en una conexión segura (https) o en la app instalada.',
  blocked:
    'El micrófono está bloqueado. Permite el acceso desde el candado de la barra de direcciones y vuelve a intentar. Si la app está dentro de otra página, ábrela en su propia pestaña.',
  noMic: 'No se encontró un micrófono. Conecta uno y vuelve a intentar.',
  busy: 'Otra aplicación está usando el micrófono. Ciérrala y vuelve a intentar.',
  network:
    'El dictado de este navegador necesita conexión a internet. Revisa la red e inténtalo de nuevo.',
  lang: (lang: string) => `El dictado no está disponible en ${langLabel(lang)} en este navegador.`,
  noSpeech: 'No se escuchó nada. Habla cerca del micrófono.',
  failed: 'No se pudo iniciar el dictado.',
} as const;

export const langLabel = (lang: string) => LANGS.find((l) => l.value === lang)?.label ?? lang;

/** Mensaje en español para un error de reconocimiento; `null` si no hay que avisar. */
export function speechErrorMessage(error: string, lang: string): string | null {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return MSG.blocked;
    case 'audio-capture':
      return MSG.noMic;
    case 'network':
      return MSG.network;
    case 'language-not-supported':
      return MSG.lang(lang);
    case 'no-speech':
      return MSG.noSpeech;
    case 'aborted':
      return null;
    default:
      return `Error de dictado (${error}).`;
  }
}

/** Errores después de los cuales no tiene sentido reintentar solo. */
const FATAL = new Set([
  'not-allowed',
  'service-not-allowed',
  'audio-capture',
  'network',
  'language-not-supported',
]);

/** Separa los resultados finales de los provisionales de un evento. */
export function splitResults(e: SpeechResultEvent): { final: string; interim: string } {
  let final = '';
  let interim = '';
  for (let i = e.resultIndex; i < e.results.length; i++) {
    const r = e.results[i]!;
    if (r.isFinal) final += r[0].transcript;
    else interim += r[0].transcript;
  }
  return { final: final.trim(), interim: interim.trim() };
}

export type DictationHandlers = {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  /** Error con mensaje para mostrar. `fatal` = el dictado se detuvo. */
  onError: (message: string, fatal: boolean) => void;
  onEnd: () => void;
};

export type Dictation = { stop: () => void };

/**
 * Reconocimiento continuo. Chrome (sobre todo en Android) corta la escucha tras un silencio:
 * mientras no se pida detener, se vuelve a iniciar solo.
 */
export function startDictation(lang: string, h: DictationHandlers): Dictation | null {
  const Ctor = speechCtor();
  if (!Ctor) {
    h.onError(MSG.unsupported, true);
    return null;
  }
  let stopped = false;
  let restarts = 0;
  let rec: SpeechRecognitionLike;

  const finish = () => {
    if (stopped) return;
    stopped = true;
    h.onEnd();
  };

  const begin = (): boolean => {
    rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      restarts = 0;
      const { final, interim } = splitResults(e);
      if (final) h.onFinal(final);
      h.onInterim(interim);
    };
    rec.onerror = (e) => {
      const msg = speechErrorMessage(e.error, lang);
      const fatal = FATAL.has(e.error);
      if (msg && (fatal || e.error !== 'no-speech' || restarts > 2)) h.onError(msg, fatal);
      if (fatal) {
        stopped = true;
        h.onEnd();
      }
    };
    rec.onend = () => {
      h.onInterim('');
      if (stopped) return;
      // Corte por silencio: se reanuda (con un límite para no quedar en un bucle).
      if (restarts++ < 5 && begin()) return;
      finish();
    };
    try {
      rec.start();
      return true;
    } catch {
      return false;
    }
  };

  if (!begin()) {
    h.onError(MSG.failed, true);
    return null;
  }
  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      try {
        rec.stop();
      } catch {
        /* ya estaba detenido */
      }
      h.onInterim('');
      h.onEnd();
    },
  };
}

/** Une el texto dictado con lo que ya hay antes del cursor (espacio y mayúscula inicial). */
export function joinDictated(before: string, text: string): string {
  const t = text.trim();
  if (!t) return '';
  const prev = before.replace(/\xa0/g, ' ');
  const startOfSentence = !prev.trim() || /[.!?¡¿:]\s*$/.test(prev);
  const body = startOfSentence ? t[0]!.toLocaleUpperCase() + t.slice(1) : t;
  const space = prev && !/\s$/.test(prev) ? ' ' : '';
  return space + body;
}
