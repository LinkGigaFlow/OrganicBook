import type { Stroke } from '@cuaderno/shared';
import { NodeSelection } from '@tiptap/pm/state';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { DrawCanvas } from '../../../components/draw/DrawCanvas';

/** Bloque de dibujo del editor: el lienzo guarda sus trazos en los atributos del nodo. */
export function DrawView({ node, selected, updateAttributes, editor, getPos }: ReactNodeViewProps) {
  /** Selecciona el bloque (para que el asa y el destino de lo pegado lo sigan). */
  const selectSelf = () => {
    const pos = getPos();
    if (typeof pos !== 'number') return;
    const sel = editor.state.selection;
    if (sel instanceof NodeSelection && sel.from === pos) return;
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)));
  };

  return (
    <NodeViewWrapper data-block="draw" data-id={node.attrs.id} contentEditable={false}>
      <DrawCanvas
        strokes={node.attrs.strokes as Stroke[]}
        h={node.attrs.h as number}
        onStrokes={(strokes) => updateAttributes({ strokes })}
        onHeight={(h) => updateAttributes({ h })}
        onActivate={selectSelf}
        className={selected ? 'is-selected' : undefined}
      />
    </NodeViewWrapper>
  );
}
