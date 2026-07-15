/*
 * ALGORITHM — the per-trade comment card.
 * =======================================
 * `buildComment()` turns one closed trade into a `TradeCard`: an opener, the
 * deposit-impact line, an optional leverage-amplification line, up to two
 * detected patterns, and an optional gentle nudge. It is assembled into
 * readable HTML blocks separated by dividers.
 *
 * The numbers come from format.ts / detect.ts; this file decides WHAT to say
 * and HOW to lay it out. Copy is localised via `t`.
 */

import type { Trade, TradeCard } from "./types";
import { C } from "./config";
import { pnl, moveOf, sgn, fk, capitalize } from "./format";
import { readBalance, rotate } from "./state";
import { LOSS, WIN, magW, magWW } from "./messages";
import { detect } from "./detect";
import { t } from "./i18n";

/** RULE: only show the leverage-amplification line at/above this multiplier. */
export const MOVE_LEVERAGE_MIN = 20;

/** How many detected patterns to show on a card (highest-priority first). */
export const MAX_PATTERNS = 2;

export function buildComment(trade: Trade, all: Trade[], list: Trade[]): TradeCard {
  const p = pnl(trade), bal = readBalance();
  const pct = bal ? (Math.abs(p) / bal) * 100 : 0;   // loss/gain as % of deposit
  const move = moveOf(trade);                          // raw price move %
  const pin = trade.sumInv ? (p / trade.sumInv) * 100 : 0; // P&L as % of invested margin
  const notion = trade.sumInv * trade.mult;            // notional (leveraged) volume

  const mood = p < 0 ? "😕" : p > 0 ? "✅" : "➖";
  const acc = p < 0 ? C.br : p > 0 ? C.pos : C.t2;
  const ti = p < 0
    ? t("Разбор сделки: минус", "Trade review: loss")
    : p > 0
      ? t("Разбор сделки: плюс", "Trade review: profit")
      : t("Сделка в ноль", "Break-even trade");

  // Opener: break-even gets a fixed line; win/loss rotate through the pools.
  const head =
    p === 0
      ? t(`Сделка по <b>${trade.alias}</b> закрылась в ноль.`, `Your <b>${trade.alias}</b> trade closed at break-even.`)
      : rotate(p < 0 ? LOSS : WIN, p < 0 ? "l" : "w").replace("{a}", trade.alias).replace("{v}", sgn(p));

  // Deposit-impact line. RULE: never print "0.00%" — floor the display at 0.01%.
  const pctS = pct > 0 ? (pct.toFixed(2) === "0.00" ? "0.01" : pct.toFixed(2)) : "0.00";
  const balS =
    p < 0
      ? t(` Это <b>${magW(pct)}</b> убыток — <b style="color:${C.neg}">−${pctS}%</b> депозита ($${fk(bal)}).`, ` A <b>${magW(pct)}</b> loss — <b style="color:${C.neg}">−${pctS}%</b> of your deposit ($${fk(bal)}).`)
      : p > 0
        ? t(` ${capitalize(magWW(pct))} плюс — <b style="color:${C.pos}">${pctS}%</b> депозита ($${fk(bal)}).`, ` ${capitalize(magWW(pct))} gain — <b style="color:${C.pos}">${pctS}%</b> of your deposit ($${fk(bal)}).`)
        : "";

  // Leverage-amplification line: how a tiny price move became a big % of margin.
  const moveS =
    trade.mult >= MOVE_LEVERAGE_MIN
      ? t(` ⚙️ Цена прошла всего <b>${move >= 0 ? "+" : ""}${move.toFixed(2)}%</b>, но плечо <b>×${trade.mult}</b> превратило это в <b style="color:${p < 0 ? C.neg : C.pos}">${pin >= 0 ? "+" : ""}${pin.toFixed(1)}%</b> от вложенного (объём ~$${fk(notion)}).`, ` ⚙️ Price moved only <b>${move >= 0 ? "+" : ""}${move.toFixed(2)}%</b>, but <b>×${trade.mult}</b> leverage turned it into <b style="color:${p < 0 ? C.neg : C.pos}">${pin >= 0 ? "+" : ""}${pin.toFixed(1)}%</b> of your invested (volume ~$${fk(notion)}).`)
      : "";

  const patsArr = detect(trade, all, list).slice(0, MAX_PATTERNS);

  // Nudge: a soft tip after a stop-less loss, or praise after a protected win.
  const nudge =
    p < 0 && trade.stopLossPrice == null
      ? rotate(
          t(
            [
              "Мягкий совет на будущее: при таком плече стоп-лосс — твой лучший друг, он бы аккуратно сгладил этот минус.",
              "Без давления — но SL в следующий раз тихо ограничит просадку. Стоит сделать привычкой.",
            ],
            [
              "A gentle tip for next time: at this leverage a stop-loss is your best friend — it would have softened this dip.",
              "No pressure — but an SL next time quietly caps the drawdown. Worth making a habit.",
            ],
          ),
          "nsl",
        )
      : p > 0 && trade.stopLossPrice != null
        ? rotate(
            t(
              [
                "Плюс и со стопом — вот это по-чемпионски. 👏",
                "В плюс и под защитой стопа — красота, так держи.",
              ],
              [
                "Profit and a stop in place — that's championship stuff. 👏",
                "In the green and protected by a stop — lovely, keep it up.",
              ],
            ),
            "good",
          )
        : "";

  // Assemble the body into readable blocks with dividers.
  const blocks: string[] = [`<div style="line-height:1.6">${head}${balS}</div>`];
  if (moveS)
    blocks.push(
      `<div style="margin-top:11px;padding-top:11px;border-top:1px solid ${C.line};line-height:1.55">${moveS.replace(/^\s+/, "")}</div>`,
    );
  if (patsArr.length)
    blocks.push(
      `<div style="margin-top:11px;padding-top:11px;border-top:1px solid ${C.line}">` +
        patsArr
          .map(
            (x, i) =>
              `<div style="display:flex;gap:8px;line-height:1.5${i ? ";margin-top:6px" : ""}"><span style="color:${C.br};font-weight:800">•</span><span>${x}</span></div>`,
          )
          .join("") +
        `</div>`,
    );
  if (nudge)
    blocks.push(
      `<div style="margin-top:11px;background:rgba(255,164,8,.09);border:1px solid rgba(255,164,8,.30);border-radius:10px;padding:9px 11px;line-height:1.5">💡 ${nudge}</div>`,
    );

  return {
    m: mood,
    a: acc,
    ti,
    h: blocks.join(""),
    chip: trade.alias,
    time: new Date(trade.closeTime).toLocaleTimeString(t("ru-RU", "en-US"), { hour: "2-digit", minute: "2-digit" }),
  };
}
