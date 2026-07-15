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
 * Leverage bands. `mult ≤ max` picks the band; `wipe%` = adverse move that
 * wipes the position (100 / mult). Bands escalate 1‑10 / 11‑50 / 51‑150 /
 * 151‑500 / >500. Tune the boundaries or wording here.
 */
export const LEVERAGE_BANDS: ReadonlyArray<{ max: number; text: (m: number, wp: string) => string }> = [
  { max: 10,  text: (m, wp) => `низкое плечо <b>×${m}</b> — комфортный запас, ~${wp}% против тебя до margin call 👍` },
  { max: 50,  text: (m, wp) => `умеренное плечо <b>×${m}</b> — до margin call ~${wp}% движения против` },
  { max: 150, text: (m, wp) => `высокое плечо <b>×${m}</b> — риск ощутимый: ~${wp}% против тебя уже съедает позицию` },
  { max: 500, text: (m, wp) => `очень высокое плечо <b>×${m}</b> — на грани: ~${wp}% против почти обнуляет вложенное` },
  { max: Infinity, text: (m, wp) => `экстремальное плечо <b>×${m}</b> — хватает <b>~${wp}%</b> против, чтобы стереть позицию` },
];

/**
 * Detect behavioural patterns in trade `t`.
 * @param all  every known trade (baseline + new) — used to look back for a prior loss
 * @param list the running list of new trades — used for streaks / concentration
 */
export function detect(t: Trade, all: Trade[], list: Trade[]): string[] {
  const out: string[] = [];
  const p = pnl(t), bal = S.bal, m = t.mult, wp = wipe(m);

  // RULE — revenge trade: this trade opened shortly after a loss closed.
  const lastLoss = all
    .filter((x) => x.closeTime <= t.startTime && pnl(x) < 0)
    .sort((a, b) => a.closeTime - b.closeTime)
    .pop();
  if (lastLoss && t.startTime - lastLoss.closeTime <= REVENGE_WINDOW_MS)
    out.push("Открыта <b>вскоре после убытка</b> — следи, чтобы это не был эмоциональный отыгрыш.");

  // RULE — leverage band (always shown): graded risk + margin-call distance.
  const wpS = wp >= 1 ? wp.toFixed(1) : wp.toFixed(2);
  out.push((LEVERAGE_BANDS.find((band) => m <= band.max) ?? LEVERAGE_BANDS[LEVERAGE_BANDS.length - 1]).text(m, wpS));

  // RULE — no stop-loss (harsher wording when it also lost).
  if (t.stopLossPrice == null && p < 0)
    out.push("Без <b>стоп-лосса</b> — при таком плече убыток ничем не был ограничен.");
  else if (t.stopLossPrice == null)
    out.push("Без <b>стоп-лосса</b> — риск в сделке не был ограничен заранее.");

  // RULE — capital concentration: one position too big a share of the deposit.
  const expo = bal ? (t.sumInv / bal) * 100 : 0;
  if (expo >= CONCENTRATION_PCT)
    out.push(`В одной позиции было <b>${expo.toFixed(0)}% депозита</b> — высокая концентрация капитала под риском.`);

  // RULE — oversized margin vs the trader's own median margin.
  if (S.medSum && t.sumInv > S.medSum * OVERSIZE_FACTOR)
    out.push(`Маржа <b>крупнее обычного</b> (~$${fmt(t.sumInv)} против медианы ~$${fmt(S.medSum)}).`);

  // RULE — held unusually long into a loss.
  const d = (t.closeTime - t.startTime) / 60000;
  if (S.medDur && d > Math.max(S.medDur * LONG_HOLD_FACTOR, LONG_HOLD_FLOOR_MIN) && p < 0)
    out.push(`Позицию <b>держал долго</b> (${Math.round(d)} мин) — убыток тянулся дольше обычного.`);

  // RULE — win / loss streak: count consecutive same-sign results back from now.
  let streak = 1;
  for (let i = list.length - 2; i >= 0; i--) {
    const q = pnl(list[i]);
    if (q !== 0 && p !== 0 && q > 0 === p > 0) streak++;
    else break;
  }
  if (p > 0 && streak >= STREAK_MIN)
    out.push(`Это <b>${streak}-я прибыль подряд</b> 🔥 — серия идёт, но не поднимай плечо на азарте.`);
  if (p < 0 && streak >= STREAK_MIN)
    out.push(`Уже <b>${streak}-й убыток подряд</b> — хороший момент сделать паузу.`);

  // RULE — instrument concentration: same alias as the previous new trade.
  if (list.length >= 2 && list[list.length - 2].alias === t.alias)
    out.push(`Снова <b>${t.alias}</b> — заметна концентрация на одном инструменте.`);

  return out;
}
