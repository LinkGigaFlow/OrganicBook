import { defaultSettings } from '../../app/store';
import { BOARD_STYLES, defaultStyle, INKS, withBackground } from '../organic/model';
import { ACCENTS, applyAppearance, themeColor } from './appearance';

describe('apariencia general', () => {
  it('aplica tema, letra, tamaño, ancho y acento en <html>', () => {
    const root = document.createElement('html');
    applyAppearance(
      {
        ...defaultSettings,
        skin: 'sepia',
        font: 'serif',
        size: 'l',
        width: 'wide',
        accent: '#2b8a3e',
      },
      root,
    );
    expect(root.dataset).toMatchObject({ skin: 'sepia', font: 'serif', size: 'l', width: 'wide' });
    expect(root.style.getPropertyValue('--ac')).toBe('#2b8a3e');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(
      '#f7f1e5',
    );
  });

  it('el color de la barra del sistema sigue al tema', () => {
    expect(themeColor('auto', true)).toBe('#191919');
    expect(themeColor('auto', false)).toBe('#ffffff');
    expect(themeColor('dark', false)).toBe('#191919');
  });

  it('seis acentos', () => {
    expect(ACCENTS).toEqual(['#3b5bdb', '#0c8599', '#2b8a3e', '#e8590c', '#d6336c', '#7048e8']);
    expect(ACCENTS).toContain(defaultSettings.accent);
  });
});

describe('estilo del cuaderno orgánico', () => {
  it('fondos y tintas de la especificación', () => {
    expect(
      Object.fromEntries(Object.entries(BOARD_STYLES).map(([k, v]) => [k, [v.bg, v.ink]])),
    ).toEqual({
      pizarra: ['#1b1b1b', '#ffb43f'],
      corcho: ['#b98b5d', '#3a2412'],
      papel: ['#f6f1e4', '#2f4ba0'],
      noche: ['#16163d', '#ffd3e6'],
      menta: ['#dff6ec', '#0b6e52'],
    });
    expect(INKS).toHaveLength(8);
  });

  it('al cambiar el fondo, la tinta vuelve a la de ese fondo', () => {
    const s = { ...defaultStyle(), ink: '#ff6b6b', font: 'marcador' as const };
    expect(withBackground(s, 'papel')).toEqual({ bg: 'papel', ink: '#2f4ba0', font: 'marcador' });
  });
});
