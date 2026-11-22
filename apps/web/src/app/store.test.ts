import { defaultSettings, useAppStore } from './store';

describe('useAppStore', () => {
  it('abre una página y actualiza ajustes', () => {
    useAppStore.getState().openPage('p1');
    useAppStore.getState().updateSettings({ skin: 'dark' });

    const s = useAppStore.getState();
    expect(s.currentPageId).toBe('p1');
    expect(s.settings).toEqual({ ...defaultSettings, skin: 'dark' });
  });
});
