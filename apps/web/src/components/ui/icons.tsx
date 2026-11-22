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
