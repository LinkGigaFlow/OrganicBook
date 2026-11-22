import type { AnyPage } from '@cuaderno/shared';
import Dexie, { type EntityTable } from 'dexie';

/** Archivo binario (imagen o audio) referenciado por `fileId` desde los documentos. */
export type StoredFile = {
  id: string;
  blob: Blob;
  mime: string;
  size: number;
  createdAt: string;
};

/** Base local (IndexedDB). Local-first: la app escribe aquí y luego sincroniza. */
export class CuadernoDB extends Dexie {
  pages!: EntityTable<AnyPage, 'id'>;
  files!: EntityTable<StoredFile, 'id'>;

  constructor(name = 'cuaderno') {
    super(name);
    this.version(1).stores({
      pages: 'id, parentId, kind, updatedAt, deletedAt',
      files: 'id, createdAt',
    });
  }
}

export const db = new CuadernoDB();
