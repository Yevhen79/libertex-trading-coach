/*
 * Data structures — the shape of everything the coach works with.
 * No logic here: just the types shared across the algorithm and UI layers.
 */

/** Trade direction as returned by the API (`growth` = buy, `reduction` = sell). */
export type Direction = "growth" | "reduction";

/** A single closed position, as returned by the closed-positions endpoint. */
export interface Trade {
  ticket: number;
  symbol: string;
  alias: string;
  direction: Direction;
  mult: number;          // leverage multiplier (×1 .. ×3000)
  sumInv: number;        // margin invested
  equityInv: number;     // equity at close
  startRate: number;
  closeRate: number;
  startTime: number;     // epoch ms
  closeTime: number;     // epoch ms
  stopLossPrice: number | null;
  takeProfitPrice: number | null;
}

/** Raw response of GET /spa/report/closed-positions. */
export interface ClosedPositionsResponse {
  result?: { closed?: Trade[]; summary?: unknown };
}

/** Per-card 👍/👎 feedback. */
export type Vote = "up" | "down";

/** One rendered coach card (produced per closed trade). */
export interface TradeCard {
  m: string;             // mood glyph
  a: string;             // accent colour
  ti: string;            // title
  h: string;             // body HTML
  chip: string;          // instrument alias
  time: string;          // formatted close time
  review?: ReviewData;   // present on every Nth card
  vote?: Vote;           // 👍 / 👎 feedback
}

/**
 * A raw metric tile in the review: a measured behavioural number, not a 1..10
 * score. `value` is the headline (e.g. "4 мин", "±38%", "32%"); `note` is the
 * one-line context under it.
 */
export interface ReviewMetric {
  label: string;
  value: string;
  note: string;
}

/** One section of the review — either free prose (`html`) or a bullet `list`. */
export interface ReviewSection {
  h: string;
  html?: string;
  list?: string[];
}

/** The full N-trade "AI Trading Review". */
export interface ReviewData {
  list: Trade[];
  sections: ReviewSection[];
  metrics: ReviewMetric[];
  habit: string;
  rating?: number;       // ⭐ 1..5 the user gave the review
}

/** Persistent coach state kept on `window` so a re-inject continues seamlessly. */
export interface CoachState {
  seen: Record<number, 1>;     // tickets already accounted for
  cards: TradeCard[];          // rendered cards, newest last
  idx: number;                 // currently shown card
  newCount: number;            // trades closed since the coach started
  newTrades: Trade[];          // those trades, in order
  baseAll: Trade[];            // history snapshot taken at first poll (the baseline)
  init: boolean;               // has the baseline been seeded yet?
  rot: Record<string, number>; // round-robin cursors for message pools
  bal: number;                 // last known free balance
  medSum: number;              // median margin across the baseline
  medDur: number;              // median hold time (min) across the baseline
  reviewReady: boolean;        // a full review is waiting to be opened (rings full + glow)
}

/** `window` extended with the coach's globals. */
export interface CoachWindow extends Window {
  __lbxCoach?: CoachState;
  __lbxCoachStop?: () => void;
}

/** UI colour palette. */
export interface Palette {
  bg: string; sf: string; rs: string; br: string;
  pos: string; neg: string; t: string; t2: string;
  line: string; font: string;
}
