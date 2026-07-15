/*
 * RUSSIAN copy pack.
 * ==================
 * Voice: cold, factual, peer-to-peer. State the math and the pattern —
 * no consolation, no praise, no magnitude adjectives, no pep emoji.
 * Every string a translator or PM would tune lives here (and its EN twin
 * in en.ts). Logic never changes copy; copy never changes logic.
 */

import type { Copy } from "./contract";
import { plural } from "../format";

export const ru: Copy = {
  // ---- per-trade openers ----------------------------------------------
  lossOpeners: [
    "<b>{a}</b> закрыта в минус: <b>{v}</b>.",
    "Минус по <b>{a}</b>: <b>{v}</b>.",
    "<b>{a}</b> — убыток <b>{v}</b>.",
    "Позиция <b>{a}</b> закрыта в <b>{v}</b>.",
  ],
  winOpeners: [
    "<b>{a}</b> закрыта в плюс: <b>{v}</b>.",
    "Плюс по <b>{a}</b>: <b>{v}</b>.",
    "<b>{a}</b> — прибыль <b>{v}</b>.",
    "Позиция <b>{a}</b> закрыта в <b>{v}</b>.",
  ],

  // ---- per-trade card -------------------------------------------------
  cardTitleLoss: "Разбор сделки: минус",
  cardTitleWin: "Разбор сделки: плюс",
  cardTitleFlat: "Сделка в ноль",
  breakEvenHead: (a) => `Сделка по <b>${a}</b> закрылась в ноль.`,
  lossDeposit: (neg, pctS, balK) => ` Убыток — <b style="color:${neg}">−${pctS}%</b> депозита ($${balK}).`,
  gainDeposit: (pos, pctS, balK) => ` Прибыль — <b style="color:${pos}">${pctS}%</b> депозита ($${balK}).`,
  leverageAmp: (moveS, mult, colour, pinS, notionK) =>
    ` ⚙️ Цена прошла <b>${moveS}%</b>, плечо <b>×${mult}</b> превратило это в <b style="color:${colour}">${pinS}%</b> от вложенного (объём ~$${notionK}).`,
  timeLocale: "ru-RU",

  // ---- per-trade patterns ---------------------------------------------
  leverageBands: [
    (m, wp) => `низкое плечо <b>×${m}</b> — до margin call ~${wp}% против позиции.`,
    (m, wp) => `умеренное плечо <b>×${m}</b> — до margin call ~${wp}% движения против.`,
    (m, wp) => `высокое плечо <b>×${m}</b> — ~${wp}% против позиции уже её обнуляет.`,
    (m, wp) => `очень высокое плечо <b>×${m}</b> — ~${wp}% против почти обнуляет вложенное.`,
    (m, wp) => `экстремальное плечо <b>×${m}</b> — хватает <b>~${wp}%</b> против, чтобы стереть позицию.`,
  ],
  revengeNote: "Открыта <b>вскоре после убытка</b> — по времени это отыгрыш.",
  noStopOnLoss: "Без <b>стоп-лосса</b> — при таком плече убыток не был ничем ограничен.",
  noStop: "Без <b>стоп-лосса</b> — риск в сделке не был ограничен заранее.",
  concentration: (expoPct) => `В одной позиции — <b>${expoPct}% депозита</b>. Концентрация капитала под риском.`,
  oversizeMargin: (marginK, medianK) => `Маржа крупнее обычного: ~$${marginK} против медианы ~$${medianK}.`,
  longHold: (min) => `Позиция удерживалась <b>${min} мин</b> — дольше обычного, убыток тянулся.`,
  winStreak: (s) => `<b>${s} прибыльных подряд</b>. На серии растёт соблазн поднять плечо — это меняет риск.`,
  lossStreak: (s) => `<b>${s} убытков подряд</b>.`,
  sameInstrument: (a) => `Снова <b>${a}</b> — концентрация на одном инструменте.`,

  // ---- N-trade review -------------------------------------------------
  styleScalper: "скальпер",
  styleIntraday: "внутридневной трейдер",
  styleDaySwing: "дей/свинг-трейдер",
  styleSwing: "свинг-трейдер",
  levDesc: (m) =>
    m > 500 ? `с экстремальным плечом (в среднем ×${m})`
    : m > 150 ? `с очень высоким плечом (в среднем ×${m})`
    : m > 50 ? `с высоким плечом (в среднем ×${m})`
    : m > 10 ? `с умеренным плечом (в среднем ×${m})`
    : `с невысоким плечом (в среднем ×${m})`,
  concConcentrated: (a, pct) => `сконцентрирован на <b>${a}</b> (${pct}% сделок)`,
  concSpread: (n) => `распределяешь сделки по ${n} инструментам`,
  trendImprove: "улучшение",
  trendDecline: "ухудшение",
  trendMixed: "смешанная динамика",
  gfSkew: (r) => `средний убыток в <b>${r}×</b> больше среднего профита — прибыль режется рано, убыткам даёшь течь`,
  gfRevenge: (c) => `<b>${c}</b> сделок открыты вскоре после убытка — по времени отыгрыши`,
  gfLossStreak: (l) => `серия из <b>${l}</b> убытков подряд`,
  gfOversize: (c) => `<b>${c}</b> сделок с маржой заметно крупнее обычного`,

  sec1Head: "1. Профиль стиля",
  sec1Body: (style, med, lev, conc) =>
    `Преимущественно <b>${style}</b> — медиана удержания ${med} мин. Торгуешь ${lev}, ${conc}.`,
  sec2Head: (n) => `2. Параметры за ${n} сделок`,
  sec2Total: (n) => `Всего сделок: <b>${n}</b>`,
  sec2Winners: (w, n, wr) => `Прибыльных: <b>${w} из ${n}</b> (${wr}%)`,
  sec2Best: (a, pos, s) => `Крупнейший профит: ${a} (<b style="color:${pos}">${s}</b>)`,
  sec2Worst: (a, neg, s) => `Крупнейший убыток: ${a} (<b style="color:${neg}">${s}</b>)`,
  sec2AvgWL: (w, l) => `Средний профит / убыток: <b>${w}</b> / <b>${l}</b>`,
  sec2Size: (marginF, mAvg, notionK) => `Средняя маржа × плечо: $${marginF} × ×${mAvg} ≈ объём <b>$${notionK}</b>`,
  sec2Stops: (sl) => `Сделок со стоп-лоссом: <b>${sl}%</b>`,
  sec2Leverage: (avg, max) => `Плечо: среднее ×${avg}, макс ×${max}`,
  sec2Duration: (med, min, max) => `Длительность: медиана ${med} мин (${min}–${max})`,
  sec3Head: "3. Динамика",
  sec3Body: (nc, ns, pct, wr, hist, bestA, bestS, worstA, worstS, trend) =>
    `Чистый результат — <b style="color:${nc}">${ns}</b> (${pct}% депозита). Win rate ${wr}% против ${hist}% за всю историю. Лучший актив — <b>${bestA}</b> (${bestS}), слабее всего — <b>${worstA}</b> (${worstS}). Динамика: ${trend}.`,
  sec4Head: "4. Риск-паттерны",
  sec4Body: (mAvg, mcDist, expoMax, notionMaxK, sl, tail) =>
    `Главный усилитель риска — плечо: при среднем ×${mAvg} margin call наступает при движении ~<b>${mcDist}%</b> против тебя. Максимальная позиция — <b>${expoMax}% депозита</b> (ноционал до $${notionMaxK}). Стоп-лосс стоял в <b>${sl}%</b> сделок${tail}`,
  sec4NoSLTail: (noSL) => (noSL > 0 ? ` — ${noSL} без защиты.` : "."),
  sec5Head: "5. Эмоциональные паттерны",
  sec5WithFlags: (flags) => `Заметно по данным: ${flags}.`,
  sec5Clean: "Эмоциональных всплесков в этих сделках не видно: отыгрышей нет, объём не раздувается.",
  sec6Head: "6. Вывод",
  sec6StopLow: "Слабое место — <b>дисциплина по стопам</b>. ",
  sec6StopOk: "Дисциплина по стопам в норме. ",
  sec6LevHigh: "Плечо высокое — при снижении у маржи будет больше запаса на обычных колебаниях.",
  sec6LevOk: "Плечо в разумных пределах.",

  scoreConsistencyLabel: "Консистентность",
  scoreConsistencyNote: (wr, ls) => `win rate ${wr}%, серия убытков ${ls}`,
  scoreDisciplineLabel: "Дисциплина",
  scoreDisciplineNote: (sl, mAvg, expo) => `стопы ${sl}%, плечо ×${mAvg}, маржа ${expo}%`,
  scoreRationalLabel: "Рациональность",
  scoreRationalNote: (rr, rev) => `R:R 1:${rr}, отыгрышей ${rev}`,

  habitStop: "ставить стоп-лосс на каждую сделку (при высоком плече — обязательно)",
  habitLeverage: "снизить плечо — оно кратно усиливает риск слить маржу",
  habitCutLosses: "резать убытки быстрее и давать прибыли расти",
  habitSize: "держать размер и плечо в разумных пределах",

  // ---- UI chrome ------------------------------------------------------
  greeting: (every, tc, balK) =>
    `Я твой Trading Coach. После каждой сделки — короткий разбор по фактам, раз в ${every} сделок — полный обзор стиля, риска и привычек. Баланс ~$${balK}. <b style="color:${tc}">Сделай первую сделку.</b>`,
  openReviewBtn: (every) => `📊 Открыть полный AI-разбор ${every} сделок`,
  reviewCountdown: (left, tc, _rs) =>
    `ещё <b style="color:${tc}">${left}</b> ${plural(left)} до AI-разбора`,
  helpful: "Полезно?",
  thanksUp: "Спасибо за отзыв.",
  thanksDown: "Принято.",
  reviewSubtitle: (n) => `разбор последних ${n} сделок`,
  scoresHeading: (n) => `Оценки за ${n} сделок`,
  habitHeading: (n) => `Привычка №1 на следующие ${n}:`,
  reviewHelpfulQ: "Насколько полезен разбор?",
  reviewDisclaimer: "AI может ошибаться. Это разбор поведения и риск-профиля, не инвестиционный совет.",
  thanksRating: "Спасибо за оценку.",
  headerStatus: "live • демо-счёт",
  headerWatching: "слежу",
  newTrades: (n) => `новых сделок: ${n}`,

  // ---- entry-point toasts ---------------------------------------------
  reviewReadyToastPrefix: (every) => `🧠 AI Trading Review ${every} сделок готов • `,
  tradeToast: (signed, alias) => `Сделка ${signed} — ${alias}`,
};
