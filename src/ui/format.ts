import { CURRENCY } from '../config/game';

const money = new Intl.NumberFormat(CURRENCY.locale, { style: 'currency', currency: CURRENCY.code, minimumFractionDigits: 2 });
const moneyWhole = new Intl.NumberFormat(CURRENCY.locale, { style: 'currency', currency: CURRENCY.code, maximumFractionDigits: 0 });

/** Minor units → "€1,234.50". Formatting happens only at the UI edge (AGENTS.md §3). */
export const formatMoney = (minor: number): string => money.format(minor / 100);

/** Minor units → "€5", or "€2.50" if it has cents. */
export const formatShort = (minor: number): string => (minor % 100 === 0 ? moneyWhole.format(minor / 100) : money.format(minor / 100));

/** Chip face: 1, 5, 25, 1K, 2.5K. */
export function chipLabel(minor: number): string {
  const v = minor / 100;
  if (v >= 1000) return `${+(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K`;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

export const formatSigned = (minor: number): string => (minor > 0 ? `+${formatMoney(minor)}` : minor < 0 ? `−${formatMoney(-minor)}` : formatMoney(0));

export function clockTime(epochMs: number): string {
  const d = new Date(epochMs);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}
