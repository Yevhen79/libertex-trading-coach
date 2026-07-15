/*
 * ALGORITHM — the per-trade comment card.
 * =======================================
 * `buildComment()` turns one closed trade into a `TradeCard`: an opener, the
 * deposit-impact line, an optional leverage-amplification line, and up to two
 * detected patterns. It is assembled into readable HTML blocks separated by
 * dividers.
 *
 * The numbers come from format.ts / detect.ts; this file decides WHAT to say
 * and HOW to lay it out. All copy lives in src/locales via `L`.
 */

import type { Trade, TradeCard } from "./types";
import { C } from "./config";
import { pnl, moveOf, sgn, fk } from "./format";
import { readBalance, rotate } from "./state";
import { detect } from "./detect";
import { L } from "./i18n";

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
  const ti = p < 0 ? L.cardTitleLoss : p > 0 ? L.cardTitleWin : L.cardTitleFlat;

  // Opener: break-even gets a fixed line; win/loss rotate through the pools.
  const head =
    p === 0
      ? L.breakEvenHead(trade.alias)
      : rotate(p < 0 ? L.lossOpeners : L.winOpeners, p < 0 ? "l" : "w").replace("{a}", trade.alias).replace("{v}", sgn(p));

  // Deposit-impact line. RULE: never print "0.00%" — floor the display at 0.01%.
  const pctS = pct > 0 ? (pct.toFixed(2) === "0.00" ? "0.01" : pct.toFixed(2)) : "0.00";
  const balS =
    p < 0 ? L.lossDeposit(C.neg, pctS, fk(bal))
    : p > 0 ? L.gainDeposit(C.pos, pctS, fk(bal))
    : "";

  // Leverage-amplification line: how a tiny price move became a big % of margin.
  const moveS =
    trade.mult >= MOVE_LEVERAGE_MIN
      ? L.leverageAmp(
          `${move >= 0 ? "+" : ""}${move.toFixed(2)}`,
          trade.mult,
          p < 0 ? C.neg : C.pos,
          `${pin >= 0 ? "+" : ""}${pin.toFixed(1)}`,
          fk(notion),
        )
      : "";

  const patsArr = detect(trade, all, list).slice(0, MAX_PATTERNS);

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

  return {
    m: mood,
    a: acc,
    ti,
    h: blocks.join(""),
    chip: trade.alias,
    time: new Date(trade.closeTime).toLocaleTimeString(L.timeLocale, { hour: "2-digit", minute: "2-digit" }),
  };
}
