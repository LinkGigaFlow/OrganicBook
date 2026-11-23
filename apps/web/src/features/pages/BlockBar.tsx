import type { ReactNode, RefObject } from 'react';
import {
  IconHeading,
  IconImage,
  IconList,
  IconMic,
  IconPen,
  IconText,
  IconTodo,
} from '../../components/ui/icons';
import { useDictation } from '../voice/dictation';
import type { BlockEditorHandle } from './editor/BlockEditor';
import type { MenuKind } from './editor/items';

const ITEMS: { k: MenuKind; label: string; icon: ReactNode }[] = [
  { k: 'p', label: 'Texto', icon: <IconText /> },
  { k: 'h2', label: 'Título', icon: <IconHeading /> },
  { k: 'bullet', label: 'Lista', icon: <IconList /> },
  { k: 'todo', label: 'Tarea', icon: <IconTodo /> },
  { k: 'img', label: 'Imagen', icon: <IconImage /> },
  { k: 'draw', label: 'Dibujo', icon: <IconPen /> },
  { k: 'voice', label: 'Voz', icon: <IconMic /> },
];

/**
 * Barra de bloques flotante abajo: agrega un bloque debajo del actual. Se desplaza en horizontal
 * si no cabe y respeta las zonas seguras de la pantalla.
 */
export function BlockBar({ editor }: { editor: RefObject<BlockEditorHandle | null> }) {
  const dictating = useDictation((s) => s.active);
  return (
    <div className="otb" role="toolbar" aria-label="Agregar bloque">
      {ITEMS.map((it) => (
        <button
          key={it.k}
          type="button"
          className={it.k === 'voice' && dictating ? 'rec' : undefined}
          aria-pressed={it.k === 'voice' ? dictating : undefined}
          // No quita el foco del editor: el bloque va donde está el cursor.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.current?.insert(it.k)}
        >
          {it.icon}
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}
