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
import { t } from "./i18n";

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
 * Leverage bands. `mult ≤ max` picks the band; `wp` = adverse move (%) that
 * wipes the position (100 / mult). Bands escalate 1‑10 / 11‑50 / 51‑150 /
 * 151‑500 / >500. Tune the boundaries or wording here.
 */
export const LEVERAGE_BANDS: ReadonlyArray<{ max: number; text: (m: number, wp: string) => string }> = [
  { max: 10, text: (m, wp) => t(`низкое плечо <b>×${m}</b> — комфортный запас, ~${wp}% против тебя до margin call 👍`, `low leverage <b>×${m}</b> — comfortable buffer, ~${wp}% against you to a margin call 👍`) },
  { max: 50, text: (m, wp) => t(`умеренное плечо <b>×${m}</b> — до margin call ~${wp}% движения против`, `moderate leverage <b>×${m}</b> — ~${wp}% adverse move to a margin call`) },
  { max: 150, text: (m, wp) => t(`высокое плечо <b>×${m}</b> — риск ощутимый: ~${wp}% против тебя уже съедает позицию`, `high leverage <b>×${m}</b> — real risk: ~${wp}% against you already eats the position`) },
  { max: 500, text: (m, wp) => t(`очень высокое плечо <b>×${m}</b> — на грани: ~${wp}% против почти обнуляет вложенное`, `very high leverage <b>×${m}</b> — on the edge: ~${wp}% against nearly wipes your stake`) },
  { max: Infinity, text: (m, wp) => t(`экстремальное плечо <b>×${m}</b> — хватает <b>~${wp}%</b> против, чтобы стереть позицию`, `extreme leverage <b>×${m}</b> — just <b>~${wp}%</b> against is enough to wipe the position`) },
];

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
    out.push(t("Открыта <b>вскоре после убытка</b> — следи, чтобы это не был эмоциональный отыгрыш.", "Opened <b>shortly after a loss</b> — watch that this isn't an emotional revenge trade."));

  // RULE — leverage band (always shown): graded risk + margin-call distance.
  const wpS = wp >= 1 ? wp.toFixed(1) : wp.toFixed(2);
  out.push((LEVERAGE_BANDS.find((band) => m <= band.max) ?? LEVERAGE_BANDS[LEVERAGE_BANDS.length - 1]).text(m, wpS));

  // RULE — no stop-loss (harsher wording when it also lost).
  if (trade.stopLossPrice == null && p < 0)
    out.push(t("Без <b>стоп-лосса</b> — при таком плече убыток ничем не был ограничен.", "No <b>stop-loss</b> — at this leverage nothing capped the loss."));
  else if (trade.stopLossPrice == null)
    out.push(t("Без <b>стоп-лосса</b> — риск в сделке не был ограничен заранее.", "No <b>stop-loss</b> — the trade's risk wasn't capped in advance."));

  // RULE — capital concentration: one position too big a share of the deposit.
  const expo = bal ? (trade.sumInv / bal) * 100 : 0;
  if (expo >= CONCENTRATION_PCT)
    out.push(t(`В одной позиции было <b>${expo.toFixed(0)}% депозита</b> — высокая концентрация капитала под риском.`, `This position held <b>${expo.toFixed(0)}% of the deposit</b> — high capital concentration at risk.`));

  // RULE — oversized margin vs the trader's own median margin.
  if (S.medSum && trade.sumInv > S.medSum * OVERSIZE_FACTOR)
    out.push(t(`Маржа <b>крупнее обычного</b> (~$${fmt(trade.sumInv)} против медианы ~$${fmt(S.medSum)}).`, `Margin <b>larger than usual</b> (~$${fmt(trade.sumInv)} vs a median of ~$${fmt(S.medSum)}).`));

  // RULE — held unusually long into a loss.
  const d = (trade.closeTime - trade.startTime) / 60000;
  if (S.medDur && d > Math.max(S.medDur * LONG_HOLD_FACTOR, LONG_HOLD_FLOOR_MIN) && p < 0)
    out.push(t(`Позицию <b>держал долго</b> (${Math.round(d)} мин) — убыток тянулся дольше обычного.`, `Held <b>a long time</b> (${Math.round(d)} min) — the loss ran longer than usual.`));

  // RULE — win / loss streak: count consecutive same-sign results back from now.
  let streak = 1;
  for (let i = list.length - 2; i >= 0; i--) {
    const q = pnl(list[i]);
    if (q !== 0 && p !== 0 && q > 0 === p > 0) streak++;
    else break;
  }
  if (p > 0 && streak >= STREAK_MIN)
    out.push(t(`Это <b>${streak}-я прибыль подряд</b> 🔥 — серия идёт, но не поднимай плечо на азарте.`, `That's <b>${streak} wins in a row</b> 🔥 — nice streak, but don't raise leverage on the buzz.`));
  if (p < 0 && streak >= STREAK_MIN)
    out.push(t(`Уже <b>${streak}-й убыток подряд</b> — хороший момент сделать паузу.`, `Already <b>${streak} losses in a row</b> — a good moment to pause.`));

  // RULE — instrument concentration: same alias as the previous new trade.
  if (list.length >= 2 && list[list.length - 2].alias === trade.alias)
    out.push(t(`Снова <b>${trade.alias}</b> — заметна концентрация на одном инструменте.`, `Again <b>${trade.alias}</b> — you're concentrating on one instrument.`));

  return out;
}
