import type { SVGProps } from 'react';

/** 20px line icons on a 1.5px stroke; they inherit currentColor. */
const base = (p: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> => ({
  width: 20,
  height: 20,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  ...p,
});

export const IconUndo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M7 5 3.5 8.5 7 12" />
    <path d="M4 8.5h8a4.5 4.5 0 0 1 0 9H9" />
  </svg>
);
export const IconClear = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 5l10 10M15 5 5 15" />
  </svg>
);
export const IconRebet = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M15.5 8A6 6 0 0 0 4.6 6.6M4.5 12a6 6 0 0 0 10.9 1.4" />
    <path d="M4 3.5v3.3h3.3M16 16.5v-3.3h-3.3" />
  </svg>
);
export const IconDouble = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="8" cy="10" r="4.5" />
    <circle cx="12" cy="10" r="4.5" />
  </svg>
);
export const IconInfo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="10" cy="10" r="7.25" />
    <path d="M10 9v4.5M10 6.5v.01" />
  </svg>
);
export const IconSound = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3.5 8v4h3l4 3.5v-11l-4 3.5h-3Z" />
    <path d="M13.5 7.5a3.5 3.5 0 0 1 0 5M15.5 5.5a6.4 6.4 0 0 1 0 9" />
  </svg>
);
export const IconMuted = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3.5 8v4h3l4 3.5v-11l-4 3.5h-3Z" />
    <path d="m13.5 8 4 4M17.5 8l-4 4" />
  </svg>
);
export const IconInspector = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M7 6 3 10l4 4M13 6l4 4-4 4" />
  </svg>
);
export const IconClose = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
  </svg>
);
