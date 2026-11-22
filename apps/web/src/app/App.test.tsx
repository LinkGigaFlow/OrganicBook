import { render, screen, within } from '@testing-library/react';
import { db } from '../lib/db';
import { App } from './App';

describe('App', () => {
  beforeEach(async () => {
    await db.pages.clear();
    localStorage.clear();
  });

  it('muestra la marca y las páginas de ejemplo en la barra lateral', async () => {
    render(<App />);
    expect(screen.getByText('Cuaderno', { selector: '.brand' })).toBeInTheDocument();
    const tree = screen.getByRole('navigation', { name: 'Árbol de páginas' });
    expect(
      await within(tree).findByRole('button', { name: 'Bienvenido a Cuaderno' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(within(tree).getByRole('button', { name: 'Proyectos' })).toBeInTheDocument();
  });
});
