/*
 * Shared mutable state (a single instance for the whole coach) plus the two
 * helpers that read/mutate it. Everything else imports `S` from here.
 */

import type { CoachState } from "./types";

/** The one and only coach state. Restored from a previous inject in index.ts. */
export const S: CoachState = {
  seen: {}, cards: [], idx: 0, newCount: 0, newTrades: [], baseAll: [],
  init: false, rot: {}, bal: 20000, medSum: 0, medDur: 0, reviewReady: false,
};

/**
 * Read free balance from the terminal DOM (`.spare-cash`) and remember it.
 * Falls back to the last known value if the element is absent.
 */
export function readBalance(): number {
  try {
    const el = document.querySelector(".spare-cash");
    if (el) {
      const n = parseFloat((el.textContent || "").replace(/[^0-9.]/g, ""));
      if (n > 0) S.bal = n;
    }
  } catch { /* ignore */ }
  return S.bal;
}

/** Round-robin over a message pool, keyed so different pools rotate independently. */
export function rotate(pool: string[], key: string): string {
  const i = (S.rot[key] || 0) % pool.length;
  S.rot[key] = (S.rot[key] || 0) + 1;
  return pool[i];
}
