---
name: Tutorial & board layering decisions
description: Non-obvious choices behind the first-run tutorial (bubble anchoring, gating placement, pointer layers) and a test.js gotcha.
---

## Bubble anchoring in English does NOT mirror the spec table for card targets
The spec gives bubble boxes in RTL and says "LTR mirrors". Only the stock bubble mirrors; step 1/3 bubbles keep their x.
**Why:** the tableau is a physical, never-mirrored layer, so a mirrored step-1 box would sit ~200px away from card 20 with the tail clamped off-target. A code reviewer flagged this; the decision was kept deliberately after e2e confirmed tails point at the real elements in both languages.
**How to apply:** if new bubbles are added, mirror by language only when the anchored element itself mirrors (stock/waste), never for tableau cards.

## Where tutorial logic lives (user-stated constraints)
- Tutorial deal loads through the same `loadDeal` path as generated deals; the overlay only reads state.
- Steps advance from game move events (`lastMove` with a seq counter), never from tap handlers; input gating sits in the board's tap handler, not in the overlay.
- `tutorialSeen` is persisted exactly on entering HANDOFF (abandoning earlier re-runs the tutorial next launch).

## Full-frame layers must be pointer-transparent
The tableau container spans the whole 844×390 frame and sits after the header in DOM order; without `pointer-events: none` it swallowed real clicks on the ⚙ button (programmatic `.click()` still worked, which hid the bug in earlier tests). Cards manage their own pointer-events.
**How to apply:** any new full-frame layer (overlays, dim masks) should be pointer-transparent unless it owns a real control.

## Provided solver test.js was not runnable
The supplied `test.js` mixed `require` with ESM and had an `import {...} = ` typo; it was fixed to plain ESM and extended with tutorial-deal assertions. Run with `node src/lib/test.js`.
Solver `isSolvable` consumes `stock[0]` first while the game/JSON deals draw from the END of the array — reverse before calling the solver.
