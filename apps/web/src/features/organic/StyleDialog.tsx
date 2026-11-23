import type { OrganicBackground, OrganicFont, OrganicStyle } from '@cuaderno/shared';
import { Modal } from '../../components/ui/Modal';
import { Seg, Swatches } from '../../components/ui/Seg';
import { BOARD_FONTS, BOARD_STYLES, INKS, withBackground } from './model';

const FONT_LABEL: [OrganicFont, string][] = [
  ['mano', 'Manuscrita'],
  ['marcador', 'Marcador'],
  ['limpia', 'Limpia'],
];

/** Estilo propio del cuaderno orgánico (botón Estilo). */
export function StyleDialog({
  style,
  onChange,
  onArrange,
  onClose,
}: {
  style: OrganicStyle;
  onChange: (s: OrganicStyle) => void;
  onArrange: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title="Estilo del cuaderno" onClose={onClose}>
      <div className="set">
        <span>Fondo</span>
        <Seg
          label="Fondo"
          value={style.bg}
          options={
            Object.entries(BOARD_STYLES).map(([k, v]) => [k, v.label]) as [
              OrganicBackground,
              string,
            ][]
          }
          onChange={(bg) => onChange(withBackground(style, bg))}
        />
      </div>
      <div className="set">
        <span>Tinta</span>
        <Swatches
          label="Tinta"
          value={style.ink}
          colors={INKS}
          onChange={(ink) => onChange({ ...style, ink })}
          itemLabel={(c) => `Tinta ${c}`}
        />
      </div>
      <div className="set">
        <span>Letra</span>
        <Seg
          label="Letra"
          value={style.font}
          options={FONT_LABEL}
          onChange={(font) => onChange({ ...style, font })}
          optionStyle={(v) => ({ fontFamily: BOARD_FONTS[v], fontSize: 17 })}
        />
      </div>
      <p className="hint">
        Arrastra las notas donde quieras; suelta una sobre otra para apilarlas.
      </p>
      <div className="acts">
        <button type="button" onClick={onArrange}>
          Reacomodar en círculo
        </button>
        <button type="button" className="pri" onClick={onClose}>
          Listo
        </button>
      </div>
    </Modal>
  );
}
