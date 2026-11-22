import { CuadernoDB } from './db';
import { FileRepo, fitWithin, outputType } from './files';

describe('reducción de imágenes', () => {
  it('el lado mayor queda en 1600 px y nunca agranda', () => {
    expect(fitWithin(4000, 3000)).toEqual({ w: 1600, h: 1200 });
    expect(fitWithin(1000, 3200)).toEqual({ w: 500, h: 1600 });
    expect(fitWithin(800, 600)).toEqual({ w: 800, h: 600 });
  });

  it('pasa a JPEG salvo los PNG pequeños (conservan la transparencia)', () => {
    expect(outputType(new Blob(['x'], { type: 'image/png' }))).toBe('image/png');
    expect(outputType(new Blob([new Uint8Array(600_000)], { type: 'image/png' }))).toBe(
      'image/jpeg',
    );
    expect(outputType(new Blob(['x'], { type: 'image/heic' }))).toBe('image/jpeg');
  });
});

describe('FileRepo', () => {
  it('guarda el archivo como Blob y lo devuelve por su fileId', async () => {
    const d = new CuadernoDB(`f-${Math.random()}`);
    const repo = new FileRepo(d);
    const id = await repo.put(new Blob(['hola'], { type: 'image/jpeg' }));
    const row = await d.files.get(id);
    expect(row?.mime).toBe('image/jpeg');
    expect(row?.size).toBe(4);
    expect(await repo.get(id)).toBeDefined();
    expect(await repo.get('no-existe')).toBeUndefined();
    d.close();
    await d.delete();
  });
});
