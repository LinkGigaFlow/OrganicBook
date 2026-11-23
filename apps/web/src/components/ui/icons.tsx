import type { ReactNode } from 'react';

function Svg({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className ?? 'ico'}>
      {children}
    </svg>
  );
}

export const IconSearch = () => (
  <Svg>
    <circle cx="11" cy="11" r="6" />
    <path d="m20 20-4.5-4.5" />
  </Svg>
);
export const IconPlus = () => (
  <Svg>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconMenu = () => (
  <Svg>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);
export const IconMore = () => (
  <Svg>
    <circle cx="5" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="19" cy="12" r="1.2" fill="currentColor" />
  </Svg>
);
export const IconGrip = () => (
  <Svg className="ico grip">
    <circle cx="8" cy="5" r="1.6" />
    <circle cx="16" cy="5" r="1.6" />
    <circle cx="8" cy="12" r="1.6" />
    <circle cx="16" cy="12" r="1.6" />
    <circle cx="8" cy="19" r="1.6" />
    <circle cx="16" cy="19" r="1.6" />
  </Svg>
);
export const IconTodo = () => (
  <Svg>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    <path d="m8 12 3 3 5-6" />
  </Svg>
);
export const IconPage = () => (
  <Svg>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M14 3v4h4" />
  </Svg>
);
export const IconImage = () => (
  <Svg>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <circle cx="9" cy="10" r="2" />
    <path d="m21 17-5-5-9 8" />
  </Svg>
);
export const IconCamera = () => (
  <Svg>
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </Svg>
);
export const IconPen = () => (
  <Svg>
    <path d="M4 20l4-1 11-11-3-3L5 16z" />
    <path d="M14 6l3 3" />
  </Svg>
);
export const IconHighlighter = () => (
  <Svg>
    <path d="M9 15l-4 4h5l2-2" />
    <path d="M9 15l7-11 4 3-7 11z" />
  </Svg>
);
export const IconEraser = () => (
  <Svg>
    <path d="M8 20h12" />
    <path d="M5 15l9-9 5 5-8 8H8z" />
  </Svg>
);
export const IconUndo = () => (
  <Svg>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </Svg>
);
export const IconTrash = () => (
  <Svg>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Svg>
);
export const IconTaller = () => (
  <Svg>
    <path d="M12 4v16M7 15l5 5 5-5" />
  </Svg>
);
/** Mano tachada: los dedos no dibujan. */
export const IconPenOnly = () => (
  <Svg>
    <path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 11V5a1.5 1.5 0 0 1 3 0v6M14 11V6.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a5 5 0 0 1-4-2l-2.5-3.5a1.5 1.5 0 0 1 2.4-1.8L8 14" />
    <path d="M3 3l18 18" />
  </Svg>
);
export const IconMic = () => (
  <Svg>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </Svg>
);
