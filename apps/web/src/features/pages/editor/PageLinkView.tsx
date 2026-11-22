import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAppStore } from '../../../app/store';
import { db } from '../../../lib/db';

export function PageLinkView({ node, selected }: ReactNodeViewProps) {
  const pageId = node.attrs.pageId as string;
  const page = useLiveQuery(() => db.pages.get(pageId), [pageId], null);
  const openPage = useAppStore((s) => s.openPage);
  const gone = page === undefined || !!page?.deletedAt;

  return (
    <NodeViewWrapper
      data-block="link"
      data-id={node.attrs.id}
      className={selected ? 'is-selected' : undefined}
    >
      <button
        type="button"
        className="plink"
        contentEditable={false}
        disabled={gone}
        onClick={() => page && !gone && openPage(page.id)}
      >
        <span aria-hidden="true">{page && !gone ? page.icon : '📄'}</span>
        <u>{page === null ? '…' : gone ? 'Página eliminada' : page.title || 'Sin título'}</u>
      </button>
    </NodeViewWrapper>
  );
}
