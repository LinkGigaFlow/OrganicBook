import type { Page } from '@cuaderno/shared';
import { CuadernoDB } from './db';

describe('CuadernoDB', () => {
  it('guarda y lee una página', async () => {
    const db = new CuadernoDB('cuaderno-test');
    const now = new Date().toISOString();
    const page: Page = {
      id: 'p1',
      parentId: null,
      title: 'Prueba',
      icon: '📄',
      createdAt: now,
      updatedAt: now,
      version: 1,
      kind: 'page',
      blocks: [{ id: 'b1', type: 'p', html: 'Hola' }],
    };

    await db.pages.put(page);
    expect(await db.pages.get('p1')).toEqual(page);

    db.close();
    await db.delete();
  });
});
