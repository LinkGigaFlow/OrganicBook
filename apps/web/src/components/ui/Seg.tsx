import type { CSSProperties } from 'react';

/** Selector segmentado (una opción entre pocas), accesible como grupo de radios. */
export function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
  optionStyle,
}: {
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
  optionStyle?: (v: T) => CSSProperties | undefined;
}) {
  return (
    <div
      className={'seg' + (className ? ' ' + className : '')}
      role="radiogroup"
      aria-label={label}
    >
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          className={value === v ? 'on' : ''}
          style={optionStyle?.(v)}
          onClick={() => onChange(v)}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/** Fila de círculos de color (acento, tinta). */
export function Swatches({
  value,
  colors,
  onChange,
  label,
  itemLabel,
}: {
  value: string;
  colors: readonly string[];
  onChange: (c: string) => void;
  label: string;
  itemLabel: (c: string) => string;
}) {
  return (
    <div className="accs" role="radiogroup" aria-label={label}>
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={itemLabel(c)}
          className={value === c ? 'on' : ''}
          style={{ '--c': c } as CSSProperties}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  );
}
