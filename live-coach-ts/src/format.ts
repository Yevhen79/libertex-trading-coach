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

// ---- timestamp / dispersion helpers (used by the review metrics) --------

/** Window (ms) after a loss closes within which a new trade counts as "post-loss". */
export const POST_LOSS_MS = 5 * 60000;

/**
 * Mean absolute deviation from the median, as % of the median. A simple,
 * outlier-robust "how spread out are these" number (0 if <2 values or median≤0).
 */
export const madPct = (a: number[]): number => {
  if (a.length < 2) return 0;
  const m = median(a);
  if (m <= 0) return 0;
  return (a.reduce((s, v) => s + Math.abs(v - m), 0) / a.length / m) * 100;
};

/** Rest gaps (minutes) between consecutive trades: open_i − close_(i−1), floored at 0. */
export const restGaps = (trades: Trade[]): number[] => {
  const b = trades.slice().sort((x, y) => x.startTime - y.startTime);
  const gaps: number[] = [];
  for (let i = 1; i < b.length; i++) gaps.push(Math.max(0, (b[i].startTime - b[i - 1].closeTime) / 60000));
  return gaps;
};

/**
 * Trades from `windowTrades` opened within POST_LOSS_MS after ANY loss in `all`
 * closed — i.e. trades taken "in the heat" right after a loss. The caller derives
 * a win rate from the returned set.
 */
export const postLossTrades = (windowTrades: Trade[], all: Trade[]): Trade[] =>
  windowTrades.filter((tr) =>
    all.some((x) => x.ticket !== tr.ticket && pnl(x) < 0 && x.closeTime <= tr.startTime && tr.startTime - x.closeTime <= POST_LOSS_MS),
  );
