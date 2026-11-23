import type { Settings } from '@cuaderno/shared';
import { useAppStore } from '../../app/store';
import { Modal } from '../../components/ui/Modal';
import { Seg, Swatches } from '../../components/ui/Seg';
import { LANGS } from '../voice/speech';
import { ACCENTS, FONTS, SIZES, SKINS, WIDTHS } from './appearance';

const ACCENT_NAMES: Record<string, string> = {
  '#3b5bdb': 'azul',
  '#0c8599': 'turquesa',
  '#2b8a3e': 'verde',
  '#e8590c': 'naranja',
  '#d6336c': 'frambuesa',
  '#7048e8': 'violeta',
};

/** Apariencia general de la app (botón "Aa"). Los cambios se aplican al instante. */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const s = useAppStore((st) => st.settings);
  const update = useAppStore((st) => st.updateSettings);
  const set =
    <K extends keyof Settings>(k: K) =>
    (v: Settings[K]) =>
      update({ [k]: v });

  return (
    <Modal title="Personalizar" onClose={onClose}>
      <div className="set">
        <span>Tema</span>
        <Seg label="Tema" value={s.skin} options={SKINS} onChange={set('skin')} />
      </div>
      <div className="set">
        <span>Color de acento</span>
        <Swatches
          label="Color de acento"
          value={s.accent}
          colors={ACCENTS}
          onChange={set('accent')}
          itemLabel={(c) => `Acento ${ACCENT_NAMES[c] ?? c}`}
        />
      </div>
      <div className="set">
        <span>Fuente del documento</span>
        <Seg
          label="Fuente del documento"
          value={s.font}
          options={FONTS}
          onChange={set('font')}
          optionStyle={(v) => ({ fontFamily: `var(--${v})` })}
        />
      </div>
      <div className="set">
        <span>Tamaño de texto</span>
        <Seg label="Tamaño de texto" value={s.size} options={SIZES} onChange={set('size')} />
      </div>
      <div className="set">
        <span>Ancho de página</span>
        <Seg label="Ancho de página" value={s.width} options={WIDTHS} onChange={set('width')} />
      </div>
      <div className="set">
        <label htmlFor="langSel">Idioma del dictado</label>
        <select
          id="langSel"
          value={s.lang}
          onChange={(e) => update({ lang: e.target.value as Settings['lang'] })}
        >
          {LANGS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
      <div className="set">
        <label className="chk">
          <input
            type="checkbox"
            checked={s.penOnly}
            onChange={(e) => update({ penOnly: e.target.checked })}
          />
          Solo el lápiz dibuja (los dedos no rayan el lienzo)
        </label>
      </div>
      <div className="acts">
        <button type="button" className="pri" onClick={onClose}>
          Listo
        </button>
      </div>
    </Modal>
  );
}
