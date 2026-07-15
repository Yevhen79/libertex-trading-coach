/*
 * Pure numeric & formatting helpers.
 * No state, no DOM — everything here is a deterministic function of its inputs,
 * so these are the safest pieces to reuse and unit-test.
 */

import type { Trade } from "./types";

/** Realised P&L of a trade, rounded to cents. P&L = equityInv − sumInv. */
export const pnl = (t: Trade): number => Math.round((t.equityInv - t.sumInv) * 100) / 100;

export const isWin = (t: Trade): boolean => pnl(t) > 0;
export const isLoss = (t: Trade): boolean => pnl(t) < 0;

export const sum = (a: number[]): number => a.reduce((s, v) => s + v, 0);

/** Absolute money, ru-RU grouped, max 2 decimals. */
export const fmt = (n: number): string =>
  (Math.round(Math.abs(n) * 100) / 100).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

/** Signed money, e.g. `+$12.30` / `−$4.82` (real minus sign U+2212). */
export const sgn = (n: number): string => (n >= 0 ? "+" : "−") + "$" + fmt(n);

/** Compact money: `1.2k` above 1000, otherwise plain. */
export const fk = (n: number): string =>
  n >= 1000 ? (Math.round(n / 100) / 10).toLocaleString("ru-RU") + "k" : fmt(n);

export const median = (a: number[]): number => {
  if (!a.length) return 0;
  const b = a.slice().sort((x, y) => x - y);
  return b[Math.floor(b.length / 2)];
};

/** Percent price move in the trade's own direction. */
export const moveOf = (t: Trade): number =>
  t.direction === "growth"
    ? ((t.closeRate - t.startRate) / t.startRate) * 100
    : ((t.startRate - t.closeRate) / t.startRate) * 100;

/** Percent adverse move that wipes the position at leverage `m` (100 / m). */
export const wipe = (m: number): number => (m ? 100 / m : 100);

/** Upper-case the first character. */
export const capitalize = (s: string): string => s.replace(/^./, (c) => c.toUpperCase());

/** Russian plural of "сделка" for a countdown ("1 сделка", "2 сделки", "5 сделок"). */
export const plural = (n: number): string => {
  const a = n % 100, b = n % 10;
  return a > 10 && a < 20 ? "сделок" : b === 1 ? "сделка" : b >= 2 && b <= 4 ? "сделки" : "сделок";
};
