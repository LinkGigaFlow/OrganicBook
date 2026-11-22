import type { AnyPage } from '@cuaderno/shared';
import { IconPlus, IconSearch } from '../components/ui/icons';
import { childrenOf, searchPages } from '../lib/pages';
import { createPageAndOpen } from './actions';
import { useAppStore } from './store';

type RowProps = { page: AnyPage; depth: number; hasKids: boolean; current: boolean };

function Row({ page, depth, hasKids, current }: RowProps) {
  const expanded = useAppStore((s) => !!s.expanded[page.id]);
  const toggle = useAppStore((s) => s.toggleExpanded);
  const openPage = useAppStore((s) => s.openPage);
  const title = page.title || 'Sin título';
  return (
    <div
      className={'row' + (current ? ' on' : '')}
      style={{ '--d': depth } as React.CSSProperties}
      data-page-id={page.id}
    >
      <button
        type="button"
        className="tw"
        aria-label={expanded ? `Contraer ${title}` : `Expandir ${title}`}
        aria-expanded={hasKids ? expanded : undefined}
        style={hasKids ? undefined : { visibility: 'hidden' }}
        tabIndex={hasKids ? 0 : -1}
        onClick={() => toggle(page.id)}
      >
        {expanded ? '▼' : '▶'}
      </button>
      <button
        type="button"
        className="rl"
        aria-current={current ? 'page' : undefined}
        onClick={() => openPage(page.id)}
      >
        <span aria-hidden="true">{page.icon}</span>
        <span className="tt">{title}</span>
      </button>
      <button
        type="button"
        className="add"
        aria-label={`Nueva subpágina en ${title}`}
        onClick={() => void createPageAndOpen(page.id)}
      >
        +
      </button>
    </div>
  );
}

function Tree({ pages, currentId }: { pages: AnyPage[]; currentId: string | null }) {
  const expanded = useAppStore((s) => s.expanded);
  const rows: React.ReactNode[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const p of childrenOf(pages, parentId)) {
      const kids = childrenOf(pages, p.id).length > 0;
      rows.push(
        <Row key={p.id} page={p} depth={depth} hasKids={kids} current={p.id === currentId} />,
      );
      if (kids && expanded[p.id]) walk(p.id, depth + 1);
    }
  };
  walk(null, 0);
  return <>{rows}</>;
}

export function Sidebar({ pages, currentId }: { pages: AnyPage[]; currentId: string | null }) {
  const query = useAppStore((s) => s.query);
  const setQuery = useAppStore((s) => s.setQuery);
  const results = query.trim() ? searchPages(pages, query) : null;

  return (
    <aside id="side" aria-label="Páginas">
      <div className="brand">
        <i aria-hidden="true">C</i>Cuaderno
      </div>
      <label className="search">
        <IconSearch />
        <input
          type="search"
          placeholder="Buscar en las notas"
          aria-label="Buscar"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <button type="button" className="newp" onClick={() => void createPageAndOpen(null)}>
        <IconPlus />
        Nueva página
      </button>
      <div className="cap-l">{results ? 'Resultados' : 'Páginas'}</div>
      <nav id="tree" aria-label="Árbol de páginas">
        {results ? (
          results.length ? (
            results.map((p) => (
              <Row key={p.id} page={p} depth={0} hasKids={false} current={p.id === currentId} />
            ))
          ) : (
            <p className="empty">Sin resultados</p>
          )
        ) : (
          <Tree pages={pages} currentId={currentId} />
        )}
      </nav>
      <div className="side-foot">Tus notas se guardan en este dispositivo</div>
    </aside>
  );
}
