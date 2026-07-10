# Live Trading Coach — in-terminal overlay

Working prototype that runs the behavioural coach **inside the live Libertex web terminal**
(desktop `app.libertex.org` or mobile `/m`), reacting to real trades in real time.
This is the closest thing to how the real product (CPattern Guardian Angel) works — an overlay in the platform.

## Files
- [`trading-coach-inject.js`](trading-coach-inject.js) — self-contained inject script (v2.2). Paste into the browser console on a logged-in Libertex tab.

## How it works
1. **Baseline** — on start it reads your current closed-trades history as a baseline (for personal averages) and remembers the trade IDs it has already seen.
2. **Poll** — every 15 s it calls the same API the app uses:
   `GET /spa/report/closed-positions?page=1&pageSize=100&order=CloseTime&orderDir=desc` (same-origin, session cookies).
3. **Per-trade card** — for every *new* closed trade it shows an expanded comment:
   - P&L as **% of account balance** (read from `.spare-cash`) → sizes the result to risk ("небольшой" vs "существенный").
   - **Leverage amplification**: `price move % × multiplier → % of margin`, plus distance to margin call (`≈ 100 / mult %`).
   - Detected **behavioural patterns**: revenge-after-loss, no stop-loss, oversized margin, high concentration, streaks, long-held losers.
   - Rotating phrasings so consecutive comments don't repeat.
4. **AI Trading Review** — every 10 new trades: a Guardian-Angel-style review with 6 prose sections
   (Style · Parameters · Momentum · Risk patterns · Greed & Fear · Progress) + 3 scores (Consistency / Discipline / Rational) + a #1 habit.

## Data model (discovered from the terminal)
| field | meaning |
|---|---|
| `sumInv` | margin / own funds invested (capital at risk) |
| `mult` | multiplier / leverage |
| `sumInv × mult` | position volume (notional, the "Объём") |
| `equityInv` | equity returned at close → **P&L = equityInv − sumInv** |
| `direction` | `growth` = Buy, `reduction` = Sell |
| `stopLossPrice` | null ⇒ trade had no stop-loss |

Two risk dimensions the coach reasons about:
- **Size / capital at risk** = `sumInv / balance` (max you can lose on the trade).
- **Fragility / leverage** = `mult` → a `~100/mult %` adverse move wipes the margin.

## Limitations
- Client-side prototype: lives in page memory, a hard reload removes it (re-paste to restore).
- **Position top-ups (доливки) are not detectable** from the closed-positions API — the record has no add/operations field. A per-deal operations endpoint would be needed.
- Production version would be a server-side integration on the closed-positions feed, keyed by account id, not a console inject.
