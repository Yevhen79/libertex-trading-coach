/*
 * Global configuration — the top-level knobs.
 * Algorithm-specific thresholds live next to the rules that use them
 * (see detect.ts, comment.ts, review.ts). This file holds only the values
 * that the whole coach shares.
 */

import type { Palette } from "./types";

/** Same-origin endpoint the terminal itself uses for closed trades. */
export const API =
  "/spa/report/closed-positions?page=1&pageSize=100&order=CloseTime&orderDir=desc&searchPhrase=";

/**
 * RULE: a full "AI Trading Review" is produced every N new trades.
 * (Was 10; set to 5 for a faster hackathon demo.)
 */
export const REVIEW_EVERY = 5;

/** How often (ms) we re-poll the closed-positions feed. */
export const POLL_MS = 15000;

/** Clearance (px) kept above the terminal's bottom tab bar. */
export const NAV = 80;

/** UI colour palette. */
export const C: Palette = {
  bg: "#111111", sf: "#181818", rs: "#242526", br: "#FFA408",
  pos: "#53A642", neg: "#E64545", t: "#ffffff", t2: "#909294",
  line: "#2a2b2c", font: "Inter,Roboto,-apple-system,system-ui,Arial,sans-serif",
};
