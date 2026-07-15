/*
 * DOM LAYER — pre-trade order-form interception.
 * ==============================================
 * The ideal revenge warning fires the moment you press Buy/Sell, reading the
 * order you're ABOUT to open (Amount + Multiplier) straight from the terminal's
 * form — not post-facto after it closes. This module watches the live DOM for
 * that click and reports the pending {mult, margin}. It is:
 *   • non-blocking  — it NEVER calls preventDefault; the trade always proceeds;
 *   • best-effort   — if it can't read the form, it silently does nothing and
 *                     the poll-based post-facto path (index.ts) still covers it;
 *   • defensive     — everything is wrapped so a DOM change can't break the coach.
 *
 * The terminal ships no stable class names we can rely on, so we read by TEXT:
 * we find the Buy/Sell button by its label, walk up to the enclosing order form
 * (the ancestor that mentions both "Amount" and "Multiplier"), and pull the two
 * numbers out of its text. To harden this once real selectors are known, replace
 * `findOpenButton` / `readOrderForm` below — nothing else needs to change.
 */

/** Words that identify the order-open button (EN + RU terminals). */
const OPEN_LABEL = /^(buy|sell|купить|продать)\b/i;
/** Labels next to the fields we read. */
const AMOUNT_LABEL = /amount|сумма/i;
const MULT_LABEL = /multiplier|множител/i;

/** Parse a grouped number like "15 000" or "1,250.5" into 15000 / 1250.5. */
function num(s: string): number {
  return parseFloat((s || "").replace(/[^\d.]/g, "")) || 0;
}

/** From a clicked element, find the nearest ancestor that is the Buy/Sell button. */
function findOpenButton(start: Element): Element | null {
  let n: Element | null = start;
  for (let up = 0; up < 4 && n; up++) {
    const t = (n.textContent || "").trim();
    if (t.length < 40 && OPEN_LABEL.test(t)) return n;
    n = n.parentElement;
  }
  return null;
}

/** Walk up from the button to the order form and read {mult, margin} by text. */
function readOrderForm(btn: Element): { mult: number; margin: number } | null {
  let scope: Element | null = btn;
  for (let up = 0; up < 9 && scope; up++) {
    const txt = scope.textContent || "";
    if (AMOUNT_LABEL.test(txt) && MULT_LABEL.test(txt)) break;
    scope = scope.parentElement;
  }
  if (!scope) return null;
  const txt = scope.textContent || "";
  const multM = txt.match(/(?:×|multiplier|множител[а-я]*)\D{0,8}(\d[\d\s.,]*)/i);
  const amtM = txt.match(/(?:amount|сумма)\D{0,10}(\d[\d\s.,]*)/i);
  const mult = multM ? num(multM[1]) : 0;
  const margin = amtM ? num(amtM[1]) : 0;
  if (mult <= 0 || margin <= 0) return null;
  return { mult, margin };
}

/**
 * Install the watcher. `onOpen` is called with the pending order params the
 * instant the user presses Buy/Sell. Returns a teardown function.
 */
export function installOrderWatch(onOpen: (mult: number, margin: number) => void): () => void {
  const handler = (e: Event): void => {
    try {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[id^=lbx]")) return; // ignore clicks inside our own UI
      const btn = findOpenButton(target);
      if (!btn) return;
      const form = readOrderForm(btn);
      if (form) onOpen(form.mult, form.margin);
    } catch {
      /* never let a DOM quirk break trading or the coach */
    }
  };
  // Capture phase so we still see the click if the app stops propagation.
  // We never preventDefault — the order goes through exactly as normal.
  document.addEventListener("click", handler, true);
  return () => document.removeEventListener("click", handler, true);
}
