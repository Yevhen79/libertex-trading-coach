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

import { API, REVIEW_EVERY, POLL_MS, C } from "./config";
import { pnl, sgn, median, isWin, fk, postLossTrades } from "./format";
import { S, readBalance } from "./state";
import { buildComment } from "./comment";
import { buildReview } from "./review";
import { detectRevenge } from "./detect";
import type { RevengeSignal } from "./detect";
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

  let revenge: RevengeSignal | null = null; // last matching signal in this batch
  let revengeTrade: Trade | null = null;

  fresh.forEach((tr) => {
    S.seen[tr.ticket] = 1;
    const all = S.baseAll.concat(S.newTrades); // history BEFORE adding tr — for revenge look-back
    // Revenge check (post-facto): did this trade escalate risk right after a loss?
    const sig = detectRevenge(tr, all);
    if (sig) { revenge = sig; revengeTrade = tr; }

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

  if (revenge && revengeTrade) showRevenge(revenge, revengeTrade);
}

/** Assemble and show the revenge-warning banner from a detected signal. */
function showRevenge(sig: RevengeSignal, trade: Trade): void {
  const parts: string[] = [];
  if (sig.higherLev) parts.push(L.revengeLev(trade.mult, sig.prevLoss.mult));
  if (sig.biggerMargin) parts.push(L.revengeMargin(fk(trade.sumInv), fk(sig.prevLoss.sumInv)));
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
w.__lbxCoachStop = () => {
  clearInterval(iv);
  unmount();
};

console.info(`[Trading Coach] v2.2 injected; carried ${S.newCount} trades`);
