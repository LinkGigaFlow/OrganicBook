import { create } from 'zustand';
import { useAppStore } from '../../app/store';
import { toast } from '../../components/ui/toast-store';
import { type Dictation, startDictation } from './speech';

/** Dónde va el texto final: lo registra el editor de la página abierta. */
type Target = (text: string) => void;
let target: Target | null = null;
let session: Dictation | null = null;

type DictationState = {
  active: boolean;
  /** Texto provisional que se muestra en la burbuja. */
  interim: string;
};

export const useDictation = create<DictationState>()(() => ({ active: false, interim: '' }));

/** El editor activo recibe el texto dictado. Si se va (cambio de página), el dictado se detiene. */
export function registerDictationTarget(fn: Target): () => void {
  target = fn;
  return () => {
    if (target !== fn) return;
    target = null;
    stopDictation();
  };
}

export function startDictationNow(): boolean {
  if (session) return true;
  const lang = useAppStore.getState().settings.lang;
  useDictation.setState({ active: true, interim: '' });
  session = startDictation(lang, {
    onInterim: (interim) => useDictation.setState({ interim }),
    onFinal: (text) => target?.(text),
    onError: (message) => toast(message),
    onEnd: () => {
      session = null;
      useDictation.setState({ active: false, interim: '' });
    },
  });
  if (!session) useDictation.setState({ active: false, interim: '' });
  return !!session;
}

export function stopDictation() {
  session?.stop();
  session = null;
  useDictation.setState({ active: false, interim: '' });
}

export function toggleDictation() {
  if (session) stopDictation();
  else startDictationNow();
}

/** Cambia el idioma; si se está dictando, reinicia la escucha en el idioma nuevo. */
export function setDictationLang(
  lang: ReturnType<typeof useAppStore.getState>['settings']['lang'],
) {
  useAppStore.getState().updateSettings({ lang });
  if (session) {
    stopDictation();
    startDictationNow();
  }
}
