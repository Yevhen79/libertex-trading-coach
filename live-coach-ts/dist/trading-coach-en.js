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
  var pnl = (t) => Math.round((t.equityInv - t.sumInv) * 100) / 100;
  var isWin = (t) => pnl(t) > 0;
  var isLoss = (t) => pnl(t) < 0;
  var sum = (a) => a.reduce((s, v) => s + v, 0);
  var fmt = (n) => (Math.round(Math.abs(n) * 100) / 100).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
  var sgn = (n) => (n >= 0 ? "+" : "−") + "$" + fmt(n);
  var fk = (n) => n >= 1e3 ? (Math.round(n / 100) / 10).toLocaleString("ru-RU") + "k" : fmt(n);
  var median = (a) => {
    if (!a.length) return 0;
    const b = a.slice().sort((x, y) => x - y);
    return b[Math.floor(b.length / 2)];
  };
  var moveOf = (t) => t.direction === "growth" ? (t.closeRate - t.startRate) / t.startRate * 100 : (t.startRate - t.closeRate) / t.startRate * 100;
  var wipe = (m) => m ? 100 / m : 100;
  var POST_LOSS_MS = 5 * 6e4;
  var madPct = (a) => {
    if (a.length < 2) return 0;
    const m = median(a);
    if (m <= 0) return 0;
    return a.reduce((s, v) => s + Math.abs(v - m), 0) / a.length / m * 100;
  };
  var restGaps = (trades) => {
    const b = trades.slice().sort((x, y) => x.startTime - y.startTime);
    const gaps = [];
    for (let i = 1; i < b.length; i++) gaps.push(Math.max(0, (b[i].startTime - b[i - 1].closeTime) / 6e4));
    return gaps;
  };
  var postLossTrades = (windowTrades, all) => windowTrades.filter(
    (tr) => all.some((x) => x.ticket !== tr.ticket && pnl(x) < 0 && x.closeTime <= tr.startTime && tr.startTime - x.closeTime <= POST_LOSS_MS)
  );

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
    medDur: 0,
    reviewReady: false
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

  // src/locales/en.ts
  var en = {
    // ---- per-trade openers ----------------------------------------------
    lossOpeners: [
      "<b>{a}</b> closed at a loss: <b>{v}</b>.",
      "Loss on <b>{a}</b>: <b>{v}</b>.",
      "<b>{a}</b> — loss of <b>{v}</b>.",
      "Position <b>{a}</b> closed at <b>{v}</b>."
    ],
    winOpeners: [
      "<b>{a}</b> closed in profit: <b>{v}</b>.",
      "Profit on <b>{a}</b>: <b>{v}</b>.",
      "<b>{a}</b> — profit <b>{v}</b>.",
      "Position <b>{a}</b> closed at <b>{v}</b>."
    ],
    // ---- per-trade card -------------------------------------------------
    cardTitleLoss: "Trade review: loss",
    cardTitleWin: "Trade review: profit",
    cardTitleFlat: "Break-even trade",
    breakEvenHead: (a) => `Your <b>${a}</b> trade closed at break-even.`,
    lossDeposit: (neg, pctS, balK) => ` Loss — <b style="color:${neg}">−${pctS}%</b> of deposit ($${balK}).`,
    gainDeposit: (pos, pctS, balK) => ` Profit — <b style="color:${pos}">${pctS}%</b> of deposit ($${balK}).`,
    leverageAmp: (moveS, mult, colour, pinS, notionK) => ` ⚙️ Price moved <b>${moveS}%</b>; <b>×${mult}</b> leverage turned it into <b style="color:${colour}">${pinS}%</b> of your margin (volume ~$${notionK}).`,
    timeLocale: "en-US",
    // ---- per-trade patterns ---------------------------------------------
    leverageBands: [
      (m, wp) => `low leverage <b>×${m}</b> — ~${wp}% against the position to a margin call.`,
      (m, wp) => `moderate leverage <b>×${m}</b> — ~${wp}% adverse move to a margin call.`,
      (m, wp) => `high leverage <b>×${m}</b> — ~${wp}% against the position already wipes it.`,
      (m, wp) => `very high leverage <b>×${m}</b> — ~${wp}% against nearly wipes your stake.`,
      (m, wp) => `extreme leverage <b>×${m}</b> — just <b>~${wp}%</b> against is enough to wipe the position.`
    ],
    revengeNote: "Opened <b>shortly after a loss</b> — by timing, this is a revenge trade.",
    noStopOnLoss: "No <b>stop-loss</b> — at this leverage nothing capped the loss.",
    noStop: "No <b>stop-loss</b> — the trade's risk wasn't capped in advance.",
    concentration: (expoPct) => `One position held <b>${expoPct}% of the deposit</b>. Capital concentration at risk.`,
    oversizeMargin: (marginK, medianK) => `Margin larger than usual: ~$${marginK} vs a median of ~$${medianK}.`,
    longHold: (min) => `Position held <b>${min} min</b> — longer than usual, the loss ran on.`,
    winStreak: (s) => `<b>${s} wins in a row</b>. Streaks tempt higher leverage — that changes your risk.`,
    lossStreak: (s) => `<b>${s} losses in a row</b>.`,
    sameInstrument: (a) => `<b>${a}</b> again — concentration on one instrument.`,
    // ---- N-trade review -------------------------------------------------
    styleScalper: "scalper",
    styleIntraday: "intraday trader",
    styleDaySwing: "day/swing trader",
    styleSwing: "swing trader",
    levDesc: (m) => m > 500 ? `with extreme leverage (avg ×${m})` : m > 150 ? `with very high leverage (avg ×${m})` : m > 50 ? `with high leverage (avg ×${m})` : m > 10 ? `with moderate leverage (avg ×${m})` : `with modest leverage (avg ×${m})`,
    concConcentrated: (a, pct) => `concentrated in <b>${a}</b> (${pct}% of trades)`,
    concSpread: (n) => `spread across ${n} instruments`,
    trendImprove: "improving",
    trendDecline: "declining",
    trendMixed: "mixed dynamics",
    gfSkew: (r) => `average loss is <b>${r}×</b> the average win — profits cut early, losses left to run`,
    gfRevenge: (c) => `<b>${c}</b> trades opened soon after a loss — revenge trades by timing`,
    gfLossStreak: (l) => `a streak of <b>${l}</b> losses in a row`,
    gfOversize: (c) => `<b>${c}</b> trades with margin notably larger than usual`,
    sec1Head: "1. Style profile",
    sec1Body: (style, med, lev, conc) => `Mostly a <b>${style}</b> — median hold ${med} min. You trade ${lev}, ${conc}.`,
    sec2Head: (n) => `2. Parameters over ${n} trades`,
    sec2Total: (n) => `Total trades: <b>${n}</b>`,
    sec2Winners: (w2, n, wr) => `Winners: <b>${w2} of ${n}</b> (${wr}%)`,
    sec2Best: (a, pos, s) => `Largest profit: ${a} (<b style="color:${pos}">${s}</b>)`,
    sec2Worst: (a, neg, s) => `Largest loss: ${a} (<b style="color:${neg}">${s}</b>)`,
    sec2AvgWL: (w2, l) => `Average profit / loss: <b>${w2}</b> / <b>${l}</b>`,
    sec2Size: (marginF, mAvg, notionK) => `Average margin × leverage: $${marginF} × ×${mAvg} ≈ volume <b>$${notionK}</b>`,
    sec2Stops: (sl) => `Trades with a stop-loss: <b>${sl}%</b>`,
    sec2Leverage: (avg, max) => `Leverage: avg ×${avg}, max ×${max}`,
    sec2Duration: (med, min, max) => `Duration: median ${med} min (${min}–${max})`,
    sec3Head: "3. Dynamics",
    sec3Body: (nc, ns, pct, wr, hist, bestA, bestS, worstA, worstS, trend) => `Net result — <b style="color:${nc}">${ns}</b> (${pct}% of deposit). Win rate ${wr}% vs ${hist}% over your whole history. Best asset — <b>${bestA}</b> (${bestS}), weakest — <b>${worstA}</b> (${worstS}). Dynamics: ${trend}.`,
    sec4Head: "4. Risk patterns",
    sec4Body: (mAvg, mcDist, expoMax, notionMaxK, sl, tail) => `The main risk amplifier is leverage: at an average of ×${mAvg} a margin call hits after ~<b>${mcDist}%</b> against you. The largest position was <b>${expoMax}% of the deposit</b> (notional up to $${notionMaxK}). A stop-loss was set on <b>${sl}%</b> of trades${tail}`,
    sec4NoSLTail: (noSL) => noSL > 0 ? ` — ${noSL} unprotected.` : ".",
    sec5Head: "5. Emotional patterns",
    sec5WithFlags: (flags) => `Visible in the data: ${flags}.`,
    sec5Clean: "No emotional spikes in these trades: no revenge trades, no size inflation.",
    sec6Head: "6. Takeaway",
    sec6StopLow: "Weak spot — <b>stop-loss discipline</b>. ",
    sec6StopOk: "Stop-loss discipline is fine. ",
    sec6LevHigh: "Leverage is high — easing it would give your margin more room on ordinary swings.",
    sec6LevOk: "Leverage is within reason.",
    metricCooldownLabel: "Cooldown between trades",
    metricCooldownValue: (min) => `${min} min`,
    metricCooldownNote: "median rest",
    metricSizeLabel: "Size variance",
    metricSizeValue: (m) => `±${m}%`,
    metricSizeNote: (mult) => `margin; leverage ±${mult}%`,
    metricPostLossLabel: "Post-loss win rate",
    metricPostLossValue: (wr) => wr == null ? "—" : `${wr}%`,
    metricPostLossNote: (c) => c > 0 ? `of ${c} trade${c === 1 ? "" : "s"}` : "no such trades",
    habitStop: "set a stop-loss on every trade (mandatory at high leverage)",
    habitLeverage: "lower your leverage — it multiplies the risk of losing your margin",
    habitCutLosses: "cut losses faster and let profits run",
    habitSize: "keep size and leverage within reason",
    // ---- UI chrome ------------------------------------------------------
    greeting: (every, tc, balK) => `I'm your Trading Coach. After every trade — a short factual read; every ${every} trades — a full review of style, risk and habits. Balance ~$${balK}. <b style="color:${tc}">Make your first trade.</b>`,
    openReviewBtn: (every) => `📊 Open the full AI review of ${every} trades`,
    ringLearning: "profile: learning",
    ringReady: "review ready",
    helpful: "Helpful?",
    thanksUp: "Thanks for the feedback.",
    thanksDown: "Noted.",
    reviewSubtitle: (n) => `review of your last ${n} trades`,
    metricsHeading: (n) => `Metrics over ${n} trades`,
    habitHeading: (n) => `Habit #1 for the next ${n}:`,
    reviewHelpfulQ: "How helpful was this review?",
    reviewDisclaimer: "AI can make mistakes. A review of behaviour and risk profile, not investment advice.",
    thanksRating: "Thanks for rating.",
    headerStatus: "live • demo account",
    headerWatching: "watching",
    // ---- revenge-trade warning banner -----------------------------------
    revengeTitle: "Looks like a revenge trade",
    revengeLev: (cur, prev2) => `higher leverage (×${cur} vs ×${prev2})`,
    revengeMargin: (curK, prevK) => `bigger margin ($${curK} vs $${prevK})`,
    revengeAnd: " and ",
    revengeBody: (min, risk) => `Your previous trade closed at a loss ${min} min ago. This one opened with ${risk}. By timing and risk, this is a revenge trade.`,
    revengeWinRate: (wr) => `Historically only ${wr}% of your post-loss trades closed in profit.`,
    revengeGotIt: "Got it",
    // ---- entry-point toasts ---------------------------------------------
    reviewReadyToastPrefix: (every) => `🧠 AI Trading Review of ${every} trades is ready • `,
    tradeToast: (signed, alias) => `Trade ${signed} — ${alias}`
  };

  // src/i18n.ts
  var L = false ? ru : en;

  // src/detect.ts
  var REVENGE_WINDOW_MS = 20 * 6e4;
  var CONCENTRATION_PCT = 15;
  var OVERSIZE_FACTOR = 1.8;
  var LONG_HOLD_FACTOR = 3;
  var LONG_HOLD_FLOOR_MIN = 30;
  var STREAK_MIN = 3;
  var REVENGE_RECENT_MS = 5 * 6e4;
  function detectRevenge(trade, all) {
    const prevLoss = all.filter((x) => x.ticket !== trade.ticket && pnl(x) < 0 && x.closeTime <= trade.startTime).sort((a, b) => a.closeTime - b.closeTime).pop();
    if (!prevLoss) return null;
    const gap = trade.startTime - prevLoss.closeTime;
    if (gap > REVENGE_RECENT_MS) return null;
    const higherLev = trade.mult > prevLoss.mult;
    const biggerMargin = trade.sumInv > prevLoss.sumInv;
    if (!higherLev && !biggerMargin) return null;
    return { prevLoss, minutesAfter: Math.max(0, Math.round(gap / 6e4)), higherLev, biggerMargin };
  }
  var LEVERAGE_BAND_MAX = [10, 50, 150, 500, Infinity];
  function detect(trade, all, list) {
    const out = [];
    const p = pnl(trade), bal = S.bal, m = trade.mult, wp = wipe(m);
    const lastLoss = all.filter((x) => x.closeTime <= trade.startTime && pnl(x) < 0).sort((a, b) => a.closeTime - b.closeTime).pop();
    if (lastLoss && trade.startTime - lastLoss.closeTime <= REVENGE_WINDOW_MS)
      out.push(L.revengeNote);
    const wpS = wp >= 1 ? wp.toFixed(1) : wp.toFixed(2);
    const bandIdx = LEVERAGE_BAND_MAX.findIndex((max) => m <= max);
    out.push(L.leverageBands[bandIdx < 0 ? L.leverageBands.length - 1 : bandIdx](m, wpS));
    if (trade.stopLossPrice == null && p < 0) out.push(L.noStopOnLoss);
    else if (trade.stopLossPrice == null) out.push(L.noStop);
    const expo = bal ? trade.sumInv / bal * 100 : 0;
    if (expo >= CONCENTRATION_PCT) out.push(L.concentration(expo.toFixed(0)));
    if (S.medSum && trade.sumInv > S.medSum * OVERSIZE_FACTOR)
      out.push(L.oversizeMargin(fmt(trade.sumInv), fmt(S.medSum)));
    const d = (trade.closeTime - trade.startTime) / 6e4;
    if (S.medDur && d > Math.max(S.medDur * LONG_HOLD_FACTOR, LONG_HOLD_FLOOR_MIN) && p < 0)
      out.push(L.longHold(Math.round(d)));
    let streak = 1;
    for (let i = list.length - 2; i >= 0; i--) {
      const q = pnl(list[i]);
      if (q !== 0 && p !== 0 && q > 0 === p > 0) streak++;
      else break;
    }
    if (p > 0 && streak >= STREAK_MIN) out.push(L.winStreak(streak));
    if (p < 0 && streak >= STREAK_MIN) out.push(L.lossStreak(streak));
    if (list.length >= 2 && list[list.length - 2].alias === trade.alias)
      out.push(L.sameInstrument(trade.alias));
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
    const ti = p < 0 ? L.cardTitleLoss : p > 0 ? L.cardTitleWin : L.cardTitleFlat;
    const head = p === 0 ? L.breakEvenHead(trade.alias) : rotate(p < 0 ? L.lossOpeners : L.winOpeners, p < 0 ? "l" : "w").replace("{a}", trade.alias).replace("{v}", sgn(p));
    const pctS = pct > 0 ? pct.toFixed(2) === "0.00" ? "0.01" : pct.toFixed(2) : "0.00";
    const balS = p < 0 ? L.lossDeposit(C.neg, pctS, fk(bal)) : p > 0 ? L.gainDeposit(C.pos, pctS, fk(bal)) : "";
    const moveS = trade.mult >= MOVE_LEVERAGE_MIN ? L.leverageAmp(
      `${move >= 0 ? "+" : ""}${move.toFixed(2)}`,
      trade.mult,
      p < 0 ? C.neg : C.pos,
      `${pin >= 0 ? "+" : ""}${pin.toFixed(1)}`,
      fk(notion)
    ) : "";
    const patsArr = detect(trade, all, list).slice(0, MAX_PATTERNS);
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
    return {
      m: mood,
      a: acc,
      ti,
      h: blocks.join(""),
      chip: trade.alias,
      time: new Date(trade.closeTime).toLocaleTimeString(L.timeLocale, { hour: "2-digit", minute: "2-digit" })
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
    const coolMed = Math.round(median(restGaps(list)));
    const marginVar = Math.round(madPct(sums));
    const multVar = Math.round(madPct(mults));
    const plTrades = postLossTrades(list, S.baseAll.concat(S.newTrades));
    const plWR = plTrades.length ? Math.round(100 * plTrades.filter(isWin).length / plTrades.length) : null;
    const styleName = dMed < 3 ? L.styleScalper : dMed < 60 ? L.styleIntraday : dMed < 1440 ? L.styleDaySwing : L.styleSwing;
    const levDesc = L.levDesc(mAvg);
    const concDesc = conc > 60 ? L.concConcentrated(topA, conc) : L.concSpread(nAss);
    const trend = wr >= lwr && net >= 0 ? L.trendImprove : net < 0 ? L.trendDecline : L.trendMixed;
    const gf = [];
    if (rr > 3) gf.push(L.gfSkew(Math.round(rr)));
    if (revenge > 0) gf.push(L.gfRevenge(revenge));
    if (mls >= 3) gf.push(L.gfLossStreak(mls));
    if (over > 0) gf.push(L.gfOversize(over));
    const netColour = net >= 0 ? C.pos : C.neg;
    const pctNetS = `${pctNet >= 0 ? "+" : ""}${pctNet.toFixed(1)}`;
    const sections = [
      {
        h: L.sec1Head,
        html: L.sec1Body(styleName, dMed, levDesc, concDesc)
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
          L.sec2Duration(dMed, dMin, dMax)
        ]
      },
      {
        h: L.sec3Head,
        html: L.sec3Body(netColour, sgn(net), pctNetS, wr, lwr, bestA, sgn(by[bestA]), worstA, sgn(by[worstA]), trend)
      },
      {
        h: L.sec4Head,
        html: L.sec4Body(mAvg, mcDist.toFixed(1), expoMax, fk(notMax), slp, L.sec4NoSLTail(noSL))
      },
      {
        h: L.sec5Head,
        html: gf.length ? L.sec5WithFlags(gf.join("; ")) : L.sec5Clean
      },
      {
        h: L.sec6Head,
        html: (slp < 50 ? L.sec6StopLow : L.sec6StopOk) + (mAvg >= 100 ? L.sec6LevHigh : L.sec6LevOk)
      }
    ];
    const metrics = [
      { label: L.metricCooldownLabel, value: L.metricCooldownValue(coolMed), note: L.metricCooldownNote },
      { label: L.metricSizeLabel, value: L.metricSizeValue(marginVar), note: L.metricSizeNote(multVar) },
      { label: L.metricPostLossLabel, value: L.metricPostLossValue(plWR), note: L.metricPostLossNote(plTrades.length) }
    ];
    const habit = slp < 50 ? L.habitStop : mAvg >= 100 ? L.habitLeverage : rr > 3 ? L.habitCutLosses : L.habitSize;
    return { list, sections, metrics, habit };
  }

  // src/ui.ts
  var box;
  var pill;
  var elCard;
  var elState;
  var elRingPill;
  var elPos;
  function ringSvg(frac, size, ready) {
    const r = 15.9155;
    const pct = Math.max(0, Math.min(100, frac * 100));
    return `<svg width="${size}" height="${size}" viewBox="0 0 36 36" style="display:block"><circle cx="18" cy="18" r="${r}" fill="none" stroke="${C.rs}" stroke-width="4"/><circle cx="18" cy="18" r="${r}" fill="none" stroke="${C.br}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${pct} 100" transform="rotate(-90 18 18)"${ready ? ` style="filter:drop-shadow(0 0 3px ${C.br})"` : ""}/></svg>`;
  }
  function paintRings() {
    const ready = S.reviewReady;
    const frac = ready ? 1 : S.newCount % REVIEW_EVERY / REVIEW_EVERY;
    if (elRingPill) elRingPill.innerHTML = ringSvg(frac, 22, ready);
    if (elState)
      elState.innerHTML = `<span style="display:inline-flex">${ringSvg(frac, 16, ready)}</span><span style="color:${ready ? C.br : C.t2}">${ready ? L.ringReady : L.ringLearning}</span>`;
  }
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
      elCard.innerHTML = `<div style="color:${C.t2};font-size:14px;line-height:1.55">${L.greeting(REVIEW_EVERY, C.t, fk(readBalance()))}</div>`;
      elPos.textContent = "–";
      return;
    }
    if (S.idx < 0) S.idx = 0;
    if (S.idx > S.cards.length - 1) S.idx = S.cards.length - 1;
    const c = S.cards[S.idx];
    const foot = c.review ? `<button id="lbxRev" style="margin-top:14px;margin-left:10px;border:0;cursor:pointer;font:700 14px ${C.font};background:${C.br};color:#000;padding:12px 16px;border-radius:11px;width:calc(100% - 10px)">${L.openReviewBtn(REVIEW_EVERY)}</button>` : "";
    const feedback = `<div style="margin-top:13px;margin-left:10px;padding-top:11px;border-top:1px solid ${C.line};display:flex;align-items:center;gap:9px"><span style="font-size:11px;color:${C.t2}">${L.helpful}</span><button id="lbxUp" style="border:1px solid ${c.vote === "up" ? C.pos : C.line};background:${c.vote === "up" ? "rgba(83,166,66,.15)" : C.sf};color:${C.t};cursor:pointer;font-size:15px;border-radius:8px;padding:4px 10px">👍</button><button id="lbxDn" style="border:1px solid ${c.vote === "down" ? C.neg : C.line};background:${c.vote === "down" ? "rgba(230,69,69,.15)" : C.sf};color:${C.t};cursor:pointer;font-size:15px;border-radius:8px;padding:4px 10px">👎</button></div>`;
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
      toast(L.thanksUp, C.pos);
    };
    if (dn) dn.onclick = () => {
      c.vote = "down";
      render();
      toast(L.thanksDown, C.t2);
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
    S.reviewReady = false;
    paintRings();
    const o = document.createElement("div");
    o.id = "lbxOverlay";
    o.style.cssText = `position:fixed;inset:0;z-index:2147483002;background:rgba(0,0,0,.65);display:flex;align-items:flex-end;font-family:${C.font}`;
    const secH = r.sections.map((s) => {
      const body = s.list ? `<ul style="margin:4px 0 0;padding-left:16px;color:#c4cede;font-size:13px;line-height:1.6">${s.list.map((x) => `<li style="margin-bottom:3px">${x}</li>`).join("")}</ul>` : `<div style="color:#c4cede;font-size:13.5px;line-height:1.6;margin-top:3px">${s.html}</div>`;
      return `<div style="padding:12px 0;border-bottom:1px solid #232323"><div style="font-weight:700;font-size:14.5px">${s.h}</div>${body}</div>`;
    }).join("");
    const scH = r.metrics.map(
      (m) => `<div style="background:${C.sf};border:1px solid ${C.line};border-radius:12px;padding:11px"><div style="font-size:10px;color:${C.t2};text-transform:uppercase;line-height:1.2">${m.label}</div><div style="font:700 20px monospace;margin:7px 0 4px;color:${C.t}">${m.value}</div><div style="font-size:9.5px;color:${C.t2};line-height:1.3">${m.note}</div></div>`
    ).join("");
    const starsHtml = [0, 1, 2, 3, 4].map((i) => `<span data-i="${i}" style="cursor:pointer;color:${C.t2}">★</span>`).join("");
    o.innerHTML = `<div style="width:100%;max-height:92vh;overflow:auto;background:linear-gradient(180deg,#1b1b1b,#141414);border-top:1px solid rgba(255,164,8,.5);border-radius:20px 20px 0 0;color:${C.t}"><div style="width:40px;height:5px;border-radius:4px;background:${C.line};margin:9px auto 2px"></div><div style="display:flex;align-items:center;gap:10px;padding:12px 17px;border-bottom:1px solid ${C.line};position:sticky;top:0;background:#191919"><div style="width:30px;height:30px;border-radius:9px;background:${C.br};display:grid;place-items:center;color:#000;font-weight:800">⛨</div><div><b style="font-size:16px">AI Trading Review</b><div style="font-size:11px;color:${C.t2}">${L.reviewSubtitle(r.list.length)}</div></div><span style="margin-left:auto;cursor:pointer;color:${C.t2};font-size:28px;line-height:1" id="lbxRvX">×</span></div><div style="padding:6px 18px 30px">${secH}<div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:${C.t2};margin:16px 0 8px">${L.metricsHeading(r.list.length)}</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px">${scH}</div><div style="margin-top:16px;background:rgba(255,164,8,.10);border:1px solid rgba(255,164,8,.35);border-radius:12px;padding:13px;font-size:14px"><b style="color:${C.br}">${L.habitHeading(r.list.length)}</b> ${r.habit}.</div><div style="margin-top:16px;text-align:center"><div style="font-size:12px;color:${C.t2};margin-bottom:8px">${L.reviewHelpfulQ}</div><div id="lbxStars" style="display:flex;justify-content:center;gap:7px;font-size:27px">${starsHtml}</div><div id="lbxStarMsg" style="font-size:11px;color:${C.pos};margin-top:7px;height:14px"></div></div><div style="margin-top:14px;font-size:12px;color:${C.t2};font-style:italic">${L.reviewDisclaimer}</div></div></div>`;
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
        starMsg.textContent = L.thanksRating;
      };
    });
    o.querySelector("#lbxStars").onmouseleave = () => paint((r.rating || 0) - 1);
    if (r.rating) paint(r.rating - 1);
  }
  function updateCounter() {
    paintRings();
  }
  function revengeBanner(bodyHtml) {
    const id = "lbxRevenge";
    const old = document.getElementById(id);
    if (old) old.remove();
    const e = document.createElement("div");
    e.id = id;
    e.style.cssText = `position:fixed;left:8px;right:8px;top:10px;z-index:2147483005;background:linear-gradient(180deg,#2a1512,#171717);border:1.5px solid ${C.neg};border-radius:14px;padding:14px 16px;font-family:${C.font};color:${C.t};box-shadow:0 18px 46px -12px rgba(0,0,0,.85),0 0 0 1px rgba(230,69,69,.35)`;
    e.innerHTML = `<div style="display:flex;align-items:center;gap:8px;font-weight:800;font-size:15px;margin-bottom:6px"><span style="font-size:18px">⚠️</span><span>${L.revengeTitle}</span></div><div style="font-size:13.5px;line-height:1.55;color:#e8dcda">${bodyHtml}</div><button id="lbxRevengeOk" style="margin-top:12px;border:0;cursor:pointer;font:700 13px ${C.font};background:${C.neg};color:#fff;padding:9px 16px;border-radius:10px">${L.revengeGotIt}</button>`;
    document.body.appendChild(e);
    const ok = e.querySelector("#lbxRevengeOk");
    if (ok) ok.onclick = () => e.remove();
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
    box.innerHTML = `<div style="display:flex;align-items:center;gap:9px;padding:12px 13px;border-bottom:1px solid ${C.line};background:linear-gradient(180deg,rgba(255,164,8,.10),transparent)"><div style="width:30px;height:30px;border-radius:9px;background:${C.br};display:grid;place-items:center;font-weight:800;color:#000;font-size:16px">⛨</div><div style="font-weight:700;font-size:15px;line-height:1.1">Trading Coach<div style="font-weight:500;font-size:11px;color:${C.t2}">${L.headerStatus}</div></div><div style="margin-left:auto;display:flex;align-items:center;gap:6px;font-size:11px;color:${C.t2}"><span style="width:8px;height:8px;border-radius:50%;background:${C.pos};box-shadow:0 0 0 4px rgba(83,166,66,.15)"></span>${L.headerWatching}</div><button id="lbxMin" style="width:32px;height:32px;border:0;background:${C.rs};color:${C.t2};cursor:pointer;font-size:18px;border-radius:9px;margin-left:4px">–</button></div><div style="display:flex;align-items:center;justify-content:space-between;padding:9px 13px;border-bottom:1px solid ${C.line};color:${C.t2};font-size:12px"><span id="lbxState" style="display:flex;align-items:center;gap:7px"></span><span style="display:flex;gap:8px;align-items:center"><button id="lbxPrev" style="width:32px;height:32px;border:1px solid ${C.line};background:${C.sf};color:${C.t};border-radius:8px;cursor:pointer;font-size:16px">‹</button><span id="lbxPos" style="min-width:46px;text-align:center;font-family:monospace">–</span><button id="lbxNext" style="width:32px;height:32px;border:1px solid ${C.line};background:${C.sf};color:${C.t};border-radius:8px;cursor:pointer;font-size:16px">›</button></span></div><div id="lbxCard" style="padding:15px 15px 17px;max-height:66vh;overflow:auto"></div>`;
    document.body.appendChild(box);
    pill = document.createElement("div");
    pill.style.cssText = `position:fixed;top:116px;right:8px;z-index:2147483000;display:none;align-items:center;gap:8px;padding:8px 12px;border-radius:40px;cursor:grab;background:linear-gradient(180deg,#2a2314,#1b1b1b);border:1.5px solid #FFA408;box-shadow:0 0 0 1px rgba(255,164,8,.30),0 6px 22px -4px rgba(255,164,8,.55),0 12px 34px -12px rgba(0,0,0,.75);font-family:${C.font};color:${C.t};touch-action:none;user-select:none;animation:lbxGlow 2.4s ease-in-out infinite`;
    pill.innerHTML = `<div style="width:26px;height:26px;border-radius:50%;background:${C.br};display:grid;place-items:center;color:#000;font-weight:800">⛨</div><b style="font-size:14px">Coach</b><span id="lbxRing" style="display:inline-flex;width:22px;height:22px"></span>`;
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
    elState = box.querySelector("#lbxState");
    elRingPill = pill.querySelector("#lbxRing");
    elPos = box.querySelector("#lbxPos");
    paintRings();
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
    S.reviewReady = prev.reviewReady || false;
    S.init = true;
  }
  w.__lbxCoach = S;
  mount();
  function processTrades(list) {
    const fresh = list.filter((tr) => !S.seen[tr.ticket]).sort((a, b) => a.closeTime - b.closeTime);
    if (!fresh.length) return;
    let revenge = null;
    let revengeTrade = null;
    fresh.forEach((tr) => {
      S.seen[tr.ticket] = 1;
      const all = S.baseAll.concat(S.newTrades);
      const sig = detectRevenge(tr, all);
      if (sig) {
        revenge = sig;
        revengeTrade = tr;
      }
      S.newTrades.push(tr);
      S.newCount++;
      const card = buildComment(tr, all.concat(tr), S.newTrades);
      if (S.newCount % REVIEW_EVERY === 0) {
        card.review = buildReview(S.newTrades.slice(-REVIEW_EVERY));
        S.reviewReady = true;
      }
      S.cards.push(card);
      S.idx = S.cards.length - 1;
    });
    updateCounter();
    render();
    const last = fresh[fresh.length - 1], lp = pnl(last);
    toast(
      (S.newCount % REVIEW_EVERY === 0 ? L.reviewReadyToastPrefix(REVIEW_EVERY) : "") + L.tradeToast(sgn(lp), last.alias),
      lp >= 0 ? C.pos : C.neg
    );
    if (revenge && revengeTrade) showRevenge(revenge, revengeTrade);
  }
  function showRevenge(sig, trade) {
    const parts = [];
    if (sig.higherLev) parts.push(L.revengeLev(trade.mult, sig.prevLoss.mult));
    if (sig.biggerMargin) parts.push(L.revengeMargin(fk(trade.sumInv), fk(sig.prevLoss.sumInv)));
    let body = L.revengeBody(sig.minutesAfter, parts.join(L.revengeAnd));
    const hist = S.baseAll.concat(S.newTrades);
    const pl = postLossTrades(hist, hist);
    if (pl.length >= 5) {
      const wr = Math.round(100 * pl.filter(isWin).length / pl.length);
      body += " " + L.revengeWinRate(wr);
    }
    revengeBanner(body);
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
