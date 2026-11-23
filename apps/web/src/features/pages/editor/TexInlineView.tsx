import { TextSelection } from '@tiptap/pm/state';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type AnchorRect, Popover } from '../../../components/ui/Popover';
import { texToHtml, useTexReady } from '../../../lib/tex';

/** Fórmula en línea: se ve como fórmula atómica; al tocarla se abre un editor pequeño. */
export function TexInlineView({
  node,
  updateAttributes,
  editor,
  getPos,
  selected,
}: ReactNodeViewProps) {
  const tex = node.attrs.tex as string;
  const ready = useTexReady();
  const wrap = useRef<HTMLElement>(null);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const html = useMemo(() => texToHtml(tex, false), [tex, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = () => {
    const r = wrap.current?.getBoundingClientRect();
    if (r) setAnchor({ left: r.left, top: r.top, bottom: r.bottom });
  };

  // Recién insertada desde el menú `/`: se abre sola.
  useEffect(() => {
    if (!node.attrs.fresh) return;
    updateAttributes({ fresh: false });
    open();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (anchor && ta.current) {
      ta.current.value = tex;
      ta.current.focus();
      ta.current.select();
    }
  }, [anchor]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Cierra el editor; una fórmula vacía (o "Quitar") se elimina. El cursor queda después. */
  const close = (remove = false) => {
    setAnchor(null);
    const pos = getPos();
    if (typeof pos !== 'number') return;
    const current = editor.state.doc.nodeAt(pos);
    if (!current || current.type.name !== node.type.name) return;
    const tr = editor.state.tr;
    if (remove || !(current.attrs.tex as string).trim()) {
      tr.delete(pos, pos + current.nodeSize);
      tr.setSelection(TextSelection.create(tr.doc, pos));
    } else {
      tr.setSelection(TextSelection.create(tr.doc, pos + current.nodeSize));
    }
    editor.view.dispatch(tr);
    editor.view.focus();
  };

  return (
    <NodeViewWrapper
      as="span"
      ref={wrap}
      className={'tex' + (selected || anchor ? ' is-selected' : '')}
      data-tex={tex}
      role="button"
      aria-label={`Fórmula ${tex}`}
      onClick={(e: React.MouseEvent) => {
        // Los clics dentro del editor emergente (en un portal) también llegan aquí.
        if (wrap.current?.contains(e.target as Node)) open();
      }}
    >
      <span dangerouslySetInnerHTML={{ __html: html }} />
      {anchor ? (
        <Popover anchor={anchor} label="Fórmula en línea" className="wide" onClose={() => close()}>
          <div className="lb">Fórmula en línea (LaTeX)</div>
          <textarea
            ref={ta}
            className="itex"
            rows={2}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-label="Código LaTeX de la fórmula"
            placeholder="x^2 + y^2 = r^2"
            defaultValue={tex}
            onInput={(e) => updateAttributes({ tex: e.currentTarget.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                close();
              }
            }}
          />
          <div className="iprev" dangerouslySetInnerHTML={{ __html: html }} />
          <div className="acts">
            <button type="button" onClick={() => close(true)}>
              Quitar
            </button>
            <button type="button" className="pri" onClick={() => close()}>
              Listo
            </button>
          </div>
        </Popover>
      ) : null}
    </NodeViewWrapper>
  );
}
