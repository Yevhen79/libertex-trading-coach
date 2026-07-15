/*
 * LOCALE CONTRACT — the single source of truth for every user-facing string.
 * =========================================================================
 * `Copy` is the typed shape both language packs must implement. Because
 * `ru.ts` and `en.ts` are typed as `Copy`, the TypeScript compiler fails the
 * build if either pack is missing a key or has the wrong signature — so the
 * two languages can never drift out of parity.
 *
 * At build time esbuild bakes `LOCALE` and `i18n.ts` selects one pack, so the
 * unused language is tree-shaken away and each output bundle is single-language.
 *
 * VOICE (see messages): cold, factual, peer-to-peer. State the math and the
 * pattern; no consolation, no praise, no magnitude adjectives, no pep emoji.
 */

export interface Copy {
  // ---- per-trade openers (messages) -----------------------------------
  /** Openers rotated after a losing trade. Placeholders {a}=alias, {v}=signed money. */
  lossOpeners: string[];
  /** Openers rotated after a winning trade. */
  winOpeners: string[];

  // ---- per-trade card (comment) ---------------------------------------
  /** Card title for a losing trade. */
  cardTitleLoss: string;
  /** Card title for a winning trade. */
  cardTitleWin: string;
  /** Card title for a break-even trade. */
  cardTitleFlat: string;
  /** Opener for a break-even trade. */
  breakEvenHead(alias: string): string;
  /** Deposit-impact line after a loss. `neg` = colour, `pctS` = "1.23", `balK` = "20k". */
  lossDeposit(neg: string, pctS: string, balK: string): string;
  /** Deposit-impact line after a gain. */
  gainDeposit(pos: string, pctS: string, balK: string): string;
  /** Leverage-amplification line: a small price move became a big % of margin. */
  leverageAmp(moveS: string, mult: number, colour: string, pinS: string, notionK: string): string;
  /** Locale tag for time formatting, e.g. "ru-RU" / "en-US". */
  timeLocale: string;

  // ---- per-trade patterns (detect) ------------------------------------
  /** Leverage bands 0..4 (low→extreme); each renders the multiplier + wipe %. */
  leverageBands: ReadonlyArray<(m: number, wp: string) => string>;
  /** Trade opened shortly after a loss closed. */
  revengeNote: string;
  // ---- stop-loss status line (shown on EVERY card) --------------------
  /** A stop-loss was set. */
  stopSet: string;
  /** No stop-loss AND the trade lost. */
  noStopOnLoss: string;
  /** No stop-loss (win / break-even). */
  noStop: string;
  /** One position was a large share of the deposit. */
  concentration(expoPct: string): string;
  /** Margin larger than the trader's own median. */
  oversizeMargin(marginK: string, medianK: string): string;
  /** Position held unusually long into a loss. */
  longHold(minutes: number): string;
  /** N wins in a row. */
  winStreak(streak: number): string;
  /** N losses in a row. */
  lossStreak(streak: number): string;
  /** Same instrument as the previous trade. */
  sameInstrument(alias: string): string;

  // ---- N-trade review (review) ----------------------------------------
  styleScalper: string;
  styleIntraday: string;
  styleDaySwing: string;
  styleSwing: string;
  /** Average-leverage descriptor (5 buckets by mAvg). */
  levDesc(mAvg: number): string;
  /** Concentrated in one instrument. */
  concConcentrated(alias: string, pct: number): string;
  /** Spread across N instruments. */
  concSpread(nAssets: number): string;
  trendImprove: string;
  trendDecline: string;
  trendMixed: string;
  /** Greed/fear flag: reward:risk skew. */
  gfSkew(ratio: number): string;
  /** Greed/fear flag: revenge trades in the window. */
  gfRevenge(count: number): string;
  /** Greed/fear flag: losing streak length. */
  gfLossStreak(len: number): string;
  /** Greed/fear flag: oversized-margin trades. */
  gfOversize(count: number): string;

  sec1Head: string;
  sec1Body(styleName: string, medMin: number, levDesc: string, concDesc: string): string;
  sec2Head(n: number): string;
  sec2Total(n: number): string;
  sec2Winners(wins: number, n: number, wr: number): string;
  sec2Best(alias: string, pos: string, signed: string): string;
  sec2Worst(alias: string, neg: string, signed: string): string;
  sec2AvgWL(avgWin: string, avgLoss: string): string;
  sec2Size(marginF: string, mAvg: number, notionK: string): string;
  sec2Stops(slPct: number): string;
  sec2Leverage(mAvg: number, mMax: number): string;
  sec2Duration(med: number, min: number, max: number): string;
  sec3Head: string;
  sec3Body(netColour: string, netSigned: string, pctNet: string, wr: number, hist: number, bestA: string, bestSigned: string, worstA: string, worstSigned: string, trend: string): string;
  sec4Head: string;
  sec4Body(mAvg: number, mcDist: string, expoMax: number, notionMaxK: string, slPct: number, noSLTail: string): string;
  /** Tail appended to sec4 when some trades had no stop; empty otherwise. */
  sec4NoSLTail(noSL: number): string;
  sec5Head: string;
  sec5WithFlags(flagsJoined: string): string;
  sec5Clean: string;
  sec6Head: string;
  sec6StopLow: string;
  sec6StopOk: string;
  sec6LevHigh: string;
  sec6LevOk: string;

  // ---- review metrics (raw behavioural numbers, not 1..10 scores) -----
  metricCooldownLabel: string;
  metricCooldownValue(min: number): string;
  metricCooldownNote: string;
  metricSizeLabel: string;
  metricSizeValue(marginPct: number): string;
  metricSizeNote(multPct: number): string;
  metricPostLossLabel: string;
  /** Headline: the win-rate %, or "—" when there were no post-loss trades. */
  metricPostLossValue(wr: number | null): string;
  /** Context under it: how many post-loss trades the rate is based on. */
  metricPostLossNote(count: number): string;

  habitStop: string;
  habitLeverage: string;
  habitCutLosses: string;
  habitSize: string;

  // ---- UI chrome (ui) -------------------------------------------------
  greeting(reviewEvery: number, tColour: string, balK: string): string;
  openReviewBtn(reviewEvery: number): string;
  /** Progress-ring label while the coach is still gathering trades. */
  ringLearning: string;
  /** Progress-ring label when a full review is ready to open. */
  ringReady: string;
  helpful: string;
  thanksUp: string;
  thanksDown: string;
  reviewSubtitle(n: number): string;
  metricsHeading(n: number): string;
  habitHeading(n: number): string;
  reviewHelpfulQ: string;
  reviewDisclaimer: string;
  thanksRating: string;
  headerStatus: string;
  headerWatching: string;

  // ---- revenge-trade warning banner (index) ---------------------------
  revengeTitle: string;
  /** Higher-leverage escalation phrase, e.g. "×500 против ×100". */
  revengeLev(cur: number, prev: number): string;
  /** Bigger-margin escalation phrase, e.g. "$1.2k против $400". */
  revengeMargin(curK: string, prevK: string): string;
  /** Conjunction joining two escalation phrases (" и " / " and "). */
  revengeAnd: string;
  /** Main sentence: minutes since the loss + the joined escalation phrase. */
  revengeBody(minutesAfter: number, riskJoined: string): string;
  /** Optional line, added only with ≥5 historical post-loss trades. */
  revengeWinRate(wr: number): string;
  revengeGotIt: string;

  // ---- entry-point toasts (index) -------------------------------------
  reviewReadyToastPrefix(reviewEvery: number): string;
  tradeToast(signed: string, alias: string): string;
}
