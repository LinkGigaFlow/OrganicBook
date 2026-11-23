import type { Settings } from '@cuaderno/shared';
import { useAppStore } from '../../app/store';
import { IconMic } from '../../components/ui/icons';
import { setDictationLang, stopDictation, useDictation } from './dictation';
import { LANGS } from './speech';

/** Burbuja flotante mientras se dicta: texto provisional, idioma y botón para detener. */
export function VoiceBubble() {
  const { active, interim } = useDictation();
  const lang = useAppStore((s) => s.settings.lang);
  if (!active) return null;
  return (
    <div className="vbub" role="status" aria-label="Dictado por voz">
      <span className="vdot" aria-hidden="true">
        <IconMic />
      </span>
      <p className={'vtext' + (interim ? '' : ' idle')} aria-live="polite">
        {interim || 'Escuchando…'}
      </p>
      <select
        aria-label="Idioma del dictado"
        value={lang}
        onChange={(e) => setDictationLang(e.target.value as Settings['lang'])}
      >
        {LANGS.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="vstop"
        onMouseDown={(e) => e.preventDefault()}
        onClick={stopDictation}
      >
        Detener
      </button>
    </div>
  );
}
