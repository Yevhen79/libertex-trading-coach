/*
 * ALGORITHM — the N-trade "AI Trading Review".
 * ============================================
 * `buildReview()` aggregates the last N new trades into: six prose/list
 * sections, three 1..10 scores, and one "habit for next time".
 *
 * The block below (aggregates) is plain descriptive statistics.
 * The interesting, tunable part is "SCORES" — each score is a small formula
 * clamped to 1..10; the comments spell out exactly what pushes each up or down.
 */

import type { Trade, ReviewData, ReviewSection, ReviewScore } from "./types";
import { C } from "./config";
import { pnl, isWin, isLoss, sum, fmt, sgn, fk, median } from "./format";
import { S, readBalance } from "./state";

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

  const slp = Math.round((100 * list.filter((t) => t.stopLossPrice != null).length) / n); // % with a stop
  const noSL = list.filter((t) => t.stopLossPrice == null).length;

  const mults = list.map((t) => t.mult);
  const mAvg = Math.round(sum(mults) / n);
  const mMax = Math.max(...mults);
  const mcDist = 100 / median(mults);                        // median margin-call distance %

  const durs = list.map((t) => (t.closeTime - t.startTime) / 60000);
  const dMed = Math.round(median(durs));
  const dMin = Math.round(Math.min(...durs));
  const dMax = Math.round(Math.max(...durs));

  const sums = list.map((t) => t.sumInv);
  const avgSum = sum(sums) / n;
  const avgNot = avgSum * mAvg;
  const expoMax = Math.round((100 * Math.max(...sums)) / bal);      // largest position, % of deposit
  const notMax = Math.max(...list.map((t) => t.sumInv * t.mult));   // largest notional volume

  const over = list.filter((t) => S.medSum && t.sumInv > S.medSum * 1.8).length; // oversized-margin count
  const revenge = list.filter((t) => {                             // revenge-trade count in the window
    const ll = S.baseAll.concat(S.newTrades).filter((x) => x.closeTime <= t.startTime && pnl(x) < 0).pop();
    return ll && t.startTime - ll.closeTime <= REVENGE_WINDOW_MS;
  }).length;

  // longest LOSING streak inside the window (cl counts losses, resets on a win)
  let mls = 0, cw = 0, cl = 0;
  list.forEach((t) => {
    const p = pnl(t);
    if (p > 0) { cw++; cl = 0; }
    else if (p < 0) { cl++; cw = 0; mls = Math.max(mls, cl); }
    else { cw = 0; cl = 0; }
  });

  // per-instrument P&L and trade counts
  const by: Record<string, number> = {}, cnt: Record<string, number> = {};
  list.forEach((t) => {
    by[t.alias] = (by[t.alias] || 0) + pnl(t);
    cnt[t.alias] = (cnt[t.alias] || 0) + 1;
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

  // ---- SCORES (1..10) — this is the part worth tuning ------------------
  //
  // DISCIPLINE: rewards using stops, punishes high leverage & big exposure.
  //   base = stop-usage% × 5 (so 100% stops ⇒ +5)
  //   + leverage bonus: ×≤10 ⇒ +3, ×≤50 ⇒ +1, else 0
  //   + exposure bonus: largest position < 20% of deposit ⇒ +2
  const disc = Math.max(1, Math.min(10, Math.round((slp / 100) * 5 + (mAvg <= 10 ? 3 : mAvg <= 50 ? 1 : 0) + (expoMax < 20 ? 2 : 0))));
  //
  // CONSISTENCY: rewards win rate, punishes long losing streaks.
  //   base = winRate/10 × 0.6  + streak bonus: ≤2 losses in a row ⇒ +4, ≤4 ⇒ +2, else 0
  const cons = Math.max(1, Math.min(10, Math.round((wr / 10) * 0.6 + (mls <= 2 ? 4 : mls <= 4 ? 2 : 0))));
  //
  // RATIONALITY: starts at 10, subtracts for a bad reward:risk, revenge trades
  //   and very high average leverage.
  //   −min(6, rr)  −(revenge>2 ⇒ 2 | revenge>0 ⇒ 1 | 0)  −(avg leverage ≥200 ⇒ 1)
  const rat = Math.max(1, Math.min(10, Math.round(10 - Math.min(6, rr) - (revenge > 2 ? 2 : revenge > 0 ? 1 : 0) - (mAvg >= 200 ? 1 : 0))));

  // ---- verbal buckets ---------------------------------------------------
  const styleName = dMed < 3 ? "скальпер" : dMed < 60 ? "внутридневной трейдер" : dMed < 1440 ? "дей/свинг-трейдер" : "свинг-трейдер";
  const levDesc =
    mAvg > 500 ? `с экстремальным плечом (в среднем ×${mAvg})`
    : mAvg > 150 ? `с очень высоким плечом (в среднем ×${mAvg})`
    : mAvg > 50 ? `с высоким плечом (в среднем ×${mAvg})`
    : mAvg > 10 ? `с умеренным плечом (в среднем ×${mAvg})`
    : `с невысоким плечом (в среднем ×${mAvg})`;
  const concDesc = conc > 60 ? `сильно сконцентрирован на <b>${topA}</b> (${conc}% сделок)` : `распределяешь сделки по ${nAss} инструментам`;
  const trend = wr >= lwr && net >= 0 ? "в целом улучшение" : net < 0 ? "скорее ухудшение" : "смешанная динамика";

  // "Greed & fear" flags — only surfaced when the condition is met.
  const gf: string[] = [];
  if (rr > 3) gf.push(`прибыль фиксируется рано, а убыткам даёшь течь — средний убыток в <b>${Math.round(rr)}×</b> больше среднего профита (классический перекос)`);
  if (revenge > 0) gf.push(`<b>${revenge}</b> сделок открыты вскоре после убытка — возможные эмоциональные отыгрыши`);
  if (mls >= 3) gf.push(`была серия из <b>${mls}</b> убытков подряд — момент, где важно не повышать ставки`);
  if (over > 0) gf.push(`<b>${over}</b> сделок с маржой заметно крупнее обычного`);

  const sections: ReviewSection[] = [
    {
      h: "1. Профиль стиля",
      html: `Ты преимущественно <b>${styleName}</b> — медиана удержания ${dMed} мин. Торгуешь ${levDesc}, ${concDesc}.`,
    },
    {
      h: `2. Параметры за ${n} сделок`,
      list: [
        `Всего сделок: <b>${n}</b>`,
        `Прибыльных: <b>${wins.length} из ${n}</b> (${wr}%)`,
        `Крупнейший профит: ${bestTrade.alias} (<b style="color:${C.pos}">${sgn(pnl(bestTrade))}</b>)`,
        `Крупнейший убыток: ${worstTrade.alias} (<b style="color:${C.neg}">${sgn(pnl(worstTrade))}</b>)`,
        `Средний профит / убыток: <b>${sgn(avgW)}</b> / <b>${sgn(avgL)}</b>`,
        `Средняя маржа × плечо: $${fmt(avgSum)} × ×${mAvg} ≈ объём <b>$${fk(avgNot)}</b>`,
        `Сделок со стоп-лоссом: <b>${slp}%</b>`,
        `Плечо: среднее ×${mAvg}, макс ×${mMax}`,
        `Длительность: медиана ${dMed} мин (${dMin}–${dMax})`,
      ],
    },
    {
      h: "3. Динамика",
      html: `Чистый результат — <b style="color:${net >= 0 ? C.pos : C.neg}">${sgn(net)}</b> (${pctNet >= 0 ? "+" : ""}${pctNet.toFixed(1)}% депозита). Win rate ${wr}% против ${lwr}% за всю историю. Лучший актив — <b>${bestA}</b> (${sgn(by[bestA])}), слабее всего — <b>${worstA}</b> (${sgn(by[worstA])}). Это ${trend}.`,
    },
    {
      h: "4. Риск-паттерны",
      html: `Главный усилитель риска — плечо: при среднем ×${mAvg} margin call наступает при движении всего ~<b>${mcDist.toFixed(1)}%</b> против тебя. Максимальная позиция занимала <b>${expoMax}% депозита</b> (ноционал до $${fk(notMax)}). Стоп-лосс стоял в <b>${slp}%</b> сделок${noSL > 0 ? ` — ${noSL} без защиты.` : "."}`,
    },
    {
      h: "5. Жадность и страх",
      html: gf.length
        ? `Пара вещей, которые мягко подмечу: ${gf.join("; ")}. Ничего страшного — просто чтобы ты это видел.`
        : "Явных эмоциональных всплесков не вижу — ни отыгрышей, ни резких раздуваний объёма. Ты держишь холодную голову 🕊 красиво.",
    },
    {
      h: "6. Прогресс и вывод",
      html:
        (slp < 50
          ? "Если и есть что подтянуть — это <b>дисциплина по стопам</b>, и, честно, одно это изменило бы многое. "
          : "Дисциплина по стопам у тебя на уровне — так держать. ") +
        (mAvg >= 100
          ? "А если чуть снизить плечо, у маржи будет больше воздуха на обычных колебаниях."
          : "Плечо в разумных пределах — это бережёт твой счёт."),
    },
  ];

  const scores: ReviewScore[] = [
    ["Консистентность", cons, `win rate ${wr}%, серия убытков ${mls}`],
    ["Дисциплина", disc, `стопы ${slp}%, плечо ×${mAvg}, маржа ${expoMax}%`],
    ["Рациональность", rat, `R:R 1:${rr > 50 ? "∞" : rr.toFixed(1)}, отыгрышей ${revenge}`],
  ];

  // "Habit #1" — the single most useful thing to fix next, chosen by priority.
  const habit = slp < 50
    ? "ставить стоп-лосс на каждую сделку (при высоком плече — обязательно)"
    : mAvg >= 100
      ? "снизить плечо — оно кратно усиливает риск слить маржу"
      : rr > 3
        ? "резать убытки быстрее и давать прибыли расти"
        : "держать размер и плечо в разумных пределах";

  return { list, sections, scores, habit };
}
