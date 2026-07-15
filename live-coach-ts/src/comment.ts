/*
 * ALGORITHM — the per-trade comment card.
 * =======================================
 * `buildComment()` turns one closed trade into a `TradeCard`: an opener, the
 * deposit-impact line, an optional leverage-amplification line, up to two
 * detected patterns, and an optional gentle nudge. It is assembled into
 * readable HTML blocks separated by dividers.
 *
 * The numbers themselves come from format.ts / detect.ts; this file only
 * decides WHAT to say and HOW to lay it out.
 */

import type { Trade, TradeCard } from "./types";
import { C } from "./config";
import { pnl, moveOf, sgn, fk, capitalize } from "./format";
import { readBalance, rotate } from "./state";
import { LOSS, WIN, magW, magWW } from "./messages";
import { detect } from "./detect";

/** RULE: only show the leverage-amplification line at/above this multiplier. */
export const MOVE_LEVERAGE_MIN = 20;

/** How many detected patterns to show on a card (highest-priority first). */
export const MAX_PATTERNS = 2;

export function buildComment(t: Trade, all: Trade[], list: Trade[]): TradeCard {
  const p = pnl(t), bal = readBalance();
  const pct = bal ? (Math.abs(p) / bal) * 100 : 0;   // loss/gain as % of deposit
  const move = moveOf(t);                            // raw price move %
  const pin = t.sumInv ? (p / t.sumInv) * 100 : 0;   // P&L as % of invested margin
  const notion = t.sumInv * t.mult;                  // notional (leveraged) volume

  const mood = p < 0 ? "😕" : p > 0 ? "✅" : "➖";
  const acc = p < 0 ? C.br : p > 0 ? C.pos : C.t2;
  const ti = p < 0 ? "Разбор сделки: минус" : p > 0 ? "Разбор сделки: плюс" : "Сделка в ноль";

  // Opener: break-even gets a fixed line; win/loss rotate through the pools.
  const head =
    p === 0
      ? `Сделка по <b>${t.alias}</b> закрылась в ноль.`
      : rotate(p < 0 ? LOSS : WIN, p < 0 ? "l" : "w").replace("{a}", t.alias).replace("{v}", sgn(p));

  // Deposit-impact line. RULE: never print "0.00%" — floor the display at 0.01%.
  const pctS = pct > 0 ? (pct.toFixed(2) === "0.00" ? "0.01" : pct.toFixed(2)) : "0.00";
  const balS =
    p < 0
      ? ` Это <b>${magW(pct)}</b> убыток — <b style="color:${C.neg}">−${pctS}%</b> депозита ($${fk(bal)}).`
      : p > 0
        ? ` ${capitalize(magWW(pct))} плюс — <b style="color:${C.pos}">${pctS}%</b> депозита ($${fk(bal)}).`
        : "";

  // Leverage-amplification line: how a tiny price move became a big % of margin.
  const moveS =
    t.mult >= MOVE_LEVERAGE_MIN
      ? ` ⚙️ Цена прошла всего <b>${move >= 0 ? "+" : ""}${move.toFixed(2)}%</b>, но плечо <b>×${t.mult}</b> превратило это в <b style="color:${p < 0 ? C.neg : C.pos}">${pin >= 0 ? "+" : ""}${pin.toFixed(1)}%</b> от вложенного (объём ~$${fk(notion)}).`
      : "";

  const patsArr = detect(t, all, list).slice(0, MAX_PATTERNS);

  // Nudge: a soft tip after a stop-less loss, or praise after a protected win.
  const nudge =
    p < 0 && t.stopLossPrice == null
      ? rotate(
          [
            "Мягкий совет на будущее: при таком плече стоп-лосс — твой лучший друг, он бы аккуратно сгладил этот минус.",
            "Без давления — но SL в следующий раз тихо ограничит просадку. Стоит сделать привычкой.",
          ],
          "nsl",
        )
      : p > 0 && t.stopLossPrice != null
        ? rotate(
            [
              "Плюс и со стопом — вот это по-чемпионски. 👏",
              "В плюс и под защитой стопа — красота, так держи.",
            ],
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
    chip: t.alias,
    time: new Date(t.closeTime).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
  };
}
