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
export const IconOrbit = () => (
  <Svg>
    <circle cx="12" cy="12" r="2.6" />
    <ellipse cx="12" cy="12" rx="9.5" ry="4.5" transform="rotate(-20 12 12)" />
  </Svg>
);
export const IconText = () => (
  <Svg>
    <path d="M5 6h14M5 11h14M5 16h9" />
  </Svg>
);
export const IconSigma = () => (
  <Svg>
    <path d="M18 5H6l6.5 7L6 19h12" />
  </Svg>
);
export const IconPlay = () => (
  <Svg className="ico fill">
    <path d="M8 5v14l11-7z" />
  </Svg>
);
export const IconLeft = () => (
  <Svg>
    <path d="M15 6l-6 6 6 6" />
  </Svg>
);
export const IconRight = () => (
  <Svg>
    <path d="M9 6l6 6-6 6" />
  </Svg>
);
export const IconClose = () => (
  <Svg>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const IconUpload = () => (
  <Svg>
    <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
  </Svg>
);
export const IconBook = () => (
  <Svg>
    <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
    <path d="M5 17a3 3 0 0 1 3-3h11" />
  </Svg>
);
/** Sacar del montón. */
export const IconOut = () => (
  <Svg>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </Svg>
);
export const IconPalette = () => (
  <Svg>
    <path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2 0-1.5-1.5-1.8-1.5-3s1-2 2.3-2H17a4 4 0 0 0 4-4c0-3.9-4-7-9-7z" />
    <circle cx="7.5" cy="11" r="1.1" fill="currentColor" />
    <circle cx="10" cy="7" r="1.1" fill="currentColor" />
    <circle cx="14.5" cy="7" r="1.1" fill="currentColor" />
  </Svg>
);
export const IconHeading = () => (
  <Svg>
    <path d="M6 5v14M18 5v14M6 12h12" />
  </Svg>
);
export const IconList = () => (
  <Svg>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1" fill="currentColor" />
    <circle cx="4.5" cy="12" r="1" fill="currentColor" />
    <circle cx="4.5" cy="18" r="1" fill="currentColor" />
  </Svg>
);
/** Reacomodar en círculo. */
export const IconRing = () => (
  <Svg>
    <circle cx="12" cy="12" r="8" strokeDasharray="3 3" />
    <circle cx="12" cy="12" r="2" />
  </Svg>
);
