/*
 * ENGLISH copy pack.
 * ==================
 * Voice: cold, factual, peer-to-peer. State the math and the pattern —
 * no consolation, no praise, no magnitude adjectives, no pep emoji.
 * Structural twin of ru.ts; the shared `Copy` type keeps them in parity.
 */

import type { Copy } from "./contract";

export const en: Copy = {
  // ---- per-trade openers ----------------------------------------------
  lossOpeners: [
    "<b>{a}</b> closed at a loss: <b>{v}</b>.",
    "Loss on <b>{a}</b>: <b>{v}</b>.",
    "<b>{a}</b> — loss of <b>{v}</b>.",
    "Position <b>{a}</b> closed at <b>{v}</b>.",
  ],
  winOpeners: [
    "<b>{a}</b> closed in profit: <b>{v}</b>.",
    "Profit on <b>{a}</b>: <b>{v}</b>.",
    "<b>{a}</b> — profit <b>{v}</b>.",
    "Position <b>{a}</b> closed at <b>{v}</b>.",
  ],

  // ---- per-trade card -------------------------------------------------
  cardTitleLoss: "Trade review: loss",
  cardTitleWin: "Trade review: profit",
  cardTitleFlat: "Break-even trade",
  breakEvenHead: (a) => `Your <b>${a}</b> trade closed at break-even.`,
  lossDeposit: (neg, pctS, balK) => ` Loss — <b style="color:${neg}">−${pctS}%</b> of deposit ($${balK}).`,
  gainDeposit: (pos, pctS, balK) => ` Profit — <b style="color:${pos}">${pctS}%</b> of deposit ($${balK}).`,
  leverageAmp: (moveS, mult, colour, pinS, notionK) =>
    ` ⚙️ Price moved <b>${moveS}%</b>; <b>×${mult}</b> leverage turned it into <b style="color:${colour}">${pinS}%</b> of your margin (volume ~$${notionK}).`,
  timeLocale: "en-US",

  // ---- per-trade patterns ---------------------------------------------
  leverageBands: [
    (m, wp) => `low leverage <b>×${m}</b> — ~${wp}% against the position to a margin call.`,
    (m, wp) => `moderate leverage <b>×${m}</b> — ~${wp}% adverse move to a margin call.`,
    (m, wp) => `high leverage <b>×${m}</b> — ~${wp}% against the position already wipes it.`,
    (m, wp) => `very high leverage <b>×${m}</b> — ~${wp}% against nearly wipes your stake.`,
    (m, wp) => `extreme leverage <b>×${m}</b> — just <b>~${wp}%</b> against is enough to wipe the position.`,
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
  levDesc: (m) =>
    m > 500 ? `with extreme leverage (avg ×${m})`
    : m > 150 ? `with very high leverage (avg ×${m})`
    : m > 50 ? `with high leverage (avg ×${m})`
    : m > 10 ? `with moderate leverage (avg ×${m})`
    : `with modest leverage (avg ×${m})`,
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
  sec1Body: (style, med, lev, conc) =>
    `Mostly a <b>${style}</b> — median hold ${med} min. You trade ${lev}, ${conc}.`,
  sec2Head: (n) => `2. Parameters over ${n} trades`,
  sec2Total: (n) => `Total trades: <b>${n}</b>`,
  sec2Winners: (w, n, wr) => `Winners: <b>${w} of ${n}</b> (${wr}%)`,
  sec2Best: (a, pos, s) => `Largest profit: ${a} (<b style="color:${pos}">${s}</b>)`,
  sec2Worst: (a, neg, s) => `Largest loss: ${a} (<b style="color:${neg}">${s}</b>)`,
  sec2AvgWL: (w, l) => `Average profit / loss: <b>${w}</b> / <b>${l}</b>`,
  sec2Size: (marginF, mAvg, notionK) => `Average margin × leverage: $${marginF} × ×${mAvg} ≈ volume <b>$${notionK}</b>`,
  sec2Stops: (sl) => `Trades with a stop-loss: <b>${sl}%</b>`,
  sec2Leverage: (avg, max) => `Leverage: avg ×${avg}, max ×${max}`,
  sec2Duration: (med, min, max) => `Duration: median ${med} min (${min}–${max})`,
  sec3Head: "3. Dynamics",
  sec3Body: (nc, ns, pct, wr, hist, bestA, bestS, worstA, worstS, trend) =>
    `Net result — <b style="color:${nc}">${ns}</b> (${pct}% of deposit). Win rate ${wr}% vs ${hist}% over your whole history. Best asset — <b>${bestA}</b> (${bestS}), weakest — <b>${worstA}</b> (${worstS}). Dynamics: ${trend}.`,
  sec4Head: "4. Risk patterns",
  sec4Body: (mAvg, mcDist, expoMax, notionMaxK, sl, tail) =>
    `The main risk amplifier is leverage: at an average of ×${mAvg} a margin call hits after ~<b>${mcDist}%</b> against you. The largest position was <b>${expoMax}% of the deposit</b> (notional up to $${notionMaxK}). A stop-loss was set on <b>${sl}%</b> of trades${tail}`,
  sec4NoSLTail: (noSL) => (noSL > 0 ? ` — ${noSL} unprotected.` : "."),
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
  metricPostLossValue: (wr) => (wr == null ? "—" : `${wr}%`),
  metricPostLossNote: (c) => (c > 0 ? `of ${c} trade${c === 1 ? "" : "s"}` : "no such trades"),

  habitStop: "set a stop-loss on every trade (mandatory at high leverage)",
  habitLeverage: "lower your leverage — it multiplies the risk of losing your margin",
  habitCutLosses: "cut losses faster and let profits run",
  habitSize: "keep size and leverage within reason",

  // ---- UI chrome ------------------------------------------------------
  greeting: (every, tc, balK) =>
    `I'm your Trading Coach. After every trade — a short factual read; every ${every} trades — a full review of style, risk and habits. Balance ~$${balK}. <b style="color:${tc}">Make your first trade.</b>`,
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
  revengeLev: (cur, prev) => `higher leverage (×${cur} vs ×${prev})`,
  revengeMargin: (curK, prevK) => `bigger margin ($${curK} vs $${prevK})`,
  revengeAnd: " and ",
  revengeBody: (min, risk) =>
    `Your previous trade closed at a loss ${min} min ago. This one opened with ${risk}. By timing and risk, this is a revenge trade.`,
  revengeWinRate: (wr) => `Historically only ${wr}% of your post-loss trades closed in profit.`,
  revengeGotIt: "Got it",

  // ---- entry-point toasts ---------------------------------------------
  reviewReadyToastPrefix: (every) => `🧠 AI Trading Review of ${every} trades is ready • `,
  tradeToast: (signed, alias) => `Trade ${signed} — ${alias}`,
};
