/*
 * VISUAL LAYER — everything the trader sees.
 * ==========================================
 * Owns the floating window (`box`), the collapsed `pill`, the card renderer,
 * the toast, the full-review overlay, and the window↔pill animation + drag.
 * It reads state (S) and copy/colours, but contains NO trading logic.
 *
 * DOM is created in `mount()` (called after state is restored) and torn down
 * in `unmount()`. `render()` / `toast()` / `updateCounter()` are called by the
 * poll loop in index.ts.
 */

import { C, REVIEW_EVERY, NAV } from "./config";
import { fk, plural } from "./format";
import { S, readBalance } from "./state";
import { t } from "./i18n";
import type { ReviewData } from "./types";

let box!: HTMLDivElement;
let pill!: HTMLDivElement;
let elCard!: HTMLElement;
let elCnt!: HTMLElement;
let elPos!: HTMLElement;

// ---- window <-> pill animation ----------------------------------------
function expand(): void {
  box.style.display = "block";
  box.style.transform = "translateY(-30px) scale(.28)";
  box.style.opacity = "0";
  void box.offsetWidth; // force reflow so the transition actually runs
  box.style.transform = "translateY(0) scale(1)";
  box.style.opacity = "1";
  pill.style.transform = "scale(.15)";
  pill.style.opacity = "0";
  setTimeout(() => { pill.style.display = "none"; pill.style.transform = ""; pill.style.opacity = ""; }, 280);
}
function collapse(): void {
  pill.style.display = "flex";
  pill.style.transform = "scale(0)";
  pill.style.opacity = "0";
  void pill.offsetWidth;
  pill.style.transform = "scale(1)";
  pill.style.opacity = "1";
  box.style.transform = "translateY(-30px) scale(.28)";
  box.style.opacity = "0";
  setTimeout(() => { box.style.display = "none"; box.style.transform = ""; box.style.opacity = ""; }, 340);
}

// ---- card renderer -----------------------------------------------------
export function render(): void {
  if (!S.cards.length) {
    elCard.innerHTML = `<div style="color:${C.t2};font-size:14px;line-height:1.55">${t(`Привет 👋 Я твой Trading Coach. После каждой сделки дам короткий честный разбор, а раз в ${REVIEW_EVERY} сделок — полный обзор твоего стиля, риска и привычек с оценками. Баланс ~$${fk(readBalance())}. <b style="color:${C.t}">Сделай первую сделку — и поехали.</b>`, `Hi 👋 I'm your Trading Coach. After every trade I'll give a short, honest read, and every ${REVIEW_EVERY} trades a full review of your style, risk and habits with scores. Balance ~$${fk(readBalance())}. <b style="color:${C.t}">Make your first trade and we're off.</b>`)}</div>`;
    elPos.textContent = "–";
    return;
  }
  if (S.idx < 0) S.idx = 0;
  if (S.idx > S.cards.length - 1) S.idx = S.cards.length - 1;
  const c = S.cards[S.idx];

  // Footer: either the "open review" button, or the countdown to the next review.
  const foot = c.review
    ? `<button id="lbxRev" style="margin-top:14px;margin-left:10px;border:0;cursor:pointer;font:700 14px ${C.font};background:${C.br};color:#000;padding:12px 16px;border-radius:11px;width:calc(100% - 10px)">${t(`📊 Открыть подробный AI-разбор ${REVIEW_EVERY} сделок`, `📊 Open the full AI review of ${REVIEW_EVERY} trades`)}</button>`
    : c.left
      ? `<div style="margin-top:14px;margin-left:10px;display:flex;align-items:center;gap:10px"><div style="flex:1;height:6px;background:${C.rs};border-radius:4px;overflow:hidden"><i style="display:block;height:100%;width:${((REVIEW_EVERY - c.left) / REVIEW_EVERY) * 100}%;background:${C.br}"></i></div><span style="font-size:12px;color:${C.t2};white-space:nowrap">${t(`ещё <b style="color:${C.t}">${c.left}</b> ${plural(c.left)} до AI-разбора`, `<b style="color:${C.t}">${c.left}</b> more trade${c.left === 1 ? "" : "s"} to your AI review`)}</span></div>`
      : "";
  const feedback = `<div style="margin-top:13px;margin-left:10px;padding-top:11px;border-top:1px solid ${C.line};display:flex;align-items:center;gap:9px"><span style="font-size:11px;color:${C.t2}">${t("Полезно?", "Helpful?")}</span><button id="lbxUp" style="border:1px solid ${c.vote === "up" ? C.pos : C.line};background:${c.vote === "up" ? "rgba(83,166,66,.15)" : C.sf};color:${C.t};cursor:pointer;font-size:15px;border-radius:8px;padding:4px 10px">👍</button><button id="lbxDn" style="border:1px solid ${c.vote === "down" ? C.neg : C.line};background:${c.vote === "down" ? "rgba(230,69,69,.15)" : C.sf};color:${C.t};cursor:pointer;font-size:15px;border-radius:8px;padding:4px 10px">👎</button></div>`;

  elCard.innerHTML =
    `<div style="display:flex;align-items:center;gap:9px;margin-bottom:10px"><span style="font-size:24px">${c.m}</span><span style="font:400 12px/16px ${C.font};color:${C.t2};background:${C.sf};border:1px solid ${C.line};padding:3px 7px;border-radius:4px">${c.chip}</span><span style="margin-left:auto;font-size:11px;color:${C.t2};font-family:monospace">${c.time}</span></div><div style="font-weight:700;font-size:16px;margin-bottom:8px;border-left:3px solid ${c.a};padding-left:10px;margin-left:-2px">${c.ti}</div><div style="font-size:14px;line-height:1.6;color:#cdd6e4;padding-left:10px">${c.h}</div>` +
    foot + feedback;

  elPos.textContent = `${S.idx + 1} / ${S.cards.length}`;
  const rv = box.querySelector("#lbxRev") as HTMLElement | null;
  if (rv) rv.onclick = () => { if (c.review) showReview(c.review); };
  const up = box.querySelector("#lbxUp") as HTMLElement | null;
  const dn = box.querySelector("#lbxDn") as HTMLElement | null;
  if (up) up.onclick = () => { c.vote = "up"; render(); toast(t("Спасибо за отзыв! 👍", "Thanks for the feedback! 👍"), C.pos); };
  if (dn) dn.onclick = () => { c.vote = "down"; render(); toast(t("Понял, спасибо 👎", "Got it, thanks 👎"), C.t2); };
}

// ---- transient toast ---------------------------------------------------
export function toast(txt: string, col?: string): void {
  const e = document.createElement("div");
  e.style.cssText = `position:fixed;left:8px;right:8px;top:10px;z-index:2147483001;background:${C.rs};border:1px solid ${col || C.br};color:#fff;padding:12px 16px;border-radius:14px;font:600 14px ${C.font};box-shadow:0 16px 40px -14px rgba(0,0,0,.7);text-align:center`;
  e.textContent = txt;
  document.body.appendChild(e);
  setTimeout(() => e.remove(), 3200);
}

// ---- full-screen review overlay ---------------------------------------
export function showReview(r: ReviewData): void {
  const o = document.createElement("div");
  o.id = "lbxOverlay";
  o.style.cssText = `position:fixed;inset:0;z-index:2147483002;background:rgba(0,0,0,.65);display:flex;align-items:flex-end;font-family:${C.font}`;

  const secH = r.sections
    .map((s) => {
      const body = s.list
        ? `<ul style="margin:4px 0 0;padding-left:16px;color:#c4cede;font-size:13px;line-height:1.6">${s.list.map((x) => `<li style="margin-bottom:3px">${x}</li>`).join("")}</ul>`
        : `<div style="color:#c4cede;font-size:13.5px;line-height:1.6;margin-top:3px">${s.html}</div>`;
      return `<div style="padding:12px 0;border-bottom:1px solid #232323"><div style="font-weight:700;font-size:14.5px">${s.h}</div>${body}</div>`;
    })
    .join("");

  const scH = r.scores
    .map(
      (s) =>
        `<div style="background:${C.sf};border:1px solid ${C.line};border-radius:12px;padding:11px"><div style="font-size:10px;color:${C.t2};text-transform:uppercase">${s[0]}</div><div style="font:700 22px monospace;margin:3px 0 6px">${s[1]}<span style="font-size:11px;color:${C.t2}">/10</span></div><div style="height:5px;background:${C.rs};border-radius:4px;overflow:hidden"><i style="display:block;height:100%;width:${s[1] * 10}%;background:${C.br}"></i></div><div style="font-size:9.5px;color:${C.t2};margin-top:6px;line-height:1.3">${s[2]}</div></div>`,
    )
    .join("");

  const starsHtml = [0, 1, 2, 3, 4]
    .map((i) => `<span data-i="${i}" style="cursor:pointer;color:${C.t2}">★</span>`)
    .join("");

  o.innerHTML = `<div style="width:100%;max-height:92vh;overflow:auto;background:linear-gradient(180deg,#1b1b1b,#141414);border-top:1px solid rgba(255,164,8,.5);border-radius:20px 20px 0 0;color:${C.t}"><div style="width:40px;height:5px;border-radius:4px;background:${C.line};margin:9px auto 2px"></div><div style="display:flex;align-items:center;gap:10px;padding:12px 17px;border-bottom:1px solid ${C.line};position:sticky;top:0;background:#191919"><div style="width:30px;height:30px;border-radius:9px;background:${C.br};display:grid;place-items:center;color:#000;font-weight:800">⛨</div><div><b style="font-size:16px">AI Trading Review</b><div style="font-size:11px;color:${C.t2}">${t(`разбор последних ${r.list.length} сделок`, `review of your last ${r.list.length} trades`)}</div></div><span style="margin-left:auto;cursor:pointer;color:${C.t2};font-size:28px;line-height:1" id="lbxRvX">×</span></div><div style="padding:6px 18px 30px">${secH}<div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:${C.t2};margin:16px 0 8px">${t(`Оценки за ${r.list.length} сделок`, `Scores over ${r.list.length} trades`)}</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px">${scH}</div><div style="margin-top:16px;background:rgba(255,164,8,.10);border:1px solid rgba(255,164,8,.35);border-radius:12px;padding:13px;font-size:14px"><b style="color:${C.br}">${t(`Привычка №1 на следующие ${r.list.length}:`, `Habit #1 for the next ${r.list.length}:`)}</b> ${r.habit}.</div><div style="margin-top:16px;text-align:center"><div style="font-size:12px;color:${C.t2};margin-bottom:8px">${t("Насколько полезен разбор?", "How helpful was this review?")}</div><div id="lbxStars" style="display:flex;justify-content:center;gap:7px;font-size:27px">${starsHtml}</div><div id="lbxStarMsg" style="font-size:11px;color:${C.pos};margin-top:7px;height:14px"></div></div><div style="margin-top:14px;font-size:12px;color:${C.t2};font-style:italic">${t("AI может ошибаться. Разбор поведения и риск-профиля, не инвестиционный совет.", "AI can make mistakes. A review of behaviour and risk profile, not investment advice.")}</div></div></div>`;

  document.body.appendChild(o);
  (o.querySelector("#lbxRvX") as HTMLElement).onclick = () => o.remove();
  o.onclick = (e) => { if (e.target === o) o.remove(); };

  // ⭐ rating: hover previews, click commits and thanks the user.
  const stars = Array.from(o.querySelectorAll<HTMLElement>("#lbxStars span"));
  const starMsg = o.querySelector("#lbxStarMsg") as HTMLElement;
  const paint = (k: number): void => stars.forEach((s, i) => (s.style.color = i <= k ? C.br : C.t2));
  stars.forEach((star, i) => {
    star.onmouseenter = () => paint(i);
    star.onclick = () => { r.rating = i + 1; paint(i); starMsg.textContent = t("Спасибо за оценку! 🙏", "Thanks for rating! 🙏"); };
  });
  (o.querySelector("#lbxStars") as HTMLElement).onmouseleave = () => paint((r.rating || 0) - 1);
  if (r.rating) paint(r.rating - 1);
}

/** Update the "new trades" counter in the header and the badge on the pill. */
export function updateCounter(n: number): void {
  elCnt.textContent = t(`новых сделок: ${n}`, `new trades: ${n}`);
  const pip = pill.querySelector("#lbxPip") as HTMLElement | null;
  if (pip) pip.textContent = String(n);
}

// ---- click-outside-to-collapse ----------------------------------------
function outsideClick(e: PointerEvent): void {
  if (box.style.display === "none") return;
  if (box.contains(e.target as Node) || pill.contains(e.target as Node)) return;
  if (document.getElementById("lbxOverlay")) return; // the review modal is open
  collapse();
}

/** Create the widget DOM and wire all interactions. Call once, after state restore. */
export function mount(): void {
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
    kf.textContent =
      "@keyframes lbxGlow{0%,100%{box-shadow:0 0 0 1px rgba(255,164,8,.30),0 6px 22px -4px rgba(255,164,8,.50),0 12px 34px -12px rgba(0,0,0,.75)}50%{box-shadow:0 0 0 1px rgba(255,164,8,.55),0 6px 26px -2px rgba(255,164,8,.85),0 12px 34px -12px rgba(0,0,0,.75)}}";
    document.head.appendChild(kf);
  }

  box.style.transition = "transform .34s cubic-bezier(.16,1,.3,1),opacity .26s ease";
  box.style.transformOrigin = "top right";
  pill.style.transition = "transform .36s cubic-bezier(.18,1.6,.35,1),opacity .24s ease";

  elCard = box.querySelector("#lbxCard") as HTMLElement;
  elCnt = box.querySelector("#lbxCnt") as HTMLElement;
  elPos = box.querySelector("#lbxPos") as HTMLElement;

  // nav + minimise
  (box.querySelector("#lbxPrev") as HTMLElement).onclick = () => { S.idx--; render(); };
  (box.querySelector("#lbxNext") as HTMLElement).onclick = () => { S.idx++; render(); };
  (box.querySelector("#lbxMin") as HTMLElement).onclick = () => collapse();

  // drag the pill; a tap (little movement) expands it back into the window
  let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0, moved = 0;
  pill.addEventListener("pointerdown", (e: PointerEvent) => {
    dragging = true; moved = 0;
    const r = pill.getBoundingClientRect();
    sx = e.clientX; sy = e.clientY; ox = e.clientX - r.left; oy = e.clientY - r.top;
    pill.style.animation = "none"; pill.style.cursor = "grabbing";
    try { pill.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    e.preventDefault();
  });
  pill.addEventListener("pointermove", (e: PointerEvent) => {
    if (!dragging) return;
    moved += Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy);
    sx = e.clientX; sy = e.clientY;
    const pw = pill.offsetWidth, ph = pill.offsetHeight;
    pill.style.left = Math.max(4, Math.min(innerWidth - pw - 4, e.clientX - ox)) + "px";
    pill.style.top = Math.max(4, Math.min(innerHeight - ph - 4, e.clientY - oy)) + "px";
    pill.style.right = "auto"; pill.style.bottom = "auto";
    e.preventDefault();
  });
  const pointerUp = (): void => {
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

/** Remove the widget and its global listeners. */
export function unmount(): void {
  try {
    document.removeEventListener("pointerdown", outsideClick, true);
    box.remove();
    pill.remove();
  } catch { /* ignore */ }
}
