import { TextSelection } from '@tiptap/pm/state';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { useEffect, useRef } from 'react';
import { useFileUrl } from '../../../lib/files';
import { sanitizeInline } from '../../../lib/html';
import { strip, uid } from '../../../lib/text';

/** Bloque de imagen: la foto viene de un archivo local (`fileId`); el pie se edita en línea. */
export function ImageView({
  node,
  selected,
  updateAttributes,
  editor,
  getPos,
}: ReactNodeViewProps) {
  const fileId = node.attrs.fileId as string;
  const cap = node.attrs.cap as string;
  const size = node.attrs.size as string;
  const { url, missing } = useFileUrl(fileId);
  const capRef = useRef<HTMLElement>(null);

  // El pie solo se reescribe desde el modelo cuando no se está editando (no mueve el cursor).
  useEffect(() => {
    const el = capRef.current;
    if (el && document.activeElement !== el && el.innerHTML !== cap) el.innerHTML = cap;
  }, [cap]);

  /** Enter en el pie: sigue escribiendo en un párrafo debajo de la imagen. */
  const exitBelow = () => {
    const pos = getPos();
    if (typeof pos !== 'number') return;
    const after = pos + node.nodeSize;
    const tr = editor.state.tr;
    const next = tr.doc.nodeAt(after);
    if (!next || !next.isTextblock) {
      tr.insert(after, editor.schema.nodes.paragraph!.create({ id: uid() }));
    }
    tr.setSelection(TextSelection.create(tr.doc, after + 1));
    editor.view.dispatch(tr.scrollIntoView());
    editor.view.focus();
  };

  const alt = strip(cap) || 'Imagen';

  return (
    <NodeViewWrapper
      data-block="img"
      data-id={node.attrs.id}
      className={`img sz-${size}` + (selected ? ' is-selected' : '')}
    >
      <figure>
        <div contentEditable={false} className="img-box">
          {url ? (
            <img src={url} alt={alt} draggable={false} />
          ) : missing ? (
            <div className="img-missing">Imagen no disponible en este dispositivo</div>
          ) : (
            <div className="img-loading" aria-label="Cargando imagen" />
          )}
        </div>
        <figcaption
          ref={capRef}
          className="cap"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label="Pie de imagen"
          data-ph="Añade un pie de imagen"
          onInput={(e) => updateAttributes({ cap: sanitizeInline(e.currentTarget.innerHTML) })}
          onBlur={(e) => {
            // Limpia lo que el navegador deja en un pie vacío (p. ej. un <br>).
            if (!strip(e.currentTarget.innerHTML).trim()) {
              e.currentTarget.innerHTML = '';
              if (cap) updateAttributes({ cap: '' });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              exitBelow();
            }
          }}
        />
      </figure>
    </NodeViewWrapper>
  );
}
