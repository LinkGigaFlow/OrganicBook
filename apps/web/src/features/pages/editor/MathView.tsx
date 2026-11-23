import { TextSelection } from '@tiptap/pm/state';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type AnchorRect, Popover } from '../../../components/ui/Popover';
import { uid } from '../../../lib/text';
import { insertSnippet, SYMBOLS, TEMPLATES, texToHtml, useTexReady } from '../../../lib/tex';
import { takeOpenRequest } from './mathFocus';

/** Ajusta el alto del campo a su contenido (hasta 320 px). */
function fitTextarea(ta: HTMLTextAreaElement) {
  ta.style.height = 'auto';
  ta.style.height = `${Math.min(ta.scrollHeight + 2, 320)}px`;
}

/** Bloque Ecuación: fórmula renderizada; al tocarla se abre el editor con vista previa en vivo. */
export function MathView({ node, selected, updateAttributes, editor, getPos }: ReactNodeViewProps) {
  const tex = node.attrs.tex as string;
  const id = node.attrs.id as string;
  const ready = useTexReady();
  const [editing, setEditing] = useState(() => takeOpenRequest(id));
  const [templates, setTemplates] = useState<AnchorRect | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const preview = useRef<HTMLDivElement>(null);

  const html = useMemo(() => texToHtml(tex, true), [tex, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const symbols = useMemo(
    () => SYMBOLS.map(([label]) => texToHtml(label, false)),
    [ready], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Al abrir el editor: carga el código y enfoca el campo.
  useLayoutEffect(() => {
    const el = ta.current;
    if (!editing || !el) return;
    if (el.value !== tex) el.value = tex;
    fitTextarea(el);
    el.focus();
    // Solo al abrir; luego el campo es la fuente de verdad.
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = () => setEditing(true);

  /** Termina de editar. Con Ctrl+Enter sigue escribiendo en el bloque de abajo. */
  const finish = (goNext: boolean) => {
    setEditing(false);
    setTemplates(null);
    if (!goNext) {
      requestAnimationFrame(() => preview.current?.focus());
      return;
    }
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

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      insertSnippet(e.currentTarget, '  ');
    } else if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      e.stopPropagation();
      finish(e.key === 'Enter');
    }
  };

  const insert = (snippet: string) => {
    if (ta.current) insertSnippet(ta.current, snippet);
  };

  return (
    <NodeViewWrapper
      data-block="math"
      data-id={id}
      className={'mathb' + (editing ? ' editing' : '') + (selected ? ' is-selected' : '')}
      contentEditable={false}
    >
      <div
        ref={preview}
        className="mprev"
        role="button"
        tabIndex={0}
        aria-label="Editar ecuación"
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            open();
          }
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {editing ? (
        <div className="medit">
          <div className="mtools" role="toolbar" aria-label="Símbolos">
            {SYMBOLS.map(([, snippet], i) => (
              <button
                key={i}
                type="button"
                title={snippet.replace('|', '')}
                aria-label={snippet.replace('|', '').trim()}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insert(snippet)}
                dangerouslySetInnerHTML={{ __html: symbols[i]! }}
              />
            ))}
          </div>
          <textarea
            ref={ta}
            className="msrc"
            rows={2}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-label="Código LaTeX"
            placeholder="Escribe LaTeX, por ejemplo  \frac{a}{b} + \sqrt{x}"
            defaultValue={tex}
            onInput={(e) => {
              fitTextarea(e.currentTarget);
              updateAttributes({ tex: e.currentTarget.value });
            }}
            onKeyDown={onKeyDown}
          />
          <div className="mfoot">
            <button
              type="button"
              className="btn"
              aria-haspopup="menu"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setTemplates({ left: r.left, top: r.top, bottom: r.bottom });
              }}
            >
              Plantillas
            </button>
            <small>Ctrl+Enter para terminar</small>
            <button
              type="button"
              className="btn pri"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => finish(false)}
            >
              Listo
            </button>
          </div>
        </div>
      ) : null}
      {templates ? (
        <Popover anchor={templates} label="Plantillas" onClose={() => setTemplates(null)}>
          <div className="lb">Plantillas</div>
          {TEMPLATES.map(([label, t]) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              onClick={() => {
                setTemplates(null);
                const el = ta.current;
                if (!el) return;
                if (!el.value.trim()) {
                  el.value = '';
                  insertSnippet(el, t);
                } else {
                  // Con código ya escrito, la plantilla va en una línea nueva al final.
                  el.selectionStart = el.selectionEnd = el.value.length;
                  insertSnippet(el, '\n' + t);
                }
              }}
            >
              {label}
            </button>
          ))}
        </Popover>
      ) : null}
    </NodeViewWrapper>
  );
}
