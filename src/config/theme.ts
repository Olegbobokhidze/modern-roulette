/**
 * Canvas palette for the wheel. It mirrors the CSS tokens in src/ui/styles/tokens.css, so the
 * felt and the wheel read as one material. Muted, mineral colours; champagne marks focus only.
 */
export const WHEEL_THEME = {
  bowl: '#121213',
  bowlEdge: '#2A2926',
  track: '#1A1A1B',
  trackSheen: '#2B2A28',
  hairline: 'rgba(236, 230, 218, 0.10)',
  ink: '#ECE6DA',
  inkMuted: '#8F897E',
  red: '#8C342E',
  black: '#1E1E21',
  green: '#2E5A4B',
  fret: '#B9A47C',
  cone: '#19191B',
  coneEdge: '#26262A',
  champagne: '#C8B38A',
  champagneLight: '#E7D8B6',
  champagneDark: '#7D6C4C',
  ball: '#F2EEE6',
  ballShade: '#9C978E',
  shadow: 'rgba(0, 0, 0, 0.55)',
} as const;

/** Radii as fractions of the wheel radius, outermost first. The ball runs on RIM and rests in POCKET. */
export const WHEEL_RADII = {
  outer: 1,
  trackOuter: 0.95,
  rim: 0.885,
  trackInner: 0.82,
  deflector: 0.79,
  numbersOuter: 0.765,
  numbersInner: 0.64,
  pocketOuter: 0.64,
  pocket: 0.585,
  pocketInner: 0.52,
  cone: 0.52,
  turret: 0.13,
  ball: 0.03,
} as const;
