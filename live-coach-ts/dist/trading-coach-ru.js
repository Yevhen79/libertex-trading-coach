"use strict";
(() => {
  // src/config.ts
  var API = "/spa/report/closed-positions?page=1&pageSize=100&order=CloseTime&orderDir=desc&searchPhrase=";
  var REVIEW_EVERY = 5;
  var POLL_MS = 15e3;
  var NAV = 80;
  var C = {
    bg: "#111111",
    sf: "#181818",
    rs: "#242526",
    br: "#FFA408",
    pos: "#53A642",
    neg: "#E64545",
    t: "#ffffff",
    t2: "#909294",
    line: "#2a2b2c",
    font: "Inter,Roboto,-apple-system,system-ui,Arial,sans-serif"
  };

  // src/format.ts
  var pnl = (t2) => Math.round((t2.equityInv - t2.sumInv) * 100) / 100;
  var isWin = (t2) => pnl(t2) > 0;
  var isLoss = (t2) => pnl(t2) < 0;
  var sum = (a) => a.reduce((s, v) => s + v, 0);
  var fmt = (n) => (Math.round(Math.abs(n) * 100) / 100).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
  var sgn = (n) => (n >= 0 ? "+" : "−") + "$" + fmt(n);
  var fk = (n) => n >= 1e3 ? (Math.round(n / 100) / 10).toLocaleString("ru-RU") + "k" : fmt(n);
  var median = (a) => {
    if (!a.length) return 0;
    const b = a.slice().sort((x, y) => x - y);
    return b[Math.floor(b.length / 2)];
  };
  var moveOf = (t2) => t2.direction === "growth" ? (t2.closeRate - t2.startRate) / t2.startRate * 100 : (t2.startRate - t2.closeRate) / t2.startRate * 100;
  var wipe = (m) => m ? 100 / m : 100;
  var capitalize = (s) => s.replace(/^./, (c) => c.toUpperCase());
  var plural = (n) => {
    const a = n % 100, b = n % 10;
    return a > 10 && a < 20 ? "сделок" : b === 1 ? "сделка" : b >= 2 && b <= 4 ? "сделки" : "сделок";
  };

  // src/state.ts
  var S = {
    seen: {},
    cards: [],
    idx: 0,
    newCount: 0,
    newTrades: [],
    baseAll: [],
    init: false,
    rot: {},
    bal: 2e4,
    medSum: 0,
    medDur: 0
  };
  function readBalance() {
    try {
      const el = document.querySelector(".spare-cash");
      if (el) {
        const n = parseFloat((el.textContent || "").replace(/[^0-9.]/g, ""));
        if (n > 0) S.bal = n;
      }
    } catch {
    }
    return S.bal;
  }
  function rotate(pool, key) {
    const i = (S.rot[key] || 0) % pool.length;
    S.rot[key] = (S.rot[key] || 0) + 1;
    return pool[i];
  }

  // src/i18n.ts
  var t = (ru, en) => true ? ru : en;

  // src/messages.ts
  var LOSS = t(
    [
      "Ну что ж, <b>{a}</b> закрылась в минус на <b>{v}</b> — бывает у всех.",
      "В этот раз не срослось: <b>{a}</b> ушла в <b>{v}</b>. Идём дальше. 🙂",
      "Минус по <b>{a}</b> — <b>{v}</b>. Это часть игры, извлечём урок.",
      "Не повезло — <b>{a}</b> закрылась в <b>{v}</b>. Не бери близко к сердцу.",
      "<b>{a}</b> ушла в красную зону: <b>{v}</b>. Главное — что дальше."
    ],
    [
      "Well, <b>{a}</b> closed at a loss of <b>{v}</b> — it happens to everyone.",
      "Not this time: <b>{a}</b> went to <b>{v}</b>. Moving on. 🙂",
      "A loss on <b>{a}</b> — <b>{v}</b>. Part of the game, let's learn from it.",
      "Unlucky — <b>{a}</b> closed at <b>{v}</b>. Don't take it to heart.",
      "<b>{a}</b> slipped into the red: <b>{v}</b>. What matters is what's next."
    ]
  );
  var WIN = t(
    [
      "Красиво — плюс по <b>{a}</b> на <b>{v}</b>! 👍",
      "Зелёная сделка: <b>{a}</b> закрыта в <b>{v}</b>. Молодец. 🙂",
      "Ты зафиксировал <b>{v}</b> по <b>{a}</b> — хорошая работа. ✅",
      "Вот так и надо — <b>{a}</b> в плюс на <b>{v}</b>.",
      "В плюс по <b>{a}</b>: <b>{v}</b>. Так держать!"
    ],
    [
      "Nice — a gain on <b>{a}</b> of <b>{v}</b>! 👍",
      "Green trade: <b>{a}</b> closed at <b>{v}</b>. Well done. 🙂",
      "You booked <b>{v}</b> on <b>{a}</b> — good work. ✅",
      "That's the way — <b>{a}</b> up by <b>{v}</b>.",
      "In the green on <b>{a}</b>: <b>{v}</b>. Keep it up!"
    ]
  );
  var magW = (p) => p < 0.5 ? t("почти незаметный", "barely noticeable") : p < 1.5 ? t("небольшой", "small") : p < 4 ? t("заметный", "noticeable") : p < 8 ? t("существенный", "significant") : t("крупный", "large");
  var magWW = (p) => p < 0.5 ? t("скромный", "modest") : p < 1.5 ? t("неплохой", "decent") : p < 4 ? t("хороший", "good") : p < 8 ? t("солидный", "solid") : t("крупный", "large");

  // src/detect.ts
  var REVENGE_WINDOW_MS = 20 * 6e4;
  var CONCENTRATION_PCT = 15;
  var OVERSIZE_FACTOR = 1.8;
  var LONG_HOLD_FACTOR = 3;
  var LONG_HOLD_FLOOR_MIN = 30;
  var STREAK_MIN = 3;
  var LEVERAGE_BANDS = [
    { max: 10, text: (m, wp) => t(`низкое плечо <b>×${m}</b> — комфортный запас, ~${wp}% против тебя до margin call 👍`, `low leverage <b>×${m}</b> — comfortable buffer, ~${wp}% against you to a margin call 👍`) },
    { max: 50, text: (m, wp) => t(`умеренное плечо <b>×${m}</b> — до margin call ~${wp}% движения против`, `moderate leverage <b>×${m}</b> — ~${wp}% adverse move to a margin call`) },
    { max: 150, text: (m, wp) => t(`высокое плечо <b>×${m}</b> — риск ощутимый: ~${wp}% против тебя уже съедает позицию`, `high leverage <b>×${m}</b> — real risk: ~${wp}% against you already eats the position`) },
    { max: 500, text: (m, wp) => t(`очень высокое плечо <b>×${m}</b> — на грани: ~${wp}% против почти обнуляет вложенное`, `very high leverage <b>×${m}</b> — on the edge: ~${wp}% against nearly wipes your stake`) },
    { max: Infinity, text: (m, wp) => t(`экстремальное плечо <b>×${m}</b> — хватает <b>~${wp}%</b> против, чтобы стереть позицию`, `extreme leverage <b>×${m}</b> — just <b>~${wp}%</b> against is enough to wipe the position`) }
  ];
  function detect(trade, all, list) {
    var _a;
    const out = [];
    const p = pnl(trade), bal = S.bal, m = trade.mult, wp = wipe(m);
    const lastLoss = all.filter((x) => x.closeTime <= trade.startTime && pnl(x) < 0).sort((a, b) => a.closeTime - b.closeTime).pop();
    if (lastLoss && trade.startTime - lastLoss.closeTime <= REVENGE_WINDOW_MS)
      out.push(t("Открыта <b>вскоре после убытка</b> — следи, чтобы это не был эмоциональный отыгрыш.", "Opened <b>shortly after a loss</b> — watch that this isn't an emotional revenge trade."));
    const wpS = wp >= 1 ? wp.toFixed(1) : wp.toFixed(2);
    out.push(((_a = LEVERAGE_BANDS.find((band) => m <= band.max)) != null ? _a : LEVERAGE_BANDS[LEVERAGE_BANDS.length - 1]).text(m, wpS));
    if (trade.stopLossPrice == null && p < 0)
      out.push(t("Без <b>стоп-лосса</b> — при таком плече убыток ничем не был ограничен.", "No <b>stop-loss</b> — at this leverage nothing capped the loss."));
    else if (trade.stopLossPrice == null)
      out.push(t("Без <b>стоп-лосса</b> — риск в сделке не был ограничен заранее.", "No <b>stop-loss</b> — the trade's risk wasn't capped in advance."));
    const expo = bal ? trade.sumInv / bal * 100 : 0;
    if (expo >= CONCENTRATION_PCT)
      out.push(t(`В одной позиции было <b>${expo.toFixed(0)}% депозита</b> — высокая концентрация капитала под риском.`, `This position held <b>${expo.toFixed(0)}% of the deposit</b> — high capital concentration at risk.`));
    if (S.medSum && trade.sumInv > S.medSum * OVERSIZE_FACTOR)
      out.push(t(`Маржа <b>крупнее обычного</b> (~$${fmt(trade.sumInv)} против медианы ~$${fmt(S.medSum)}).`, `Margin <b>larger than usual</b> (~$${fmt(trade.sumInv)} vs a median of ~$${fmt(S.medSum)}).`));
    const d = (trade.closeTime - trade.startTime) / 6e4;
    if (S.medDur && d > Math.max(S.medDur * LONG_HOLD_FACTOR, LONG_HOLD_FLOOR_MIN) && p < 0)
      out.push(t(`Позицию <b>держал долго</b> (${Math.round(d)} мин) — убыток тянулся дольше обычного.`, `Held <b>a long time</b> (${Math.round(d)} min) — the loss ran longer than usual.`));
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
    if (list.length >= 2 && list[list.length - 2].alias === trade.alias)
      out.push(t(`Снова <b>${trade.alias}</b> — заметна концентрация на одном инструменте.`, `Again <b>${trade.alias}</b> — you're concentrating on one instrument.`));
    return out;
  }

  // src/comment.ts
  var MOVE_LEVERAGE_MIN = 20;
  var MAX_PATTERNS = 2;
  function buildComment(trade, all, list) {
    const p = pnl(trade), bal = readBalance();
    const pct = bal ? Math.abs(p) / bal * 100 : 0;
    const move = moveOf(trade);
    const pin = trade.sumInv ? p / trade.sumInv * 100 : 0;
    const notion = trade.sumInv * trade.mult;
    const mood = p < 0 ? "😕" : p > 0 ? "✅" : "➖";
    const acc = p < 0 ? C.br : p > 0 ? C.pos : C.t2;
    const ti = p < 0 ? t("Разбор сделки: минус", "Trade review: loss") : p > 0 ? t("Разбор сделки: плюс", "Trade review: profit") : t("Сделка в ноль", "Break-even trade");
    const head = p === 0 ? t(`Сделка по <b>${trade.alias}</b> закрылась в ноль.`, `Your <b>${trade.alias}</b> trade closed at break-even.`) : rotate(p < 0 ? LOSS : WIN, p < 0 ? "l" : "w").replace("{a}", trade.alias).replace("{v}", sgn(p));
    const pctS = pct > 0 ? pct.toFixed(2) === "0.00" ? "0.01" : pct.toFixed(2) : "0.00";
    const balS = p < 0 ? t(` Это <b>${magW(pct)}</b> убыток — <b style="color:${C.neg}">−${pctS}%</b> депозита ($${fk(bal)}).`, ` A <b>${magW(pct)}</b> loss — <b style="color:${C.neg}">−${pctS}%</b> of your deposit ($${fk(bal)}).`) : p > 0 ? t(` ${capitalize(magWW(pct))} плюс — <b style="color:${C.pos}">${pctS}%</b> депозита ($${fk(bal)}).`, ` ${capitalize(magWW(pct))} gain — <b style="color:${C.pos}">${pctS}%</b> of your deposit ($${fk(bal)}).`) : "";
    const moveS = trade.mult >= MOVE_LEVERAGE_MIN ? t(` ⚙️ Цена прошла всего <b>${move >= 0 ? "+" : ""}${move.toFixed(2)}%</b>, но плечо <b>×${trade.mult}</b> превратило это в <b style="color:${p < 0 ? C.neg : C.pos}">${pin >= 0 ? "+" : ""}${pin.toFixed(1)}%</b> от вложенного (объём ~$${fk(notion)}).`, ` ⚙️ Price moved only <b>${move >= 0 ? "+" : ""}${move.toFixed(2)}%</b>, but <b>×${trade.mult}</b> leverage turned it into <b style="color:${p < 0 ? C.neg : C.pos}">${pin >= 0 ? "+" : ""}${pin.toFixed(1)}%</b> of your invested (volume ~$${fk(notion)}).`) : "";
    const patsArr = detect(trade, all, list).slice(0, MAX_PATTERNS);
    const nudge = p < 0 && trade.stopLossPrice == null ? rotate(
      t(
        [
          "Мягкий совет на будущее: при таком плече стоп-лосс — твой лучший друг, он бы аккуратно сгладил этот минус.",
          "Без давления — но SL в следующий раз тихо ограничит просадку. Стоит сделать привычкой."
        ],
        [
          "A gentle tip for next time: at this leverage a stop-loss is your best friend — it would have softened this dip.",
          "No pressure — but an SL next time quietly caps the drawdown. Worth making a habit."
        ]
      ),
      "nsl"
    ) : p > 0 && trade.stopLossPrice != null ? rotate(
      t(
        [
          "Плюс и со стопом — вот это по-чемпионски. 👏",
          "В плюс и под защитой стопа — красота, так держи."
        ],
        [
          "Profit and a stop in place — that's championship stuff. 👏",
          "In the green and protected by a stop — lovely, keep it up."
        ]
      ),
      "good"
    ) : "";
    const blocks = [`<div style="line-height:1.6">${head}${balS}</div>`];
    if (moveS)
      blocks.push(
        `<div style="margin-top:11px;padding-top:11px;border-top:1px solid ${C.line};line-height:1.55">${moveS.replace(/^\s+/, "")}</div>`
      );
    if (patsArr.length)
      blocks.push(
        `<div style="margin-top:11px;padding-top:11px;border-top:1px solid ${C.line}">` + patsArr.map(
          (x, i) => `<div style="display:flex;gap:8px;line-height:1.5${i ? ";margin-top:6px" : ""}"><span style="color:${C.br};font-weight:800">•</span><span>${x}</span></div>`
        ).join("") + `</div>`
      );
    if (nudge)
      blocks.push(
        `<div style="margin-top:11px;background:rgba(255,164,8,.09);border:1px solid rgba(255,164,8,.30);border-radius:10px;padding:9px 11px;line-height:1.5">💡 ${nudge}</div>`
      );
    return {
      m: mood,
      a: acc,
      ti,
      h: blocks.join(""),
      chip: trade.alias,
      time: new Date(trade.closeTime).toLocaleTimeString(t("ru-RU", "en-US"), { hour: "2-digit", minute: "2-digit" })
    };
  }

  // src/review.ts
  var REVENGE_WINDOW_MS2 = 20 * 6e4;
  function buildReview(list) {
    const bal = readBalance();
    const wins = list.filter(isWin), losses = list.filter(isLoss), n = list.length;
    const net = sum(list.map(pnl));
    const avgW = wins.length ? sum(wins.map(pnl)) / wins.length : 0;
    const avgL = losses.length ? sum(losses.map(pnl)) / losses.length : 0;
    const rr = avgW > 0 ? Math.abs(avgL) / avgW : 99;
    const bestTrade = list.slice().sort((a, b) => pnl(b) - pnl(a))[0];
    const worstTrade = list.slice().sort((a, b) => pnl(a) - pnl(b))[0];
    const slp = Math.round(100 * list.filter((tr) => tr.stopLossPrice != null).length / n);
    const noSL = list.filter((tr) => tr.stopLossPrice == null).length;
    const mults = list.map((tr) => tr.mult);
    const mAvg = Math.round(sum(mults) / n);
    const mMax = Math.max(...mults);
    const mcDist = 100 / median(mults);
    const durs = list.map((tr) => (tr.closeTime - tr.startTime) / 6e4);
    const dMed = Math.round(median(durs));
    const dMin = Math.round(Math.min(...durs));
    const dMax = Math.round(Math.max(...durs));
    const sums = list.map((tr) => tr.sumInv);
    const avgSum = sum(sums) / n;
    const avgNot = avgSum * mAvg;
    const expoMax = Math.round(100 * Math.max(...sums) / bal);
    const notMax = Math.max(...list.map((tr) => tr.sumInv * tr.mult));
    const over = list.filter((tr) => S.medSum && tr.sumInv > S.medSum * 1.8).length;
    const revenge = list.filter((tr) => {
      const ll = S.baseAll.concat(S.newTrades).filter((x) => x.closeTime <= tr.startTime && pnl(x) < 0).pop();
      return ll && tr.startTime - ll.closeTime <= REVENGE_WINDOW_MS2;
    }).length;
    let mls = 0, cw = 0, cl = 0;
    list.forEach((tr) => {
      const p = pnl(tr);
      if (p > 0) {
        cw++;
        cl = 0;
      } else if (p < 0) {
        cl++;
        cw = 0;
        mls = Math.max(mls, cl);
      } else {
        cw = 0;
        cl = 0;
      }
    });
    const by = {}, cnt = {};
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
    const topA = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    const conc = Math.round(100 * cnt[topA] / n);
    const nAss = Object.keys(cnt).length;
    const lb = S.baseAll;
    const lwr = lb.length ? Math.round(100 * lb.filter(isWin).length / lb.length) : 0;
    const wr = Math.round(100 * wins.length / n);
    const pctNet = bal ? net / bal * 100 : 0;
    const disc = Math.max(1, Math.min(10, Math.round(slp / 100 * 5 + (mAvg <= 10 ? 3 : mAvg <= 50 ? 1 : 0) + (expoMax < 20 ? 2 : 0))));
    const cons = Math.max(1, Math.min(10, Math.round(wr / 10 * 0.6 + (mls <= 2 ? 4 : mls <= 4 ? 2 : 0))));
    const rat = Math.max(1, Math.min(10, Math.round(10 - Math.min(6, rr) - (revenge > 2 ? 2 : revenge > 0 ? 1 : 0) - (mAvg >= 200 ? 1 : 0))));
    const styleName = dMed < 3 ? t("скальпер", "scalper") : dMed < 60 ? t("внутридневной трейдер", "intraday trader") : dMed < 1440 ? t("дей/свинг-трейдер", "day/swing trader") : t("свинг-трейдер", "swing trader");
    const levDesc = mAvg > 500 ? t(`с экстремальным плечом (в среднем ×${mAvg})`, `with extreme leverage (avg ×${mAvg})`) : mAvg > 150 ? t(`с очень высоким плечом (в среднем ×${mAvg})`, `with very high leverage (avg ×${mAvg})`) : mAvg > 50 ? t(`с высоким плечом (в среднем ×${mAvg})`, `with high leverage (avg ×${mAvg})`) : mAvg > 10 ? t(`с умеренным плечом (в среднем ×${mAvg})`, `with moderate leverage (avg ×${mAvg})`) : t(`с невысоким плечом (в среднем ×${mAvg})`, `with modest leverage (avg ×${mAvg})`);
    const concDesc = conc > 60 ? t(`сильно сконцентрирован на <b>${topA}</b> (${conc}% сделок)`, `heavily concentrated in <b>${topA}</b> (${conc}% of trades)`) : t(`распределяешь сделки по ${nAss} инструментам`, `spread across ${nAss} instruments`);
    const trend = wr >= lwr && net >= 0 ? t("в целом улучшение", "an overall improvement") : net < 0 ? t("скорее ухудшение", "more of a decline") : t("смешанная динамика", "mixed dynamics");
    const gf = [];
    if (rr > 3) gf.push(t(`прибыль фиксируется рано, а убыткам даёшь течь — средний убыток в <b>${Math.round(rr)}×</b> больше среднего профита (классический перекос)`, `profits are booked early but losses run — the average loss is <b>${Math.round(rr)}×</b> the average win (a classic skew)`));
    if (revenge > 0) gf.push(t(`<b>${revenge}</b> сделок открыты вскоре после убытка — возможные эмоциональные отыгрыши`, `<b>${revenge}</b> trades opened soon after a loss — possible emotional revenge trades`));
    if (mls >= 3) gf.push(t(`была серия из <b>${mls}</b> убытков подряд — момент, где важно не повышать ставки`, `there was a streak of <b>${mls}</b> losses in a row — a moment where it matters not to raise stakes`));
    if (over > 0) gf.push(t(`<b>${over}</b> сделок с маржой заметно крупнее обычного`, `<b>${over}</b> trades with margin notably larger than usual`));
    const sections = [
      {
        h: t("1. Профиль стиля", "1. Style profile"),
        html: t(`Ты преимущественно <b>${styleName}</b> — медиана удержания ${dMed} мин. Торгуешь ${levDesc}, ${concDesc}.`, `You're mostly a <b>${styleName}</b> — median hold ${dMed} min. You trade ${levDesc}, ${concDesc}.`)
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
          t(`Длительность: медиана ${dMed} мин (${dMin}–${dMax})`, `Duration: median ${dMed} min (${dMin}–${dMax})`)
        ]
      },
      {
        h: t("3. Динамика", "3. Dynamics"),
        html: t(`Чистый результат — <b style="color:${net >= 0 ? C.pos : C.neg}">${sgn(net)}</b> (${pctNet >= 0 ? "+" : ""}${pctNet.toFixed(1)}% депозита). Win rate ${wr}% против ${lwr}% за всю историю. Лучший актив — <b>${bestA}</b> (${sgn(by[bestA])}), слабее всего — <b>${worstA}</b> (${sgn(by[worstA])}). Это ${trend}.`, `Net result — <b style="color:${net >= 0 ? C.pos : C.neg}">${sgn(net)}</b> (${pctNet >= 0 ? "+" : ""}${pctNet.toFixed(1)}% of deposit). Win rate ${wr}% vs ${lwr}% over your whole history. Best asset — <b>${bestA}</b> (${sgn(by[bestA])}), weakest — <b>${worstA}</b> (${sgn(by[worstA])}). This is ${trend}.`)
      },
      {
        h: t("4. Риск-паттерны", "4. Risk patterns"),
        html: t(`Главный усилитель риска — плечо: при среднем ×${mAvg} margin call наступает при движении всего ~<b>${mcDist.toFixed(1)}%</b> против тебя. Максимальная позиция занимала <b>${expoMax}% депозита</b> (ноционал до $${fk(notMax)}). Стоп-лосс стоял в <b>${slp}%</b> сделок${noSL > 0 ? ` — ${noSL} без защиты.` : "."}`, `The main risk amplifier is leverage: at an average of ×${mAvg} a margin call hits after just ~<b>${mcDist.toFixed(1)}%</b> against you. The largest position took <b>${expoMax}% of the deposit</b> (notional up to $${fk(notMax)}). A stop-loss was set on <b>${slp}%</b> of trades${noSL > 0 ? ` — ${noSL} unprotected.` : "."}`)
      },
      {
        h: t("5. Жадность и страх", "5. Greed & fear"),
        html: gf.length ? t(`Пара вещей, которые мягко подмечу: ${gf.join("; ")}. Ничего страшного — просто чтобы ты это видел.`, `A couple of things worth noting: ${gf.join("; ")}. Nothing dramatic — just so you see it.`) : t("Явных эмоциональных всплесков не вижу — ни отыгрышей, ни резких раздуваний объёма. Ты держишь холодную голову 🕊 красиво.", "No obvious emotional spikes — no revenge trades, no sudden size inflation. You're keeping a cool head 🕊 nice.")
      },
      {
        h: t("6. Прогресс и вывод", "6. Progress & takeaway"),
        html: (slp < 50 ? t("Если и есть что подтянуть — это <b>дисциплина по стопам</b>, и, честно, одно это изменило бы многое. ", "If there's one thing to work on, it's <b>stop-loss discipline</b> — and honestly, that alone would change a lot. ") : t("Дисциплина по стопам у тебя на уровне — так держать. ", "Your stop-loss discipline is at a good level — keep it up. ")) + (mAvg >= 100 ? t("А если чуть снизить плечо, у маржи будет больше воздуха на обычных колебаниях.", "And easing off the leverage a little would give your margin more room on ordinary swings.") : t("Плечо в разумных пределах — это бережёт твой счёт.", "Your leverage is within reason — that protects your account."))
      }
    ];
    const scores = [
      [t("Консистентность", "Consistency"), cons, t(`win rate ${wr}%, серия убытков ${mls}`, `win rate ${wr}%, loss streak ${mls}`)],
      [t("Дисциплина", "Discipline"), disc, t(`стопы ${slp}%, плечо ×${mAvg}, маржа ${expoMax}%`, `stops ${slp}%, leverage ×${mAvg}, margin ${expoMax}%`)],
      [t("Рациональность", "Rational"), rat, t(`R:R 1:${rr > 50 ? "∞" : rr.toFixed(1)}, отыгрышей ${revenge}`, `R:R 1:${rr > 50 ? "∞" : rr.toFixed(1)}, revenge ${revenge}`)]
    ];
    const habit = slp < 50 ? t("ставить стоп-лосс на каждую сделку (при высоком плече — обязательно)", "set a stop-loss on every trade (mandatory at high leverage)") : mAvg >= 100 ? t("снизить плечо — оно кратно усиливает риск слить маржу", "lower your leverage — it multiplies the risk of losing your margin") : rr > 3 ? t("резать убытки быстрее и давать прибыли расти", "cut losses faster and let profits run") : t("держать размер и плечо в разумных пределах", "keep size and leverage within reason");
    return { list, sections, scores, habit };
  }

  // src/ui.ts
  var box;
  var pill;
  var elCard;
  var elCnt;
  var elPos;
  function expand() {
    box.style.display = "block";
    box.style.transform = "translateY(-30px) scale(.28)";
    box.style.opacity = "0";
    void box.offsetWidth;
    box.style.transform = "translateY(0) scale(1)";
    box.style.opacity = "1";
    pill.style.transform = "scale(.15)";
    pill.style.opacity = "0";
    setTimeout(() => {
      pill.style.display = "none";
      pill.style.transform = "";
      pill.style.opacity = "";
    }, 280);
  }
  function collapse() {
    pill.style.display = "flex";
    pill.style.transform = "scale(0)";
    pill.style.opacity = "0";
    void pill.offsetWidth;
    pill.style.transform = "scale(1)";
    pill.style.opacity = "1";
    box.style.transform = "translateY(-30px) scale(.28)";
    box.style.opacity = "0";
    setTimeout(() => {
      box.style.display = "none";
      box.style.transform = "";
      box.style.opacity = "";
    }, 340);
  }
  function render() {
    if (!S.cards.length) {
      elCard.innerHTML = `<div style="color:${C.t2};font-size:14px;line-height:1.55">${t(`Привет 👋 Я твой Trading Coach. После каждой сделки дам короткий честный разбор, а раз в ${REVIEW_EVERY} сделок — полный обзор твоего стиля, риска и привычек с оценками. Баланс ~$${fk(readBalance())}. <b style="color:${C.t}">Сделай первую сделку — и поехали.</b>`, `Hi 👋 I'm your Trading Coach. After every trade I'll give a short, honest read, and every ${REVIEW_EVERY} trades a full review of your style, risk and habits with scores. Balance ~$${fk(readBalance())}. <b style="color:${C.t}">Make your first trade and we're off.</b>`)}</div>`;
      elPos.textContent = "–";
      return;
    }
    if (S.idx < 0) S.idx = 0;
    if (S.idx > S.cards.length - 1) S.idx = S.cards.length - 1;
    const c = S.cards[S.idx];
    const foot = c.review ? `<button id="lbxRev" style="margin-top:14px;margin-left:10px;border:0;cursor:pointer;font:700 14px ${C.font};background:${C.br};color:#000;padding:12px 16px;border-radius:11px;width:calc(100% - 10px)">${t(`📊 Открыть подробный AI-разбор ${REVIEW_EVERY} сделок`, `📊 Open the full AI review of ${REVIEW_EVERY} trades`)}</button>` : c.left ? `<div style="margin-top:14px;margin-left:10px;display:flex;align-items:center;gap:10px"><div style="flex:1;height:6px;background:${C.rs};border-radius:4px;overflow:hidden"><i style="display:block;height:100%;width:${(REVIEW_EVERY - c.left) / REVIEW_EVERY * 100}%;background:${C.br}"></i></div><span style="font-size:12px;color:${C.t2};white-space:nowrap">${t(`ещё <b style="color:${C.t}">${c.left}</b> ${plural(c.left)} до AI-разбора`, `<b style="color:${C.t}">${c.left}</b> more trade${c.left === 1 ? "" : "s"} to your AI review`)}</span></div>` : "";
    const feedback = `<div style="margin-top:13px;margin-left:10px;padding-top:11px;border-top:1px solid ${C.line};display:flex;align-items:center;gap:9px"><span style="font-size:11px;color:${C.t2}">${t("Полезно?", "Helpful?")}</span><button id="lbxUp" style="border:1px solid ${c.vote === "up" ? C.pos : C.line};background:${c.vote === "up" ? "rgba(83,166,66,.15)" : C.sf};color:${C.t};cursor:pointer;font-size:15px;border-radius:8px;padding:4px 10px">👍</button><button id="lbxDn" style="border:1px solid ${c.vote === "down" ? C.neg : C.line};background:${c.vote === "down" ? "rgba(230,69,69,.15)" : C.sf};color:${C.t};cursor:pointer;font-size:15px;border-radius:8px;padding:4px 10px">👎</button></div>`;
    elCard.innerHTML = `<div style="display:flex;align-items:center;gap:9px;margin-bottom:10px"><span style="font-size:24px">${c.m}</span><span style="font:400 12px/16px ${C.font};color:${C.t2};background:${C.sf};border:1px solid ${C.line};padding:3px 7px;border-radius:4px">${c.chip}</span><span style="margin-left:auto;font-size:11px;color:${C.t2};font-family:monospace">${c.time}</span></div><div style="font-weight:700;font-size:16px;margin-bottom:8px;border-left:3px solid ${c.a};padding-left:10px;margin-left:-2px">${c.ti}</div><div style="font-size:14px;line-height:1.6;color:#cdd6e4;padding-left:10px">${c.h}</div>` + foot + feedback;
    elPos.textContent = `${S.idx + 1} / ${S.cards.length}`;
    const rv = box.querySelector("#lbxRev");
    if (rv) rv.onclick = () => {
      if (c.review) showReview(c.review);
    };
    const up = box.querySelector("#lbxUp");
    const dn = box.querySelector("#lbxDn");
    if (up) up.onclick = () => {
      c.vote = "up";
      render();
      toast(t("Спасибо за отзыв! 👍", "Thanks for the feedback! 👍"), C.pos);
    };
    if (dn) dn.onclick = () => {
      c.vote = "down";
      render();
      toast(t("Понял, спасибо 👎", "Got it, thanks 👎"), C.t2);
    };
  }
  function toast(txt, col) {
    const e = document.createElement("div");
    e.style.cssText = `position:fixed;left:8px;right:8px;top:10px;z-index:2147483001;background:${C.rs};border:1px solid ${col || C.br};color:#fff;padding:12px 16px;border-radius:14px;font:600 14px ${C.font};box-shadow:0 16px 40px -14px rgba(0,0,0,.7);text-align:center`;
    e.textContent = txt;
    document.body.appendChild(e);
    setTimeout(() => e.remove(), 3200);
  }
  function showReview(r) {
    const o = document.createElement("div");
    o.id = "lbxOverlay";
    o.style.cssText = `position:fixed;inset:0;z-index:2147483002;background:rgba(0,0,0,.65);display:flex;align-items:flex-end;font-family:${C.font}`;
    const secH = r.sections.map((s) => {
      const body = s.list ? `<ul style="margin:4px 0 0;padding-left:16px;color:#c4cede;font-size:13px;line-height:1.6">${s.list.map((x) => `<li style="margin-bottom:3px">${x}</li>`).join("")}</ul>` : `<div style="color:#c4cede;font-size:13.5px;line-height:1.6;margin-top:3px">${s.html}</div>`;
      return `<div style="padding:12px 0;border-bottom:1px solid #232323"><div style="font-weight:700;font-size:14.5px">${s.h}</div>${body}</div>`;
    }).join("");
    const scH = r.scores.map(
      (s) => `<div style="background:${C.sf};border:1px solid ${C.line};border-radius:12px;padding:11px"><div style="font-size:10px;color:${C.t2};text-transform:uppercase">${s[0]}</div><div style="font:700 22px monospace;margin:3px 0 6px">${s[1]}<span style="font-size:11px;color:${C.t2}">/10</span></div><div style="height:5px;background:${C.rs};border-radius:4px;overflow:hidden"><i style="display:block;height:100%;width:${s[1] * 10}%;background:${C.br}"></i></div><div style="font-size:9.5px;color:${C.t2};margin-top:6px;line-height:1.3">${s[2]}</div></div>`
    ).join("");
    const starsHtml = [0, 1, 2, 3, 4].map((i) => `<span data-i="${i}" style="cursor:pointer;color:${C.t2}">★</span>`).join("");
    o.innerHTML = `<div style="width:100%;max-height:92vh;overflow:auto;background:linear-gradient(180deg,#1b1b1b,#141414);border-top:1px solid rgba(255,164,8,.5);border-radius:20px 20px 0 0;color:${C.t}"><div style="width:40px;height:5px;border-radius:4px;background:${C.line};margin:9px auto 2px"></div><div style="display:flex;align-items:center;gap:10px;padding:12px 17px;border-bottom:1px solid ${C.line};position:sticky;top:0;background:#191919"><div style="width:30px;height:30px;border-radius:9px;background:${C.br};display:grid;place-items:center;color:#000;font-weight:800">⛨</div><div><b style="font-size:16px">AI Trading Review</b><div style="font-size:11px;color:${C.t2}">${t(`разбор последних ${r.list.length} сделок`, `review of your last ${r.list.length} trades`)}</div></div><span style="margin-left:auto;cursor:pointer;color:${C.t2};font-size:28px;line-height:1" id="lbxRvX">×</span></div><div style="padding:6px 18px 30px">${secH}<div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:${C.t2};margin:16px 0 8px">${t(`Оценки за ${r.list.length} сделок`, `Scores over ${r.list.length} trades`)}</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px">${scH}</div><div style="margin-top:16px;background:rgba(255,164,8,.10);border:1px solid rgba(255,164,8,.35);border-radius:12px;padding:13px;font-size:14px"><b style="color:${C.br}">${t(`Привычка №1 на следующие ${r.list.length}:`, `Habit #1 for the next ${r.list.length}:`)}</b> ${r.habit}.</div><div style="margin-top:16px;text-align:center"><div style="font-size:12px;color:${C.t2};margin-bottom:8px">${t("Насколько полезен разбор?", "How helpful was this review?")}</div><div id="lbxStars" style="display:flex;justify-content:center;gap:7px;font-size:27px">${starsHtml}</div><div id="lbxStarMsg" style="font-size:11px;color:${C.pos};margin-top:7px;height:14px"></div></div><div style="margin-top:14px;font-size:12px;color:${C.t2};font-style:italic">${t("AI может ошибаться. Разбор поведения и риск-профиля, не инвестиционный совет.", "AI can make mistakes. A review of behaviour and risk profile, not investment advice.")}</div></div></div>`;
    document.body.appendChild(o);
    o.querySelector("#lbxRvX").onclick = () => o.remove();
    o.onclick = (e) => {
      if (e.target === o) o.remove();
    };
    const stars = Array.from(o.querySelectorAll("#lbxStars span"));
    const starMsg = o.querySelector("#lbxStarMsg");
    const paint = (k) => stars.forEach((s, i) => s.style.color = i <= k ? C.br : C.t2);
    stars.forEach((star, i) => {
      star.onmouseenter = () => paint(i);
      star.onclick = () => {
        r.rating = i + 1;
        paint(i);
        starMsg.textContent = t("Спасибо за оценку! 🙏", "Thanks for rating! 🙏");
      };
    });
    o.querySelector("#lbxStars").onmouseleave = () => paint((r.rating || 0) - 1);
    if (r.rating) paint(r.rating - 1);
  }
  function updateCounter(n) {
    elCnt.textContent = t(`новых сделок: ${n}`, `new trades: ${n}`);
    const pip = pill.querySelector("#lbxPip");
    if (pip) pip.textContent = String(n);
  }
  function outsideClick(e) {
    if (box.style.display === "none") return;
    if (box.contains(e.target) || pill.contains(e.target)) return;
    if (document.getElementById("lbxOverlay")) return;
    collapse();
  }
  function mount() {
    box = document.createElement("div");
    box.style.cssText = `position:fixed;left:8px;right:8px;bottom:${NAV}px;z-index:2147483000;background:linear-gradient(180deg,#1b1b1b,#141414);border:1px solid rgba(255,164,8,.45);border-radius:18px;box-shadow:0 0 0 1px rgba(255,164,8,.18),0 18px 50px -14px rgba(0,0,0,.85);font-family:${C.font};color:${C.t};overflow:hidden`;
    box.innerHTML = `<div style="display:flex;align-items:center;gap:9px;padding:12px 13px;border-bottom:1px solid ${C.line};background:linear-gradient(180deg,rgba(255,164,8,.10),transparent)"><div style="width:30px;height:30px;border-radius:9px;background:${C.br};display:grid;place-items:center;font-weight:800;color:#000;font-size:16px">⛨</div><div style="font-weight:700;font-size:15px;line-height:1.1">Trading Coach<div style="font-weight:500;font-size:11px;color:${C.t2}">${t("live • демо-счёт", "live • demo account")}</div></div><div style="margin-left:auto;display:flex;align-items:center;gap:6px;font-size:11px;color:${C.t2}"><span style="width:8px;height:8px;border-radius:50%;background:${C.pos};box-shadow:0 0 0 4px rgba(83,166,66,.15)"></span>${t("слежу", "watching")}</div><button id="lbxMin" style="width:32px;height:32px;border:0;background:${C.rs};color:${C.t2};cursor:pointer;font-size:18px;border-radius:9px;margin-left:4px">–</button></div><div style="display:flex;align-items:center;justify-content:space-between;padding:9px 13px;border-bottom:1px solid ${C.line};color:${C.t2};font-size:12px"><span id="lbxCnt">${t(`новых сделок: ${S.newCount}`, `new trades: ${S.newCount}`)}</span><span style="display:flex;gap:8px;align-items:center"><button id="lbxPrev" style="width:32px;height:32px;border:1px solid ${C.line};background:${C.sf};color:${C.t};border-radius:8px;cursor:pointer;font-size:16px">‹</button><span id="lbxPos" style="min-width:46px;text-align:center;font-family:monospace">–</span><button id="lbxNext" style="width:32px;height:32px;border:1px solid ${C.line};background:${C.sf};color:${C.t};border-radius:8px;cursor:pointer;font-size:16px">›</button></span></div><div id="lbxCard" style="padding:15px 15px 17px;max-height:66vh;overflow:auto"></div>`;
    document.body.appendChild(box);
    pill = document.createElement("div");
    pill.style.cssText = `position:fixed;top:116px;right:8px;z-index:2147483000;display:none;align-items:center;gap:8px;padding:8px 12px;border-radius:40px;cursor:grab;background:linear-gradient(180deg,#2a2314,#1b1b1b);border:1.5px solid #FFA408;box-shadow:0 0 0 1px rgba(255,164,8,.30),0 6px 22px -4px rgba(255,164,8,.55),0 12px 34px -12px rgba(0,0,0,.75);font-family:${C.font};color:${C.t};touch-action:none;user-select:none;animation:lbxGlow 2.4s ease-in-out infinite`;
    pill.innerHTML = `<div style="width:26px;height:26px;border-radius:50%;background:${C.br};display:grid;place-items:center;color:#000;font-weight:800">⛨</div><b style="font-size:14px">Coach</b><span id="lbxPip" style="min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:${C.neg};color:#fff;font:700 12px ${C.font};display:inline-flex;align-items:center;justify-content:center;text-align:center;box-sizing:border-box">${S.newCount}</span>`;
    document.body.appendChild(pill);
    if (!document.getElementById("lbxGlowKf")) {
      const kf = document.createElement("style");
      kf.id = "lbxGlowKf";
      kf.textContent = "@keyframes lbxGlow{0%,100%{box-shadow:0 0 0 1px rgba(255,164,8,.30),0 6px 22px -4px rgba(255,164,8,.50),0 12px 34px -12px rgba(0,0,0,.75)}50%{box-shadow:0 0 0 1px rgba(255,164,8,.55),0 6px 26px -2px rgba(255,164,8,.85),0 12px 34px -12px rgba(0,0,0,.75)}}";
      document.head.appendChild(kf);
    }
    box.style.transition = "transform .34s cubic-bezier(.16,1,.3,1),opacity .26s ease";
    box.style.transformOrigin = "top right";
    pill.style.transition = "transform .36s cubic-bezier(.18,1.6,.35,1),opacity .24s ease";
    elCard = box.querySelector("#lbxCard");
    elCnt = box.querySelector("#lbxCnt");
    elPos = box.querySelector("#lbxPos");
    box.querySelector("#lbxPrev").onclick = () => {
      S.idx--;
      render();
    };
    box.querySelector("#lbxNext").onclick = () => {
      S.idx++;
      render();
    };
    box.querySelector("#lbxMin").onclick = () => collapse();
    let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0, moved = 0;
    pill.addEventListener("pointerdown", (e) => {
      dragging = true;
      moved = 0;
      const r = pill.getBoundingClientRect();
      sx = e.clientX;
      sy = e.clientY;
      ox = e.clientX - r.left;
      oy = e.clientY - r.top;
      pill.style.animation = "none";
      pill.style.cursor = "grabbing";
      try {
        pill.setPointerCapture(e.pointerId);
      } catch {
      }
      e.preventDefault();
    });
    pill.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      moved += Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy);
      sx = e.clientX;
      sy = e.clientY;
      const pw = pill.offsetWidth, ph = pill.offsetHeight;
      pill.style.left = Math.max(4, Math.min(innerWidth - pw - 4, e.clientX - ox)) + "px";
      pill.style.top = Math.max(4, Math.min(innerHeight - ph - 4, e.clientY - oy)) + "px";
      pill.style.right = "auto";
      pill.style.bottom = "auto";
      e.preventDefault();
    });
    const pointerUp = () => {
      if (!dragging) return;
      dragging = false;
      pill.style.cursor = "grab";
      pill.style.animation = "lbxGlow 2.4s ease-in-out infinite";
      if (moved < 7) expand();
    };
    pill.addEventListener("pointerup", pointerUp);
    pill.addEventListener("pointercancel", pointerUp);
    document.addEventListener("pointerdown", outsideClick, true);
  }
  function unmount() {
    try {
      document.removeEventListener("pointerdown", outsideClick, true);
      box.remove();
      pill.remove();
    } catch {
    }
  }

  // src/index.ts
  var w = window;
  var prev = w.__lbxCoach;
  try {
    if (w.__lbxCoachStop) w.__lbxCoachStop();
  } catch {
  }
  if (prev && prev.init) {
    S.seen = prev.seen || {};
    S.cards = prev.cards || [];
    S.idx = prev.idx || 0;
    S.newCount = prev.newCount || 0;
    S.newTrades = prev.newTrades || [];
    S.baseAll = prev.baseAll || [];
    S.medSum = prev.medSum || 0;
    S.medDur = prev.medDur || 0;
    S.rot = prev.rot || {};
    S.bal = prev.bal || 2e4;
    S.init = true;
  }
  w.__lbxCoach = S;
  mount();
  function processTrades(list) {
    const fresh = list.filter((tr) => !S.seen[tr.ticket]).sort((a, b) => a.closeTime - b.closeTime);
    if (!fresh.length) return;
    fresh.forEach((tr) => {
      S.seen[tr.ticket] = 1;
      S.newTrades.push(tr);
      S.newCount++;
      const all = S.baseAll.concat(S.newTrades);
      const card = buildComment(tr, all, S.newTrades);
      if (S.newCount % REVIEW_EVERY === 0) card.review = buildReview(S.newTrades.slice(-REVIEW_EVERY));
      else card.left = REVIEW_EVERY - S.newCount % REVIEW_EVERY;
      S.cards.push(card);
      S.idx = S.cards.length - 1;
    });
    updateCounter(S.newCount);
    render();
    const last = fresh[fresh.length - 1], lp = pnl(last);
    toast(
      (S.newCount % REVIEW_EVERY === 0 ? t(`🧠 Готов AI Trading Review ${REVIEW_EVERY} сделок! • `, `🧠 AI Trading Review of ${REVIEW_EVERY} trades is ready! • `) : "") + t(`Сделка ${sgn(lp)} — ${last.alias}`, `Trade ${sgn(lp)} — ${last.alias}`),
      lp >= 0 ? C.pos : C.neg
    );
  }
  function poll() {
    readBalance();
    fetch(API, { headers: { Accept: "application/json" }, credentials: "include" }).then((r) => r.json()).then((j) => {
      const list = j && j.result && j.result.closed || [];
      if (!S.init) {
        S.init = true;
        list.forEach((tr) => S.seen[tr.ticket] = 1);
        S.baseAll = list.slice();
        S.medSum = median(list.map((tr) => tr.sumInv));
        S.medDur = median(list.map((tr) => (tr.closeTime - tr.startTime) / 6e4));
        render();
      } else {
        processTrades(list);
      }
    }).catch(() => {
    });
  }
  render();
  poll();
  var iv = setInterval(poll, POLL_MS);
  w.__lbxCoachStop = () => {
    clearInterval(iv);
    unmount();
  };
  console.info(`[Trading Coach] v2.2 injected; carried ${S.newCount} trades`);
})();
