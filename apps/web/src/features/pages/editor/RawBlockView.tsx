import type { Block } from '@cuaderno/shared';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';

const LABEL: Partial<Record<Block['type'], string>> = {
  math: 'Ecuación',
  img: 'Imagen',
  draw: 'Dibujo',
};

/** Vista provisional de bloques que se implementan en fases posteriores. */
export function RawBlockView({ node, selected }: ReactNodeViewProps) {
  let block: Partial<Block> = {};
  try {
    block = JSON.parse(node.attrs.json as string) as Partial<Block>;
  } catch {
    /* JSON dañado: se muestra como bloque desconocido */
  }
  const label = (block.type && LABEL[block.type]) ?? 'Bloque';
  const detail = block.type === 'math' ? block.tex : undefined;

  return (
    <NodeViewWrapper
      data-block="raw"
      data-id={node.attrs.id}
      className={'raw' + (selected ? ' is-selected' : '')}
      contentEditable={false}
    >
      <span className="raw-label">{label}</span>
      {detail ? <code className="raw-detail">{detail}</code> : null}
    </NodeViewWrapper>
  );
}
