/*
 * ALGORITHM — the N-trade "AI Trading Review".
 * ============================================
 * `buildReview()` aggregates the last N new trades into: six prose/list
 * sections, three 1..10 scores, and one "habit for next time".
 *
 * The aggregates are plain descriptive statistics. The tunable part is
 * "SCORES" — each score is a small formula clamped to 1..10; the comments
 * spell out exactly what pushes each up or down. Copy is localised via `t`.
 */

import type { Trade, ReviewData, ReviewSection, ReviewMetric } from "./types";
import { C } from "./config";
import { pnl, isWin, isLoss, sum, fmt, sgn, fk, median, madPct, restGaps, postLossTrades } from "./format";
import { S, readBalance } from "./state";
import { L } from "./i18n";

/** RULE: same 20-min window as detect.ts, used to count revenge trades in the window. */
export const REVENGE_WINDOW_MS = 20 * 60000;

export function buildReview(list: Trade[]): ReviewData {
  const bal = readBalance();
  const wins = list.filter(isWin), losses = list.filter(isLoss), n = list.length;

  // ---- aggregates (descriptive stats over the window) ------------------
  const net = sum(list.map(pnl));
  const avgW = wins.length ? sum(wins.map(pnl)) / wins.length : 0;
  const avgL = losses.length ? sum(losses.map(pnl)) / losses.length : 0;
  const rr = avgW > 0 ? Math.abs(avgL) / avgW : 99;          // avg-loss : avg-win ratio

  const bestTrade = list.slice().sort((a, b) => pnl(b) - pnl(a))[0];
  const worstTrade = list.slice().sort((a, b) => pnl(a) - pnl(b))[0];

  const slp = Math.round((100 * list.filter((tr) => tr.stopLossPrice != null).length) / n); // % with a stop
  const noSL = list.filter((tr) => tr.stopLossPrice == null).length;

  const mults = list.map((tr) => tr.mult);
  const mAvg = Math.round(sum(mults) / n);
  const mMax = Math.max(...mults);
  const mcDist = 100 / median(mults);                        // median margin-call distance %

  const durs = list.map((tr) => (tr.closeTime - tr.startTime) / 60000);
  const dMed = Math.round(median(durs));
  const dMin = Math.round(Math.min(...durs));
  const dMax = Math.round(Math.max(...durs));

  const sums = list.map((tr) => tr.sumInv);
  const avgSum = sum(sums) / n;
  const avgNot = avgSum * mAvg;
  const expoMax = Math.round((100 * Math.max(...sums)) / bal);      // largest position, % of deposit
  const notMax = Math.max(...list.map((tr) => tr.sumInv * tr.mult)); // largest notional volume

  const over = list.filter((tr) => S.medSum && tr.sumInv > S.medSum * 1.8).length; // oversized-margin count
  const revenge = list.filter((tr) => {                            // revenge-trade count in the window
    const ll = S.baseAll.concat(S.newTrades).filter((x) => x.closeTime <= tr.startTime && pnl(x) < 0).pop();
    return ll && tr.startTime - ll.closeTime <= REVENGE_WINDOW_MS;
  }).length;

  // longest LOSING streak inside the window (cl counts losses, resets on a win)
  let mls = 0, cw = 0, cl = 0;
  list.forEach((tr) => {
    const p = pnl(tr);
    if (p > 0) { cw++; cl = 0; }
    else if (p < 0) { cl++; cw = 0; mls = Math.max(mls, cl); }
    else { cw = 0; cl = 0; }
  });

  // per-instrument P&L and trade counts
  const by: Record<string, number> = {}, cnt: Record<string, number> = {};
  list.forEach((tr) => {
    by[tr.alias] = (by[tr.alias] || 0) + pnl(tr);
    cnt[tr.alias] = (cnt[tr.alias] || 0) + 1;
  });
  const ks = Object.keys(by);
  let bestA = ks[0], worstA = ks[0];
  ks.forEach((k) => {
    if (by[k] > by[bestA]) bestA = k;
    if (by[k] < by[worstA]) worstA = k;
  });
  const topA = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0]; // most-traded instrument
  const conc = Math.round((100 * cnt[topA]) / n);                   // its share of trades
  const nAss = Object.keys(cnt).length;

  const lb = S.baseAll;
  const lwr = lb.length ? Math.round((100 * lb.filter(isWin).length) / lb.length) : 0; // historic win rate
  const wr = Math.round((100 * wins.length) / n);                                      // window win rate
  const pctNet = bal ? (net / bal) * 100 : 0;

  // ---- METRICS (raw behavioural numbers, from timestamps & sizes) ------
  //
  // COOLDOWN: median rest gap between consecutive trades (open − previous close).
  //   A low median = trading back-to-back with little pause between decisions.
  const coolMed = Math.round(median(restGaps(list)));
  //
  // SIZE VARIANCE: how much margin and leverage swing around their own median
  //   (mean absolute deviation, % of median). High = erratic position sizing.
  const marginVar = Math.round(madPct(sums));
  const multVar = Math.round(madPct(mults));
  //
  // POST-LOSS WIN RATE: of trades opened within 5 min of a loss closing, what
  //   share actually won. Measured against the full history for context.
  const plTrades = postLossTrades(list, S.baseAll.concat(S.newTrades));
  const plWR = plTrades.length ? Math.round((100 * plTrades.filter(isWin).length) / plTrades.length) : null;

  // ---- verbal buckets ---------------------------------------------------
  const styleName = dMed < 3 ? L.styleScalper
    : dMed < 60 ? L.styleIntraday
    : dMed < 1440 ? L.styleDaySwing
    : L.styleSwing;
  const levDesc = L.levDesc(mAvg);
  const concDesc = conc > 60 ? L.concConcentrated(topA, conc) : L.concSpread(nAss);
  const trend = wr >= lwr && net >= 0 ? L.trendImprove : net < 0 ? L.trendDecline : L.trendMixed;

  // "Greed & fear" flags — only surfaced when the condition is met.
  const gf: string[] = [];
  if (rr > 3) gf.push(L.gfSkew(Math.round(rr)));
  if (revenge > 0) gf.push(L.gfRevenge(revenge));
  if (mls >= 3) gf.push(L.gfLossStreak(mls));
  if (over > 0) gf.push(L.gfOversize(over));

  const netColour = net >= 0 ? C.pos : C.neg;
  const pctNetS = `${pctNet >= 0 ? "+" : ""}${pctNet.toFixed(1)}`;

  const sections: ReviewSection[] = [
    {
      h: L.sec1Head,
      html: L.sec1Body(styleName, dMed, levDesc, concDesc),
    },
    {
      h: L.sec2Head(n),
      list: [
        L.sec2Total(n),
        L.sec2Winners(wins.length, n, wr),
        L.sec2Best(bestTrade.alias, C.pos, sgn(pnl(bestTrade))),
        L.sec2Worst(worstTrade.alias, C.neg, sgn(pnl(worstTrade))),
        L.sec2AvgWL(sgn(avgW), sgn(avgL)),
        L.sec2Size(fmt(avgSum), mAvg, fk(avgNot)),
        L.sec2Stops(slp),
        L.sec2Leverage(mAvg, mMax),
        L.sec2Duration(dMed, dMin, dMax),
      ],
    },
    {
      h: L.sec3Head,
      html: L.sec3Body(netColour, sgn(net), pctNetS, wr, lwr, bestA, sgn(by[bestA]), worstA, sgn(by[worstA]), trend),
    },
    {
      h: L.sec4Head,
      html: L.sec4Body(mAvg, mcDist.toFixed(1), expoMax, fk(notMax), slp, L.sec4NoSLTail(noSL)),
    },
    {
      h: L.sec5Head,
      html: gf.length ? L.sec5WithFlags(gf.join("; ")) : L.sec5Clean,
    },
    {
      h: L.sec6Head,
      html:
        (slp < 50 ? L.sec6StopLow : L.sec6StopOk) +
        (mAvg >= 100 ? L.sec6LevHigh : L.sec6LevOk),
    },
  ];

  const metrics: ReviewMetric[] = [
    { label: L.metricCooldownLabel, value: L.metricCooldownValue(coolMed), note: L.metricCooldownNote },
    { label: L.metricSizeLabel, value: L.metricSizeValue(marginVar), note: L.metricSizeNote(multVar) },
    { label: L.metricPostLossLabel, value: L.metricPostLossValue(plWR), note: L.metricPostLossNote(plTrades.length) },
  ];

  // "Habit #1" — the single most useful thing to fix next, chosen by priority.
  const habit = slp < 50 ? L.habitStop
    : mAvg >= 100 ? L.habitLeverage
    : rr > 3 ? L.habitCutLosses
    : L.habitSize;

  return { list, sections, metrics, habit };
}
