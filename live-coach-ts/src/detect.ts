/*
 * ALGORITHM — per-trade behavioural pattern detection.
 * ====================================================
 * `detect()` looks at ONE just-closed trade in the context of the trader's
 * history and returns a list of short human notes. Each `if` below is one
 * behavioural RULE; the constant next to it is its threshold. The card only
 * ever shows the first two notes (see comment.ts), so order = priority.
 *
 * To tune a rule: change its constant here. To find where a note comes from:
 * search the note text — each is produced by exactly one rule below.
 */

import type { Trade } from "./types";
import { pnl, fmt, wipe } from "./format";
import { S } from "./state";
import { L } from "./i18n";

// ---- Rule thresholds (edit these to re-tune the coach) -----------------

/** RULE "revenge trade": opened within this long after closing a loss. */
export const REVENGE_WINDOW_MS = 20 * 60000; // 20 minutes

/** RULE "capital concentration": warn if one position ≥ this % of deposit. */
export const CONCENTRATION_PCT = 15;

/** RULE "oversized margin": margin is "larger than usual" above this × median. */
export const OVERSIZE_FACTOR = 1.8;

/** RULE "held too long": longer than max(this × median hold, 30 min) into a loss. */
export const LONG_HOLD_FACTOR = 3;
export const LONG_HOLD_FLOOR_MIN = 30;

/** RULE "streak": call out a win/loss streak once it reaches this length. */
export const STREAK_MIN = 3;

/**
 * RULE "revenge warning" (the hard, banner-triggering one): a trade opened
 * within this window after a loss closed AND carrying more risk than that loss.
 * Tighter than REVENGE_WINDOW_MS, which only powers the soft in-card note.
 */
export const REVENGE_RECENT_MS = 5 * 60000; // 5 minutes

/** What a revenge warning is made of — the prior loss and how this trade escalated. */
export interface RevengeSignal {
  prevLoss: Trade;
  minutesAfter: number;
  higherLev: boolean;     // this trade's leverage exceeds the loss's
  biggerMargin: boolean;  // this trade's margin exceeds the loss's
}

/**
 * Post-facto revenge check for ONE trade: was it opened within 5 min of a loss
 * closing, with higher leverage OR bigger margin than that loss? Returns the
 * signal (for the banner) or null. Never blocks anything — detection only.
 */
export function detectRevenge(trade: Trade, all: Trade[]): RevengeSignal | null {
  const prevLoss = all
    .filter((x) => x.ticket !== trade.ticket && pnl(x) < 0 && x.closeTime <= trade.startTime)
    .sort((a, b) => a.closeTime - b.closeTime)
    .pop();
  if (!prevLoss) return null;
  const gap = trade.startTime - prevLoss.closeTime;
  if (gap > REVENGE_RECENT_MS) return null;
  const higherLev = trade.mult > prevLoss.mult;
  const biggerMargin = trade.sumInv > prevLoss.sumInv;
  if (!higherLev && !biggerMargin) return null;
  return { prevLoss, minutesAfter: Math.max(0, Math.round(gap / 60000)), higherLev, biggerMargin };
}

/**
 * Leverage band boundaries (logic only — the wording lives in L.leverageBands).
 * `mult ≤ max` picks the band index; `wp` = adverse move (%) that wipes the
 * position (100 / mult). Bands escalate 1‑10 / 11‑50 / 51‑150 / 151‑500 / >500.
 */
export const LEVERAGE_BAND_MAX: readonly number[] = [10, 50, 150, 500, Infinity];

/**
 * Detect behavioural patterns in trade `t`.
 * @param all  every known trade (baseline + new) — used to look back for a prior loss
 * @param list the running list of new trades — used for streaks / concentration
 */
export function detect(trade: Trade, all: Trade[], list: Trade[]): string[] {
  const out: string[] = [];
  const p = pnl(trade), bal = S.bal, m = trade.mult, wp = wipe(m);

  // RULE — revenge trade: this trade opened shortly after a loss closed.
  const lastLoss = all
    .filter((x) => x.closeTime <= trade.startTime && pnl(x) < 0)
    .sort((a, b) => a.closeTime - b.closeTime)
    .pop();
  if (lastLoss && trade.startTime - lastLoss.closeTime <= REVENGE_WINDOW_MS)
    out.push(L.revengeNote);

  // RULE — leverage band (always shown): graded risk + margin-call distance.
  const wpS = wp >= 1 ? wp.toFixed(1) : wp.toFixed(2);
  const bandIdx = LEVERAGE_BAND_MAX.findIndex((max) => m <= max);
  out.push(L.leverageBands[bandIdx < 0 ? L.leverageBands.length - 1 : bandIdx](m, wpS));

  // RULE — no stop-loss (harsher wording when it also lost).
  if (trade.stopLossPrice == null && p < 0) out.push(L.noStopOnLoss);
  else if (trade.stopLossPrice == null) out.push(L.noStop);

  // RULE — capital concentration: one position too big a share of the deposit.
  const expo = bal ? (trade.sumInv / bal) * 100 : 0;
  if (expo >= CONCENTRATION_PCT) out.push(L.concentration(expo.toFixed(0)));

  // RULE — oversized margin vs the trader's own median margin.
  if (S.medSum && trade.sumInv > S.medSum * OVERSIZE_FACTOR)
    out.push(L.oversizeMargin(fmt(trade.sumInv), fmt(S.medSum)));

  // RULE — held unusually long into a loss.
  const d = (trade.closeTime - trade.startTime) / 60000;
  if (S.medDur && d > Math.max(S.medDur * LONG_HOLD_FACTOR, LONG_HOLD_FLOOR_MIN) && p < 0)
    out.push(L.longHold(Math.round(d)));

  // RULE — win / loss streak: count consecutive same-sign results back from now.
  let streak = 1;
  for (let i = list.length - 2; i >= 0; i--) {
    const q = pnl(list[i]);
    if (q !== 0 && p !== 0 && q > 0 === p > 0) streak++;
    else break;
  }
  if (p > 0 && streak >= STREAK_MIN) out.push(L.winStreak(streak));
  if (p < 0 && streak >= STREAK_MIN) out.push(L.lossStreak(streak));

  // RULE — instrument concentration: same alias as the previous new trade.
  if (list.length >= 2 && list[list.length - 2].alias === trade.alias)
    out.push(L.sameInstrument(trade.alias));

  return out;
}
