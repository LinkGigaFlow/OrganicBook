import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatDuration,
  micErrorFrom,
  pickMimeType,
  RecorderError,
  startRecording,
} from './recorder';
import {
  joinDictated,
  MSG,
  type SpeechRecognitionLike,
  speechErrorMessage,
  speechSupported,
  splitResults,
  startDictation,
} from './speech';

/** Reconocedor de voz simulado: la prueba decide qué "escucha". */
class FakeSR implements SpeechRecognitionLike {
  static all: FakeSR[] = [];
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: SpeechRecognitionLike['onresult'] = null;
  onerror: SpeechRecognitionLike['onerror'] = null;
  onend: SpeechRecognitionLike['onend'] = null;
  started = false;
  constructor() {
    FakeSR.all.push(this);
  }
  start() {
    this.started = true;
  }
  stop() {
    this.started = false;
    this.onend?.();
  }
  abort() {
    this.stop();
  }
  say(parts: [string, boolean][]) {
    this.onresult?.({
      resultIndex: 0,
      results: parts.map(([t, isFinal]) => ({ isFinal, length: 1, 0: { transcript: t } })),
    });
  }
}

const handlers = () => ({
  onInterim: vi.fn(),
  onFinal: vi.fn(),
  onError: vi.fn(),
  onEnd: vi.fn(),
});

describe('dictado (Web Speech API)', () => {
  beforeEach(() => {
    FakeSR.all = [];
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeSR;
  });
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  });

  it('sin soporte avisa con un mensaje claro y no se rompe', () => {
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    expect(speechSupported()).toBe(false);
    const h = handlers();
    expect(startDictation('es-CL', h)).toBeNull();
    expect(h.onError).toHaveBeenCalledWith(MSG.unsupported, true);
  });

  it('escucha continua en el idioma elegido; separa provisional y final', () => {
    const h = handlers();
    const d = startDictation('es-MX', h)!;
    const sr = FakeSR.all[0]!;
    expect(sr).toMatchObject({
      lang: 'es-MX',
      continuous: true,
      interimResults: true,
      started: true,
    });
    sr.say([['hola qué', false]]);
    expect(h.onInterim).toHaveBeenLastCalledWith('hola qué');
    expect(h.onFinal).not.toHaveBeenCalled();
    sr.say([
      ['hola qué tal', true],
      [' cómo', false],
    ]);
    expect(h.onFinal).toHaveBeenCalledWith('hola qué tal');
    expect(h.onInterim).toHaveBeenLastCalledWith('cómo');
    d.stop();
    expect(h.onEnd).toHaveBeenCalledTimes(1);
    expect(h.onInterim).toHaveBeenLastCalledWith('');
  });

  it('se reanuda sola tras un corte por silencio', () => {
    const h = handlers();
    startDictation('es-CL', h);
    FakeSR.all[0]!.onend!();
    expect(FakeSR.all).toHaveLength(2);
    expect(FakeSR.all[1]!.started).toBe(true);
    expect(h.onEnd).not.toHaveBeenCalled();
  });

  it('micrófono bloqueado: mensaje claro y se detiene', () => {
    const h = handlers();
    startDictation('es-CL', h);
    FakeSR.all[0]!.onerror!({ error: 'not-allowed' });
    expect(h.onError).toHaveBeenCalledWith(MSG.blocked, true);
    expect(h.onEnd).toHaveBeenCalledTimes(1);
    FakeSR.all[0]!.onend!();
    expect(FakeSR.all).toHaveLength(1); // no reintenta
  });

  it('mensajes de error en español', () => {
    expect(speechErrorMessage('audio-capture', 'es-CL')).toBe(MSG.noMic);
    expect(speechErrorMessage('network', 'es-CL')).toBe(MSG.network);
    expect(speechErrorMessage('language-not-supported', 'en-US')).toContain('English (US)');
    expect(speechErrorMessage('aborted', 'es-CL')).toBeNull();
  });

  it('splitResults ignora los resultados anteriores a resultIndex', () => {
    expect(
      splitResults({
        resultIndex: 1,
        results: [
          { isFinal: true, length: 1, 0: { transcript: 'viejo' } },
          { isFinal: true, length: 1, 0: { transcript: 'nuevo' } },
        ],
      }),
    ).toEqual({ final: 'nuevo', interim: '' });
  });
});

describe('unir texto dictado', () => {
  it('mayúscula al empezar y después de un punto; espacio si hace falta', () => {
    expect(joinDictated('', 'hola mundo')).toBe('Hola mundo');
    expect(joinDictated('Ya está.', 'otra frase')).toBe(' Otra frase');
    expect(joinDictated('Comí pan', 'y queso')).toBe(' y queso');
    expect(joinDictated('Comí pan ', 'y queso')).toBe('y queso');
    expect(joinDictated('algo', '   ')).toBe('');
  });
});

describe('grabación (MediaRecorder)', () => {
  type Listener = ((e: { data: Blob }) => void) | null;
  class FakeRecorder {
    static last: FakeRecorder | null = null;
    static isTypeSupported = (t: string) => t === 'audio/webm;codecs=opus';
    state: 'inactive' | 'recording' = 'inactive';
    ondataavailable: Listener = null;
    onstop: (() => void) | null = null;
    mimeType: string;
    constructor(
      readonly stream: MediaStream,
      opts?: { mimeType?: string },
    ) {
      this.mimeType = opts?.mimeType ?? '';
      FakeRecorder.last = this;
    }
    start() {
      this.state = 'recording';
    }
    stop() {
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob(['audio'], { type: this.mimeType }) });
      this.onstop?.();
    }
  }
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  const getUserMedia = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    vi.stubGlobal('isSecureContext', true);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });
    getUserMedia.mockReset();
    track.stop.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
  });

  it('elige un formato que el navegador soporte', () => {
    expect(pickMimeType((t) => t === 'audio/mp4')).toBe('audio/mp4');
    expect(pickMimeType(() => false)).toBeUndefined();
  });

  it('graba, entrega el audio y suelta el micrófono', async () => {
    getUserMedia.mockResolvedValue(stream);
    const rec = await startRecording();
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(FakeRecorder.last?.mimeType).toBe('audio/webm;codecs=opus');
    const out = await rec.stop();
    expect(out.blob.size).toBeGreaterThan(0);
    expect(out.mime).toBe('audio/webm;codecs=opus');
    expect(out.dur).toBeGreaterThanOrEqual(0);
    expect(track.stop).toHaveBeenCalled();
  });

  it('micrófono bloqueado o ausente: error con mensaje claro', async () => {
    getUserMedia.mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
    await expect(startRecording()).rejects.toMatchObject({
      reason: 'blocked',
      message: MSG.blocked,
    });
    expect(micErrorFrom({ name: 'NotFoundError' }).reason).toBe('no-mic');
    expect(micErrorFrom({ name: 'NotReadableError' }).message).toBe(MSG.busy);
  });

  it('sin MediaRecorder avisa que el navegador no permite grabar', async () => {
    vi.stubGlobal('MediaRecorder', undefined);
    const err = await startRecording().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RecorderError);
    expect((err as RecorderError).reason).toBe('unsupported');
  });

  it('sin conexión segura no pide el micrófono', async () => {
    vi.stubGlobal('isSecureContext', false);
    await expect(startRecording()).rejects.toMatchObject({ reason: 'insecure' });
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('formatea la duración', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(75.9)).toBe('1:15');
  });
});
