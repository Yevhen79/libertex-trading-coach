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

import type { Trade, ReviewData, ReviewSection, ReviewScore } from "./types";
import { C } from "./config";
import { pnl, isWin, isLoss, sum, fmt, sgn, fk, median } from "./format";
import { S, readBalance } from "./state";
import { t } from "./i18n";

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

  // ---- SCORES (1..10) — this is the part worth tuning ------------------
  //
  // DISCIPLINE: rewards using stops, punishes high leverage & big exposure.
  //   base = stop-usage% × 5 (100% stops ⇒ +5)
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
  const rat = Math.max(1, Math.min(10, Math.round(10 - Math.min(6, rr) - (revenge > 2 ? 2 : revenge > 0 ? 1 : 0) - (mAvg >= 200 ? 1 : 0))));

  // ---- verbal buckets ---------------------------------------------------
  const styleName = dMed < 3
    ? t("скальпер", "scalper")
    : dMed < 60
      ? t("внутридневной трейдер", "intraday trader")
      : dMed < 1440
        ? t("дей/свинг-трейдер", "day/swing trader")
        : t("свинг-трейдер", "swing trader");
  const levDesc =
    mAvg > 500 ? t(`с экстремальным плечом (в среднем ×${mAvg})`, `with extreme leverage (avg ×${mAvg})`)
    : mAvg > 150 ? t(`с очень высоким плечом (в среднем ×${mAvg})`, `with very high leverage (avg ×${mAvg})`)
    : mAvg > 50 ? t(`с высоким плечом (в среднем ×${mAvg})`, `with high leverage (avg ×${mAvg})`)
    : mAvg > 10 ? t(`с умеренным плечом (в среднем ×${mAvg})`, `with moderate leverage (avg ×${mAvg})`)
    : t(`с невысоким плечом (в среднем ×${mAvg})`, `with modest leverage (avg ×${mAvg})`);
  const concDesc = conc > 60
    ? t(`сильно сконцентрирован на <b>${topA}</b> (${conc}% сделок)`, `heavily concentrated in <b>${topA}</b> (${conc}% of trades)`)
    : t(`распределяешь сделки по ${nAss} инструментам`, `spread across ${nAss} instruments`);
  const trend = wr >= lwr && net >= 0
    ? t("в целом улучшение", "an overall improvement")
    : net < 0
      ? t("скорее ухудшение", "more of a decline")
      : t("смешанная динамика", "mixed dynamics");

  // "Greed & fear" flags — only surfaced when the condition is met.
  const gf: string[] = [];
  if (rr > 3) gf.push(t(`прибыль фиксируется рано, а убыткам даёшь течь — средний убыток в <b>${Math.round(rr)}×</b> больше среднего профита (классический перекос)`, `profits are booked early but losses run — the average loss is <b>${Math.round(rr)}×</b> the average win (a classic skew)`));
  if (revenge > 0) gf.push(t(`<b>${revenge}</b> сделок открыты вскоре после убытка — возможные эмоциональные отыгрыши`, `<b>${revenge}</b> trades opened soon after a loss — possible emotional revenge trades`));
  if (mls >= 3) gf.push(t(`была серия из <b>${mls}</b> убытков подряд — момент, где важно не повышать ставки`, `there was a streak of <b>${mls}</b> losses in a row — a moment where it matters not to raise stakes`));
  if (over > 0) gf.push(t(`<b>${over}</b> сделок с маржой заметно крупнее обычного`, `<b>${over}</b> trades with margin notably larger than usual`));

  const sections: ReviewSection[] = [
    {
      h: t("1. Профиль стиля", "1. Style profile"),
      html: t(`Ты преимущественно <b>${styleName}</b> — медиана удержания ${dMed} мин. Торгуешь ${levDesc}, ${concDesc}.`, `You're mostly a <b>${styleName}</b> — median hold ${dMed} min. You trade ${levDesc}, ${concDesc}.`),
    },
    {
      h: t(`2. Параметры за ${n} сделок`, `2. Parameters over ${n} trades`),
      list: [
        t(`Всего сделок: <b>${n}</b>`, `Total trades: <b>${n}</b>`),
        t(`Прибыльных: <b>${wins.length} из ${n}</b> (${wr}%)`, `Winners: <b>${wins.length} of ${n}</b> (${wr}%)`),
        t(`Крупнейший профит: ${bestTrade.alias} (<b style="color:${C.pos}">${sgn(pnl(bestTrade))}</b>)`, `Largest profit: ${bestTrade.alias} (<b style="color:${C.pos}">${sgn(pnl(bestTrade))}</b>)`),
        t(`Крупнейший убыток: ${worstTrade.alias} (<b style="color:${C.neg}">${sgn(pnl(worstTrade))}</b>)`, `Largest loss: ${worstTrade.alias} (<b style="color:${C.neg}">${sgn(pnl(worstTrade))}</b>)`),
        t(`Средний профит / убыток: <b>${sgn(avgW)}</b> / <b>${sgn(avgL)}</b>`, `Average profit / loss: <b>${sgn(avgW)}</b> / <b>${sgn(avgL)}</b>`),
        t(`Средняя маржа × плечо: $${fmt(avgSum)} × ×${mAvg} ≈ объём <b>$${fk(avgNot)}</b>`, `Average margin × leverage: $${fmt(avgSum)} × ×${mAvg} ≈ volume <b>$${fk(avgNot)}</b>`),
        t(`Сделок со стоп-лоссом: <b>${slp}%</b>`, `Trades with a stop-loss: <b>${slp}%</b>`),
        t(`Плечо: среднее ×${mAvg}, макс ×${mMax}`, `Leverage: avg ×${mAvg}, max ×${mMax}`),
        t(`Длительность: медиана ${dMed} мин (${dMin}–${dMax})`, `Duration: median ${dMed} min (${dMin}–${dMax})`),
      ],
    },
    {
      h: t("3. Динамика", "3. Dynamics"),
      html: t(`Чистый результат — <b style="color:${net >= 0 ? C.pos : C.neg}">${sgn(net)}</b> (${pctNet >= 0 ? "+" : ""}${pctNet.toFixed(1)}% депозита). Win rate ${wr}% против ${lwr}% за всю историю. Лучший актив — <b>${bestA}</b> (${sgn(by[bestA])}), слабее всего — <b>${worstA}</b> (${sgn(by[worstA])}). Это ${trend}.`, `Net result — <b style="color:${net >= 0 ? C.pos : C.neg}">${sgn(net)}</b> (${pctNet >= 0 ? "+" : ""}${pctNet.toFixed(1)}% of deposit). Win rate ${wr}% vs ${lwr}% over your whole history. Best asset — <b>${bestA}</b> (${sgn(by[bestA])}), weakest — <b>${worstA}</b> (${sgn(by[worstA])}). This is ${trend}.`),
    },
    {
      h: t("4. Риск-паттерны", "4. Risk patterns"),
      html: t(`Главный усилитель риска — плечо: при среднем ×${mAvg} margin call наступает при движении всего ~<b>${mcDist.toFixed(1)}%</b> против тебя. Максимальная позиция занимала <b>${expoMax}% депозита</b> (ноционал до $${fk(notMax)}). Стоп-лосс стоял в <b>${slp}%</b> сделок${noSL > 0 ? ` — ${noSL} без защиты.` : "."}`, `The main risk amplifier is leverage: at an average of ×${mAvg} a margin call hits after just ~<b>${mcDist.toFixed(1)}%</b> against you. The largest position took <b>${expoMax}% of the deposit</b> (notional up to $${fk(notMax)}). A stop-loss was set on <b>${slp}%</b> of trades${noSL > 0 ? ` — ${noSL} unprotected.` : "."}`),
    },
    {
      h: t("5. Жадность и страх", "5. Greed & fear"),
      html: gf.length
        ? t(`Пара вещей, которые мягко подмечу: ${gf.join("; ")}. Ничего страшного — просто чтобы ты это видел.`, `A couple of things worth noting: ${gf.join("; ")}. Nothing dramatic — just so you see it.`)
        : t("Явных эмоциональных всплесков не вижу — ни отыгрышей, ни резких раздуваний объёма. Ты держишь холодную голову 🕊 красиво.", "No obvious emotional spikes — no revenge trades, no sudden size inflation. You're keeping a cool head 🕊 nice."),
    },
    {
      h: t("6. Прогресс и вывод", "6. Progress & takeaway"),
      html:
        (slp < 50
          ? t("Если и есть что подтянуть — это <b>дисциплина по стопам</b>, и, честно, одно это изменило бы многое. ", "If there's one thing to work on, it's <b>stop-loss discipline</b> — and honestly, that alone would change a lot. ")
          : t("Дисциплина по стопам у тебя на уровне — так держать. ", "Your stop-loss discipline is at a good level — keep it up. ")) +
        (mAvg >= 100
          ? t("А если чуть снизить плечо, у маржи будет больше воздуха на обычных колебаниях.", "And easing off the leverage a little would give your margin more room on ordinary swings.")
          : t("Плечо в разумных пределах — это бережёт твой счёт.", "Your leverage is within reason — that protects your account.")),
    },
  ];

  const scores: ReviewScore[] = [
    [t("Консистентность", "Consistency"), cons, t(`win rate ${wr}%, серия убытков ${mls}`, `win rate ${wr}%, loss streak ${mls}`)],
    [t("Дисциплина", "Discipline"), disc, t(`стопы ${slp}%, плечо ×${mAvg}, маржа ${expoMax}%`, `stops ${slp}%, leverage ×${mAvg}, margin ${expoMax}%`)],
    [t("Рациональность", "Rational"), rat, t(`R:R 1:${rr > 50 ? "∞" : rr.toFixed(1)}, отыгрышей ${revenge}`, `R:R 1:${rr > 50 ? "∞" : rr.toFixed(1)}, revenge ${revenge}`)],
  ];

  // "Habit #1" — the single most useful thing to fix next, chosen by priority.
  const habit = slp < 50
    ? t("ставить стоп-лосс на каждую сделку (при высоком плече — обязательно)", "set a stop-loss on every trade (mandatory at high leverage)")
    : mAvg >= 100
      ? t("снизить плечо — оно кратно усиливает риск слить маржу", "lower your leverage — it multiplies the risk of losing your margin")
      : rr > 3
        ? t("резать убытки быстрее и давать прибыли расти", "cut losses faster and let profits run")
        : t("держать размер и плечо в разумных пределах", "keep size and leverage within reason");

  return { list, sections, scores, habit };
}
