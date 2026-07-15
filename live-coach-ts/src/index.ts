/*
 * ENTRY POINT — wires the layers together and starts the coach.
 * =============================================================
 * Flow:
 *   1. Tear down any previous inject and restore its state (seamless re-paste).
 *   2. Mount the UI.
 *   3. Poll the closed-positions feed every POLL_MS; the first poll seeds a
 *      baseline (existing history is NOT "new"), later polls process new trades.
 *   4. Expose window.__lbxCoachStop so a re-inject can clean up.
 *
 * esbuild bundles this file (and everything it imports) into a single
 * self-executing IIFE — the file you paste into the browser console.
 */

import { API, REVIEW_EVERY, POLL_MS, C, REVENGE_WARNING_ENABLED } from "./config";
import { pnl, sgn, median, isWin, fk, postLossTrades } from "./format";
import { S, readBalance } from "./state";
import { buildComment } from "./comment";
import { buildReview } from "./review";
import { detectRevenge, detectRevengePending, REVENGE_FRESH_MS } from "./detect";
import type { RevengeSignal } from "./detect";
import { installOrderWatch } from "./orderform";
import { mount, unmount, render, toast, updateCounter, revengeBanner } from "./ui";
import { L } from "./i18n";
import type { Trade, ClosedPositionsResponse, CoachWindow } from "./types";

const w = window as unknown as CoachWindow;

// 1. Remove a previous instance and carry its state over.
const prev = w.__lbxCoach;
try { if (w.__lbxCoachStop) w.__lbxCoachStop(); } catch { /* ignore */ }
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
  S.bal = prev.bal || 20000;
  S.reviewReady = prev.reviewReady || false;
  S.init = true;
}
w.__lbxCoach = S;

// 2. Mount the UI (creates the window + pill, wires interactions).
mount();

// 3a. Turn newly-closed trades into cards, fire a toast, refresh the view.
function processTrades(list: Trade[]): void {
  const fresh = list.filter((tr) => !S.seen[tr.ticket]).sort((a, b) => a.closeTime - b.closeTime);
  if (!fresh.length) return;

  fresh.forEach((tr) => {
    S.seen[tr.ticket] = 1;
    const all = S.baseAll.concat(S.newTrades); // history BEFORE adding tr — for revenge look-back

    // Revenge check (post-facto fallback): did this trade escalate risk right
    // after a loss? Only warn if it JUST happened — never criticise old history
    // (app open / re-inject): the trade must have closed within REVENGE_FRESH_MS.
    const sig = REVENGE_WARNING_ENABLED ? detectRevenge(tr, all) : null;
    if (sig && Date.now() - tr.closeTime <= REVENGE_FRESH_MS) warnRevenge(sig, tr.mult, tr.sumInv);

    S.newTrades.push(tr);
    S.newCount++;
    const card = buildComment(tr, all.concat(tr), S.newTrades);
    // Every REVIEW_EVERY trades a full review is attached; the rings signal it.
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
    (S.newCount % REVIEW_EVERY === 0 ? L.reviewReadyToastPrefix(REVIEW_EVERY) : "") +
      L.tradeToast(sgn(lp), last.alias),
    lp >= 0 ? C.pos : C.neg,
  );
}

// De-dup so the pre-trade (order-form) and post-facto (poll) paths can't both
// pop a banner for the same escalation within a short window.
let lastRevengeAt = 0;

/**
 * Show the revenge banner for an escalation of leverage/margin `cur*` over the
 * prior loss in `sig`. Called by BOTH paths: pre-trade (order-form intercept)
 * and post-facto (poll). Never blocks — advisory only.
 */
function warnRevenge(sig: RevengeSignal, curMult: number, curMargin: number): void {
  const now = Date.now();
  if (now - lastRevengeAt < 90000) return; // one warning per ~90s
  lastRevengeAt = now;

  const parts: string[] = [];
  if (sig.higherLev) parts.push(L.revengeLev(curMult, sig.prevLoss.mult));
  if (sig.biggerMargin) parts.push(L.revengeMargin(fk(curMargin), fk(sig.prevLoss.sumInv)));
  let body = L.revengeBody(sig.minutesAfter, parts.join(L.revengeAnd));

  // Add the historic post-loss win-rate line only with enough of a sample (≥5).
  const hist = S.baseAll.concat(S.newTrades);
  const pl = postLossTrades(hist, hist);
  if (pl.length >= 5) {
    const wr = Math.round((100 * pl.filter(isWin).length) / pl.length);
    body += " " + L.revengeWinRate(wr);
  }
  revengeBanner(body);
}

// 3b. Poll: first call seeds the baseline, subsequent calls process new trades.
function poll(): void {
  readBalance();
  fetch(API, { headers: { Accept: "application/json" }, credentials: "include" })
    .then((r) => r.json())
    .then((j: ClosedPositionsResponse) => {
      const list = (j && j.result && j.result.closed) || [];
      if (!S.init) {
        S.init = true;
        list.forEach((tr) => (S.seen[tr.ticket] = 1));
        S.baseAll = list.slice();
        S.medSum = median(list.map((tr) => tr.sumInv));
        S.medDur = median(list.map((tr) => (tr.closeTime - tr.startTime) / 60000));
        render();
      } else {
        processTrades(list);
      }
    })
    .catch(() => { /* offline / transient — ignore */ });
}

// 4. Start.
render();
poll();
const iv = setInterval(poll, POLL_MS);

// Pre-trade path (ideal): warn the instant Buy/Sell is pressed, from the live
// order form — before/at the moment the trade opens. Falls back to the poll.
// Only installed when the warning is enabled (see REVENGE_WARNING_ENABLED).
const stopWatch = REVENGE_WARNING_ENABLED
  ? installOrderWatch((mult, margin) => {
      const sig = detectRevengePending(mult, margin, Date.now(), S.baseAll.concat(S.newTrades));
      if (sig) warnRevenge(sig, mult, margin);
    })
  : () => { /* revenge warning disabled */ };

w.__lbxCoachStop = () => {
  clearInterval(iv);
  stopWatch();
  unmount();
};

console.info(`[Trading Coach] v2.2 injected; carried ${S.newCount} trades`);
