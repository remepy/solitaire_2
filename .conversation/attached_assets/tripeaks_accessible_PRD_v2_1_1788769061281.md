# PRD — Accessible TriPeaks Solitaire for PwPD (Mobile Web)

Version 2.0 · Working title: TriPeaks PwPD (rename later)
Target builder: Replit (single-page mobile web app) — **rebuild from scratch; do not reuse the v1 codebase.**
Provided code to import, not rewrite: `solver.js` + `test.js` (§5) and the `rotate-phone-overlay` module (§2.1).
Primary language: **Hebrew** (right-to-left). All UI copy is specified in §9; English is a secondary, switchable language.

### What changed from v1.0 (read this first)

| | v1.0 (shipped, rejected) | v2.0 (this document) |
|---|---|---|
| Board | 19 cards, 2 peaks, rows 2/4/6/7 | **28 cards, 3 peaks, rows 3/6/9/10 — the classic TriPeaks board** |
| Stock | 24 | **23** (28 + 1 + 23 = 52) |
| Orientation | Portrait only | **Landscape only** |
| Card size | 48 × 68 pt | **70 × 98 pt** (≈2× the area) |
| Deal source | External deal service (`2p4r19`) + local fallback | **Bundled solver module (`3p4r28`), runs in the client — no external service** |
| Language | English only | **Hebrew first (RTL), English secondary** — see §9 |

Reason for the change: playtesting v1 showed the 19-card board is solid but not engaging — too few stacks means too few decisions per turn. The classic 28-card board restores the original game's depth, and going landscape-only is what makes 28 cards fit at PwPD-friendly tap sizes. Everything else (tap-only input, tremor forgiveness, wildcard, solvable deals, accessibility, scoring) carries over unchanged unless noted; the solvable-deal logic now ships inside the app instead of as a separate service (§5).

---

## 1. Product overview

A TriPeaks-style solitaire game designed for players with Parkinson's disease (PwPD) and anyone with limited fine-motor control. Every design decision optimizes for: large tap targets, zero drag gestures, zero time pressure, and forgiving input.

This v2 ships **one game mode only**: the classic 28-card, three-peak TriPeaks board, played in landscape so that every card is at least 70 × 98 pt on a phone.

### Goals
- Fully playable with single taps only, with the phone held in landscape, propped, or resting flat.
- Every interactive element ≥ 44 pt effective hit area; tableau cards ≥ 74 × 98 pt.
- Gameplay depth equal to classic TriPeaks (~50% win rate for a reasonable player; see §12 for the measured reference).
- A complete round takes 3–5 minutes.

### Non-goals (v2)
- No portrait layout, no alternative board sizes, no multiplayer, no accounts, no monetization, no timers or time-based scoring of any kind.

---

## 2. Platform & orientation

- **Mobile web app built with React + TypeScript** (no native wrappers). React is required because the portrait-overlay module in §2.1 is a React component; a vanilla-JS build is acceptable only if the builder ports that module faithfully (same detection logic, same behaviour).
- **Landscape only. Phones only.** Reference viewport: **844 × 390 pt** (iPhone-class landscape). Layout must scale fluidly from **640 × 320 pt** to **932 × 430 pt**. On tablets and desktop, center the board in a max-width **932 pt** column, vertically centered, and keep the 844:390 proportions — do not stretch the layout to fill a tablet.
- If the device is in portrait, pause the game and show the full-screen rotate overlay described in §2.1. **Never reflow the board to portrait.** Game state is preserved across the rotation.
- Respect the landscape safe area (`env(safe-area-inset-*)`): the notch side and the home indicator must never overlap a tap target. The 54 pt horizontal margins and 22 pt bottom margin in §7 are the minimums that satisfy this on current iPhones.
- Must work in Safari iOS and Chrome Android. Disable double-tap-to-zoom and pinch-zoom inside the game area (`touch-action: manipulation`), but do NOT block OS-level accessibility zoom.

### 2.1 Portrait overlay — provided module `rotate-phone-overlay`

The "please rotate" behaviour is **not to be written from scratch**. Use the provided module (three files: `useIsRotated.ts`, `PortraitOverlay.tsx`, `portrait-overlay.css`; see its README for usage). Copy the files into the project unchanged except for the adaptations listed below.

**What the module does (keep as-is):**
- `useIsRotated()` returns `true` when a **touch device** is held in portrait. It prefers `screen.orientation.type` and falls back to `innerWidth < innerHeight`, listening to `screen.orientation` change, `matchMedia("(orientation: portrait)")`, `resize` and `orientationchange`. Do not replace this with a single `resize` listener — the multi-signal approach is what makes it reliable on iOS Safari.
- On non-touch devices (desktop) it always returns `false`, so desktop browsers never see the overlay — consistent with the centered-column behaviour above. Tablets are touch devices, so a tablet in portrait **does** get the overlay.
- `<PortraitOverlay visible={isPortrait} message="…" />` renders a fixed, full-screen (`z-index: 9999`) panel with an animated rotating-phone icon and a message, using `role="status"` + `aria-live="polite"`.

**Required adaptations (the module's defaults conflict with this PRD):**

| Module default | Required for v2 | Why |
|---|---|---|
| Message is Hebrew (`סובבו את הטלפון למצב מאוזן`), `direction: rtl` | **Keep the Hebrew default.** Pass `message={t("rotate.prompt")}` so the English build shows "Please turn your phone sideways"; set `direction` from the active language (§9) instead of the hard-coded `rtl` | Hebrew first, English switchable (§9) |
| Icon `384 × 384 px`, text `40 px`, padding `32 px` | Icon `width: min(55vw, 220px)`, text `clamp(22px, 6vw, 32px)` | 384 px + padding overflows a 390 pt portrait phone |
| Icon rotates in an **infinite loop** | Wrap `animation` in `@media (prefers-reduced-motion: no-preference)`; under reduced motion show the icon static, already rotated to −90° | §8 reduced-motion requirement; also applies when the in-app Reduced-motion setting is on |
| Colours `#1a1a2e` bg / `#f59e0b` icon / `#fff` text | Felt green bg (§10), gold icon, cream text — via the CSS variables the README suggests | Visual consistency; keep ≥ 4.5:1 text contrast |
| Only hides the board visually | While `isPortrait` is `true` the game must also **pause**: ignore all input, freeze in-flight animations, do not start the hint/undo debounce timers, and mark the game root `inert` (or `aria-hidden="true"`) so focus and screen-reader traversal cannot reach the board | Overlay alone does not stop state changes |
| — | Announce once via the existing `aria-live` region: `a11y.paused` on entering portrait and `a11y.resumed` on returning to landscape (strings in §9.4) | §8 announcements |

Game state is never reset by an orientation change: the tableau, stock, waste, score and streak are exactly as before when the overlay disappears. The module's 0.25 s fade-in is fine; no exit animation is required.

---

## 3. Game rules

### 3.1 Board structure (fixed — classic TriPeaks)

28 tableau cards in a three-peak layout, 4 rows. Cards are indexed 0–27, left to right within each row, top row first:

| Row | Card indices | Count | Facing at deal | Horizontal position u |
|---|---|---|---|---|
| 0 (apexes) | 0, 1, 2 | 3 | face-down | 1.5, 4.5, 7.5 |
| 1 | 3, 4, 5, 6, 7, 8 | 6 | face-down | 1, 2, 4, 5, 7, 8 |
| 2 | 9–17 | 9 | face-down | 0.5, 1.5, 2.5, … , 8.5 |
| 3 (bottom) | 18–27 | 10 | face-up | 0, 1, 2, … , 9 |

Horizontal position: `x = margin + u × pitch`. Rows overlap vertically; each row sits lower than the one above and is drawn on top of it (see §7).

### 3.2 Coverage graph (which cards block which)

A card is **uncovered** (playable) only when both cards listed below have been removed. Implement exactly this mapping (`coveredBy[cardIndex] = [blockerLeft, blockerRight]`):

```
// apexes
coveredBy[0]  = [3, 4]
coveredBy[1]  = [5, 6]
coveredBy[2]  = [7, 8]
// row 1
coveredBy[3]  = [9, 10]
coveredBy[4]  = [10, 11]
coveredBy[5]  = [12, 13]
coveredBy[6]  = [13, 14]
coveredBy[7]  = [15, 16]
coveredBy[8]  = [16, 17]
// row 2
coveredBy[9]  = [18, 19]
coveredBy[10] = [19, 20]
coveredBy[11] = [20, 21]
coveredBy[12] = [21, 22]
coveredBy[13] = [22, 23]
coveredBy[14] = [23, 24]
coveredBy[15] = [24, 25]
coveredBy[16] = [25, 26]
coveredBy[17] = [26, 27]
// bottom row starts uncovered
coveredBy[18..27] = []
```

General rule the table encodes: a card at (row r, position u) is covered by the cards at (r+1, u−0.5) and (r+1, u+0.5). The bundled `solver.js` module (§5) is the normative source of this array; the game logic must import it from there rather than re-typing it (acceptance criterion 2).

A face-down card flips face-up (with animation, see §10) the moment it becomes uncovered.

### 3.3 Deck, stock, waste

- Standard 52-card deck, no jokers (wildcard handled separately, §4).
- Deal: 28 cards to the tableau (indices 0–27 in deal order), 1 card to the **waste** pile face-up, **23 cards to the stock** face-down. **No cards are left over** — the whole deck is in play, exactly as in classic TriPeaks.
- Stock has **no redeals**.

### 3.4 Play rules

- The player may tap any **uncovered, face-up tableau card** whose rank is exactly one above or one below the current waste card. **Suit and color are irrelevant.**
- Rank adjacency **wraps**: A↔2, A↔K (so an Ace can be played on a King or a 2, and vice versa).
- A played card moves to the top of the waste pile and becomes the new reference card.
- Tapping the stock flips its top card onto the waste (this breaks the current streak, §11).
- **Win:** all 28 tableau cards removed (stock remainder is irrelevant).
- **Lose:** stock is empty AND no legal tableau move exists AND the waste card is not a wildcard.
- On lose, offer `btn.replay` ("שוב אותה חלוקה") and `btn.newDeal` ("חלוקה חדשה") — both as large buttons. Never shame the player (`end.lose` "אין עוד מהלכים" is fine; no red flashing, no sad sounds by default).

---

## 4. Wildcard (random occurrence) — unchanged from v1

- With probability `WILD_CHANCE` (default **0.4**, config constant), the deal includes **exactly one wildcard**; otherwise the deal has none. Never more than one per deal.
- When present, the wildcard **takes one of the 23 stock slots** at a uniformly random position: the stock then holds 22 rank cards + 1 wild, and the displaced rank card is set aside unused and never shown. The stock is always exactly 23 cards long, so the stock counter and the difficulty curve are identical with or without a wild.
- When the wildcard is drawn from the stock to the waste, it is announced ("Wild card!") and **any uncovered tableau card may be played on it**.
- Visual: distinct card face (star symbol, gold treatment), clearly not a rank card.
- The wildcard is never dealt into the tableau or the initial waste.
- Wildcard presence and placement are decided by the deal generator in `solver.js` (§5), never by separate client-side logic.

---

## 5. Deal source — bundled solvable-deal module (no external service)

Every deal must be **pre-verified winnable**. In v2 this is done **inside the game client**: the provided `solver.js` module (zero dependencies, plain JavaScript, board `3p4r28`) is bundled with the app and called at the start of each round. There is **no network call, no external service, no fallback path** — the game is fully self-contained and works offline once loaded.

### 5.1 Module contract

`solver.js` exports:

```js
generateSolvableDeal(wildMode = "auto")   // → { attempts, deal }
isSolvable(tableauRanks, stockRanks, wasteRank) // → boolean (exact solver)
coveredBy                                  // the 28-entry coverage graph (§3.2)
BOARD, STOCK_SIZE, WILD_CHANCE             // "3p4r28", 23, 0.4
```

`deal` shape (unchanged from the v1 service contract):

```json
{
  "deal_id": "string",
  "verified_solvable": true,
  "tableau": ["6C","8D","KS", "... 28 card codes, index order 0-27"],
  "stock": ["4H","JD","WILD","... 23 entries, draw order = last element drawn first"],
  "waste": "7H"
}
```

- Card codes: rank `A,2..10,J,Q,K` + suit `S,H,D,C` (e.g. `10H`, `AS`). Wildcard code: `WILD`, at most once, only ever in `stock`.
- `wildMode`: `"auto"` (default, 40%), `"always"`, `"never"`. The game always uses `"auto"`; the other two exist for QA and debug menus.
- The module is CommonJS (`module.exports`). The builder may convert it to an ES module or wrap it — but must not alter the solver logic, the coverage graph, or the constants.

### 5.2 Integration requirements

- Call `generateSolvableDeal()` on "New deal"; keep the returned `deal` object so "Replay this deal" can restore it exactly.
- Generation takes ~15–25 ms on a laptop and should stay well under 200 ms on a mid-range phone. Run it synchronously on tap, or in a Web Worker if the builder prefers; either way, show the shuffle/deal animation while it runs so no spinner is needed.
- `generateSolvableDeal` throws only if 500 consecutive shuffles are unsolvable (probability effectively zero at the measured 97.9% solvable rate). If it ever does, catch the error and fall back to an unverified uniform shuffle so the player is never blocked.
- `test.js` (included) must pass in the builder's environment before the game is wired to the module.
- The former HTTP wrapper (`server.js`) is **not part of v2** and must not be deployed; its request/response contract is preserved by the `deal` shape above so an external service can be reintroduced later without touching game logic.

---

## 6. Interaction — tap only, tremor-forgiving (unchanged from v1)

**There are no drag gestures anywhere in the app.** Every function is a single tap: play a card, draw from stock, use wildcard flow, undo, hint, menu, settings toggles.

Input forgiveness (all required):

1. **Debounce:** after any successful tap, ignore further taps on the same element for 300 ms (`DEBOUNCE_MS`). Prevents tremor double-taps from, e.g., drawing two stock cards.
2. **Slop tolerance:** a touch that moves < 24 pt between touch-start and touch-end counts as a tap (tremor during contact must not cancel the action).
3. **Extended hit areas:** each tableau card's tappable area extends beyond its visual bounds to the full pitch cell (§7). Hit-testing resolves to the **topmost uncovered card** whose cell contains the point; among overlapping candidates, *legal* cards win over illegal ones, and covered (face-down) cards are never hit targets.
4. **Tap feedback within 100 ms:** visual response (card lift/brighten) even before the move animation completes.
5. **Illegal tap = gentle feedback, zero penalty:** a soft wiggle of the tapped card and a brief highlight of the waste card. No sound by default, no score change, no error modal.
6. **Unlimited free undo** (`Undo` button): reverses one action per tap, including stock draws and wildcard plays. No count limit, no score penalty beyond recomputing the score as if the action hadn't happened.
7. **Hint button:** highlights one currently legal card (prefer the one that unblocks the most face-down cards — same heuristic as §12). Free, unlimited.

---

## 7. Layout spec (landscape, 844 × 390 pt reference)

All values scale proportionally with viewport **width** (treat as fractions of 844). A layout sheet matching this spec is provided (`tripeaks_v2_landscape_28_layout.svg`) — **it is drawn in LTR; in the default Hebrew (RTL) build the header and controls band are mirrored**, as described in §9.2. Positions below are given as LTR x-values with their logical (start/end) meaning; implement with CSS logical properties so the mirror is automatic.

| Element | Spec |
|---|---|
| Card size | **70 × 98 pt** visual; corner radius 7 pt |
| Horizontal pitch | **74 pt**; left margin **54 pt**; `x(u) = 54 + 74u` (10 bottom cards span 736 pt, centered) |
| Row vertical pitch | **32 pt**; tableau top **46 pt**; `y(r) = 46 + 32r` (≈33% of each buried card remains visible; every uncovered card is fully exposed) |
| Draw order | Row 0 at the back, row 3 in front; within a row, left to right |
| Effective card hit area | ≥ **74 × 98 pt** (full pitch cell) for any uncovered card |
| Header strip | 0–46 pt: score at the **inline-start** edge (LTR x = 54), streak centered, menu (⚙) ≥ 44 × 44 pt at the **inline-end** edge (LTR x = 746) |
| Controls band | 248–368 pt (120 pt tall), shared by stock, waste and buttons — see below |
| Stock | Card stack at the **inline-start** edge (LTR x = 54), y = 259 (70 × 98); **oversized 100 × 110 pt tap zone** (subtle dashed outline); count badge showing remaining cards |
| Waste card | Enlarged **72 × 100 pt**, 122 pt inline-start-ward of the stock (LTR x = 176), y = 258 |
| Undo / Hint buttons | Pill buttons **150 × 58 pt**, centered vertically in the controls band, at the **inline-end** side: Undo first in reading order (LTR x = 466), Hint at the edge (LTR x = 640); 24 pt gap; outer edge aligned to the 54 pt margin |
| Wildcard indicator | When drawn, the wild IS the waste card; no separate button in v2 |
| Bottom safe margin | 368–390 pt: nothing interactive (home indicator) |
| Tableau | **Never mirrored.** Card indices 0–27 are physical left-to-right positions in both languages (the board is symmetric; the coverage graph is physical) |

Scaling check: at the smallest supported viewport (640 × 320) cards are 53 × 74 pt and pills 114 × 44 pt — still at or above the 44 pt minimum. At 932 × 430 cards are 77 × 108 pt.

---

## 8. Accessibility requirements (hard requirements, not nice-to-haves) — unchanged

- **No timers, no countdowns, no moves-per-minute mechanics anywhere.**
- WCAG 2.1 AA contrast minimum; card ranks rendered ≥ 22 pt bold with both rank and suit glyph (larger cards allow larger type than v1); red/black suits must also differ by glyph shape — never rely on color alone.
- **Legal-move glow:** all currently playable cards get a high-visibility outline (default ON, can be disabled in settings).
- **Reduced-motion setting** (also respect `prefers-reduced-motion`): replaces all movement animations with cross-fades.
- **Sound OFF by default**; optional gentle audio feedback toggle.
- Text size setting: Normal / Large (Large scales rank text and UI labels ×1.3; board geometry unchanged). Hebrew glyphs have no ascenders/descenders comparable to Latin, so Hebrew UI text renders visually smaller at the same `font-size` — set the Hebrew base size 1 step larger (see §9.3).
- Color themes: default high-contrast dark felt; one light theme; one colorblind-safe check on the glow color (use outline + slight scale-up, not color alone).
- All buttons have `aria-label`s; game state changes announced via a polite `aria-live` region using the `a11y.*` strings in §9.4 (e.g. "שיחקתם שמונה יהלום", "ג'וקר!", "אין מהלכים — הקישו על החפיסה", "פסגה נוקתה!"). The `<html>` element carries `lang` and `dir` matching the active language so VoiceOver/TalkBack pick the correct speech engine.

---

## 9. Language, direction & copy — Hebrew first

The game is built for Hebrew-speaking players. Hebrew is the **default and primary** language and right-to-left is the default layout direction; English is a secondary language switchable in Settings. Both must be complete at launch — no partially translated screens.

### 9.1 i18n architecture

- One string table per language (`he.json`, `en.json`), keyed as in §9.4. Components call `t(key, params)`; **no user-visible literal strings in JSX**. Card rank/suit glyphs on card faces are *not* strings (see §9.3).
- `DEFAULT_LANG = "he"`. On first launch the app starts in Hebrew regardless of browser locale; the player can switch in Settings, and the choice is persisted (§11). (Auto-detecting `navigator.language` was considered and rejected: the target users are Israeli PwPD patients, many using devices set to English.)
- Language switch sets `document.documentElement.lang` and `dir` (`he`/`rtl`, `en`/`ltr`) and re-renders in place — game state is untouched.
- Numbers (score, streak multiplier, stock count) use Western digits in both languages, formatted with `Intl.NumberFormat("he-IL")` / `("en-US")` — output is identical ("2,880") but the locale keeps the code honest. Wrap every number that sits inside Hebrew text in `<bdi>` so bidi reordering can never split "×3" or "2,880".

### 9.2 RTL layout rules

- Implement all horizontal positioning in §7 with **CSS logical properties** (`inset-inline-start`, `margin-inline-end`, `padding-inline`, `text-align: start`, flex/grid with default direction). Never hard-code `left`/`right` for UI chrome. Then `dir="rtl"` mirrors the interface automatically.
- **Mirrored in Hebrew:** the header (score at the right edge, menu at the left), the controls band (stock and waste at the right, Undo/Hint pills at the left — Undo nearer the centre, Hint at the edge, preserving reading order), settings and end-of-round panels, and the card-play arc (which simply follows the waste position).
- **Not mirrored:** the tableau. Card indices 0–27 stay physical left-to-right in both languages, the coverage graph is physical, and rank/suit corner indices stay where they are on a real playing card (rank at top-left of the card face). Cards are objects, not text.
- Icons: the ⚙ menu glyph and the rotating-phone icon in the overlay are direction-neutral; the Undo icon (↶) **must flip** to ↷ in RTL (`transform: scaleX(-1)` under `[dir="rtl"]`), since "back" points the other way.
- The layout sheet `tripeaks_v2_landscape_28_layout.svg` is drawn LTR for measurement clarity; the Hebrew build is its horizontal mirror for header and controls only.

### 9.3 Typography

- **UI font:** a webfont with full Hebrew + Latin coverage and hyperlegible forms. Preferred: **Heebo** (Hebrew-first design, pairs with Latin at equal x-height); acceptable: **Assistant** or **Rubik**. Fallback stack: `"Heebo", -apple-system, "SF Hebrew", "Noto Sans Hebrew", Arial, sans-serif`. Atkinson Hyperlegible has no Hebrew glyphs — do not use it for UI text.
- **Card faces:** rank and suit glyphs stay in the international convention used on Israeli decks — `A 2 3 4 5 6 7 8 9 10 J Q K` with `♠ ♥ ♦ ♣`. These are pictorial symbols, identical in both languages, and are rendered in a Latin-capable font at ≥ 22 pt bold (§8). Hebrew letters on card faces were considered and rejected: not a convention players know.
- **Size:** Hebrew letterforms sit within a smaller visual box than Latin (no ascenders, shallow descenders). Set the Hebrew base UI size to 18 pt where English uses 16 pt, and button labels to 20 pt (English 18 pt); the Large text setting multiplies both by 1.3. Pill buttons (150 × 58 pt) comfortably fit the longest Hebrew label ("שוב אותה חלוקה" at 20 pt ≈ 128 pt).
- Line-height ≥ 1.4 for any Hebrew paragraph (settings help text, end panels) so nikkud-free text still has breathing room.
- Never use `text-transform`, `letter-spacing` > 0, italics or faux-bold on Hebrew text.

### 9.4 String table (Hebrew primary, English secondary)

Hebrew UI uses the **plural imperative** ("סובבו", "הקישו") — the standard gender-neutral register in Israeli product copy; the overlay module already follows it. Card names in speech use the Israeli spoken form "<rank> <suit>" (e.g. "שמונה יהלום"), with the wildcard called **ג'וקר** — the term players know.

| Key | Hebrew (default) | English |
|---|---|---|
| `hud.score` | ניקוד | Score |
| `hud.streak` | רצף ×{n} | Streak ×{n} |
| `hud.stockCount` | {n} | {n} |
| `btn.undo` | ביטול | Undo |
| `btn.hint` | רמז | Hint |
| `btn.menu` (aria) | הגדרות | Settings |
| `btn.newDeal` | חלוקה חדשה | New deal |
| `btn.replay` | שוב אותה חלוקה | Replay this deal |
| `btn.resume` | המשך | Resume |
| `end.win` | ניקיתם את שלוש הפסגות! | You cleared all three peaks! |
| `end.lose` | אין עוד מהלכים | No more moves |
| `end.score` | ניקוד סופי: {n} | Final score: {n} |
| `rotate.prompt` | סובבו את הטלפון למצב מאוזן | Please turn your phone sideways |
| `settings.title` | הגדרות | Settings |
| `settings.language` | שפה | Language |
| `settings.language.he` | עברית | עברית |
| `settings.language.en` | English | English |
| `settings.glow` | הדגשת מהלכים אפשריים | Highlight legal moves |
| `settings.motion` | הפחתת אנימציות | Reduce motion |
| `settings.sound` | צלילים | Sounds |
| `settings.textSize` | גודל טקסט | Text size |
| `settings.textSize.normal` | רגיל | Normal |
| `settings.textSize.large` | גדול | Large |
| `settings.theme` | ערכת נושא | Theme |
| `settings.theme.dark` | כהה | Dark |
| `settings.theme.light` | בהיר | Light |
| `a11y.played` | שיחקתם {card} | Played {card} |
| `a11y.drew` | נמשך {card} מהחפיסה | Drew {card} from the deck |
| `a11y.wild` | ג'וקר! אפשר לשחק כל קלף פתוח | Wild card! Any open card can be played |
| `a11y.noMoves` | אין מהלכים — הקישו על החפיסה | No moves — tap the deck |
| `a11y.peak` | פסגה נוקתה! | Peak cleared! |
| `a11y.undo` | המהלך בוטל | Move undone |
| `a11y.hint` | רמז: {card} | Hint: {card} |
| `a11y.illegal` | אי אפשר לשחק את הקלף הזה עכשיו | That card can't be played right now |
| `a11y.paused` | המשחק מושהה — סובבו את הטלפון למצב מאוזן | Game paused — turn your phone sideways to continue |
| `a11y.resumed` | המשחק ממשיך | Game resumed |
| `a11y.stock` (aria-label) | חפיסה, נותרו {n} קלפים | Deck, {n} cards left |
| `a11y.waste` (aria-label) | קלף פתוח: {card} | Current card: {card} |
| `a11y.cardFaceDown` | קלף הפוך | Face-down card |
| `card.rank.A` | אס | Ace |
| `card.rank.J` | נסיך | Jack |
| `card.rank.Q` | מלכה | Queen |
| `card.rank.K` | מלך | King |
| `card.rank.2`–`10` | שתיים, שלוש, ארבע, חמש, שש, שבע, שמונה, תשע, עשר | Two … Ten |
| `card.suit.S` | עלה | Spades |
| `card.suit.H` | לב | Hearts |
| `card.suit.D` | יהלום | Diamonds |
| `card.suit.C` | תלתן | Clubs |
| `card.wild` | ג'וקר | Wild card |
| `card.name` (pattern) | {rank} {suit} | {rank} of {suit} |

`{card}` is produced by `card.name`: Hebrew "שמונה יהלום", English "Eight of Diamonds". The Hebrew copy above is final for v2 unless changed by the product owner; do not machine-translate additional strings — add any new key to this table first.

---

## 10. Visual & motion design

- Aesthetic: calm, warm, uncluttered "premium tabletop" feel. Deep felt-green background (#1F4E46 family), cream cards (#F7F1E3), indigo card backs with a diagonal-line pattern, soft gold accents for the wildcard and stock badge. No busy backgrounds behind the tableau.
- Card flip (face-down → face-up): 250 ms 3D flip; card play: 300 ms arc to the waste pile. Under reduced motion: 150 ms cross-fade.
- Win celebration: gentle — cards cascade softly + `end.win` panel ("ניקיתם את שלוש הפסגות!") with score. No strobe effects, no screen shake (vestibular safety).
- Typography: see §9.3 — Hebrew requires a font with full Hebrew coverage; Atkinson Hyperlegible (v1 suggestion) has none and must not be used for UI text.

---

## 11. Scoring & feedback (no time pressure)

- +100 per tableau card played, multiplied by current **streak**: consecutive tableau plays without drawing from stock increment the multiplier (×1, ×2, ×3… capped at ×5). Drawing from stock resets streak to ×1. Wildcard play **preserves** the streak (design intent: reward using it, don't punish).
- **Peak-clear bonus: +500 each time an apex card (index 0, 1 or 2) is removed** — three peaks, so up to +1,500 — plus **+1,000** for clearing the whole board.
- Score is per-round; keep all game state in memory (no localStorage for game state; persistent stats are out of scope for v2). **Exception:** the settings object (language, text size, theme, glow, reduced motion, sound) may be persisted in localStorage so a player does not have to re-select Hebrew/English or Large text every visit.

---

## 12. Config constants & reference difficulty

```
BOARD            = "3p4r28"   // fixed in v2
STOCK_SIZE       = 23
WILD_CHANCE      = 0.4
DEBOUNCE_MS      = 300
TAP_SLOP_PT      = 24
STREAK_CAP       = 5
LEGAL_GLOW_ON    = true
DEFAULT_LANG     = "he"     // "he" | "en"; see §9.1
```

The hint heuristic and any future auto-solver share one function: among legal moves, prefer the card whose removal uncovers the most face-down cards; break ties randomly.

Reference difficulty (measured with the bundled solver on 1,000 random deals per row — for QA sanity checks, not a product requirement):

| Configuration | Solvable by perfect play | Greedy-heuristic win rate |
|---|---|---|
| 28 cards, stock 23, no wild | 97.9% | 48.9% |
| 28 cards, stock 23, with wild | 99.6% | 53.9% |

The greedy win rate matches the classic-TriPeaks reference (~50%) that the v1 board was tuned against, so difficulty is unchanged while decisions-per-turn roughly doubles. Note that almost every random 28-card deal is solvable in principle, so `verified_solvable` mainly guarantees "no dead deals"; grading deals by solver effort is the future lever for easy/medium/hard tiers (out of scope).

---

## 13. Acceptance criteria

1. A full game is winnable and losable per §3 rules; wrap-around adjacency (A–K, A–2) verified by test.
2. Coverage graph matches §3.2 exactly (unit test the 28-entry mapping against the array in `solver.js`).
3. Zero drag listeners in the codebase; all interactions pass a tap-only audit.
4. Rapid double-tap on stock draws exactly one card (debounce test).
5. Wildcard appears in ~40% of local deals over 500 simulated deals (±5%); stock length is 23 in every deal, with or without a wild; the full 52-card deck is accounted for (28 + 1 + 23, or 28 + 1 + 22 + WILD + 1 set aside).
6. `solver.js` is imported unmodified and `test.js` passes; every new round calls `generateSolvableDeal` and consumes its output correctly (28 tableau codes, 23 stock entries, last element drawn first); the app makes zero network requests after initial load.
7. Portrait orientation on a touch device shows the provided `PortraitOverlay` (Hebrew message by default, English when the language is switched; sized to fit a 390 pt-wide screen) and pauses the game — taps on the board underneath have no effect; returning to landscape resumes exactly where the player left off, with no state change. Desktop browsers never show the overlay.
8. At the 844 × 390 reference viewport all interactive elements measure ≥ 44 pt effective hit area and tableau cards ≥ 74 × 98 pt; at 640 × 320 nothing falls below 44 pt; no tap target overlaps the safe-area insets.
9. `prefers-reduced-motion` honored, including the overlay icon (no looping animation under reduced motion); app usable with sound off (default).
10. Undo fully reverses any sequence of 10 mixed actions in test.
11. Removing each apex awards +500 exactly once; clearing the board awards +1,000 in addition.
12. First launch renders in Hebrew with `<html lang="he" dir="rtl">`; the header and controls band are mirrored relative to the LTR layout sheet while tableau card positions are identical; every user-visible string comes from the string table (no hard-coded literals in components — audit by grepping JSX for Hebrew/English text); switching to English flips `lang`/`dir` and all strings without reloading or resetting the game.
13. Score and streak digits render as Western digits in both languages and are wrapped in `<bdi>`; rank/suit glyphs on cards are identical in both languages.
14. VoiceOver (iOS, Hebrew voice) reads a card play announcement as natural Hebrew (e.g. "שיחקתם שמונה יהלום") — verified manually on device.

---

## 14. Out of scope for v2 (do not build)

Portrait layout, tablet-optimized layout, alternative board sizes (19-card, 16-card), difficulty tiers, an external deal service / server-side deal control, daily challenges, ads, IAP, accounts, leaderboards, haptics, languages other than Hebrew and English, Arabic/other RTL scripts, offline PWA packaging.
