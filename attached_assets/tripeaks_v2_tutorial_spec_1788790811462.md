# TriPeaks PwPD v2 — First-run Tutorial Spec (for Replit)

Companion to `tripeaks_accessible_PRD_v2.md` §10. This file is self-contained: it assumes the game itself is built per the PRD and adds only the tutorial. Terms (waste, stock, coverage graph, legal-move glow, `t()` string table, RTL rules) are as defined there.

**Provided file:** `tutorial_deal.json` (in the solver module). Do not regenerate or edit it — `test.js` asserts its properties.

---

## 1. Concept

The first round is a **scripted, pre-verified deal** played on the real board. The board is dimmed except for the one element the player must tap; a coach bubble says what to do and why. **A step advances only when the player performs the correct action** — there are no "Next" buttons, no swiping, no timers. After three guided taps the tutorial hands off and the same round continues as a normal game.

Three taps teach the three rules:

| Step | Rule taught | Player taps |
|---|---|---|
| 1 | Play a card one higher/lower than the open card | the **8♣** (waste is 7♣) |
| 2 | No move? Draw from the deck | the **deck** (K♥ comes up) |
| 3 | Ace connects to King (wrap-around) | the **A♦** |
| 4 | Hand-off — normal play | anything; bubble closes |

---

## 2. The scripted deal

`tutorial_deal.json` has the standard deal shape plus a `script` block:

```json
{
  "deal_id": "3p4r28-tutorial",
  "verified_solvable": true,
  "tableau": ["4S","2C","8H","KD","5C","9C","2S","9D","8S","7S","6H","10S","9S","JD","6C","QS","6D","8D",
              "JS","10D","8C","4H","2H","AD","JC","10C","10H","KC"],
  "stock":   ["9H","5D","2D","KS","AH","4D","JH","3S","5H","7D","AS","QC","3C","QH","4C","AC","3D","QD","7H","5S","3H","6S","KH"],
  "waste":   "7C",
  "script":  { "step1_target": 20, "step2_draws": "KH", "step3_target": 23 }
}
```

- `tableau` is in board index order 0–27 (bottom row = 18–27, face-up). `stock`: **last element is drawn first** (so K♥ is the first draw). No wildcard.
- Load it through the **same code path** as a generated deal (`generateSolvableDeal` output has the identical shape minus `script`). The tutorial is a layer on top of a normal game, not a separate game mode.

Guaranteed board facts (asserted by `test.js`, rely on them):

| After | Waste | Legal tableau moves |
|---|---|---|
| deal | 7♣ | exactly one: index **20** (8♣) |
| step 1 | 8♣ | **none** → deck is the only action |
| step 2 (draw) | K♥ | exactly one: index **23** (A♦). K♣ (27) and 2♥ (22) are *not* legal |
| step 3 | A♦ | two: 22 (2♥) and 27 (K♣) — hand-off shows both glowing |

No card flips face-up before step 4 (indices 20 and 23 are not adjacent), and the full deal is solvable.

---

## 3. State machine

```
IDLE ──start()──▶ STEP1 ──(card 20 played)──▶ STEP2 ──(stock drawn)──▶ STEP3 ──(card 23 played)──▶ HANDOFF ──(«הבנתי» tapped OR any play)──▶ DONE
```

Rules:

1. **Advance on game state, not on tap.** Subscribe to the game's move events (`cardPlayed(index)`, `stockDrawn()`), never to the click handler. A tap the game rejected can therefore never advance the tutorial.
2. **Input gating.** In STEP1–STEP3 only the spotlit element is interactive. Every other tap runs the game's standard illegal-tap feedback (soft wiggle of the tapped element + brief waste highlight) — **no text, no modal, no counter.** Debounce (300 ms) and tap-slop (24 pt) apply to the target as in normal play.
3. **Disabled during STEP1–STEP3:** Undo, Hint, ⚙ (dimmed, `aria-disabled`). Re-enabled at HANDOFF. Undo then works normally, including undoing the Ace.
4. **HANDOFF** lifts the dim (150 ms fade; instant under reduced motion), shows all legal cards with the normal glow, and shows bubble 4 with a **«הבנתי»** button (≥ 150 × 58 pt). The bubble closes on that tap **or** on the player's next play — never block a player who just keeps going.
5. **Persistence.** Set `settings.tutorialSeen = true` on entering HANDOFF (not before). Abandoning earlier (tab closed) leaves it unset → tutorial runs again next launch.
6. **Rotation.** If the phone goes portrait, the PRD §2.1 overlay pauses everything; on return the tutorial resumes at the same step.
7. **Restart from settings.** ⚙ → «איך משחקים» starts the tutorial deal fresh. If a round is in progress, confirm first with `tut.confirmRestart` (two large buttons).

---

## 4. Coaching layer — visuals

- **Dim:** full-board overlay, `rgba(0,0,0,0.55)`, with **mask cut-outs** (12 pt radius, 8 pt padding around the element) for the spotlit elements. Dimmed cards stay faintly visible for context.
- **Spotlights per step:** STEP1 → target card **and** waste card (so the 7→8 relationship is visible). STEP2 → stock (use its full 100 × 110 tap zone as the cut-out). STEP3 → target card **and** waste card. HANDOFF → no dim.
- **Cut-out border:** 2 pt dashed gold (`#FFD166`), plus the target carries the normal legal-move glow (5 pt gold outline).
- **Coach bubble:** cream (`#F7F1E3`) rounded panel, 16 pt radius, numbered gold badge (1–3, 28 pt circle) at the reading-start corner, tail pointing at the target. Text 18 pt: first line **bold** (the action), second line regular (the rule). Max width ~390 pt.
- **Bubble placement:** over the face-down rows (dimmed anyway) for card targets; over the dimmed part of the controls band for the stock. **Never over a card the player might need to tap.** Bubble positions in RTL (LTR mirrors):

  | Step | Bubble box (x, y, w) in 844 × 390 pt | Tail points at |
  |---|---|---|
  | 1 | 60, 48, 370 | card 20 top edge |
  | 2 | 390, 150, 390 | stock top edge |
  | 3 | 230, 48, 300 | card 23 top edge |
  | 4 | centered, 60, 420 (+ button row) | — |

  Anchor to the real card/stock positions computed from the layout, not hard-coded pixels, so scaling and RTL/LTR mirroring keep the tails correct.
- **Motion:** step transitions cross-fade the dim mask and bubble in 150 ms; no bouncing arrows, no pulsing. Under reduced motion all transitions are instant.

Reference mockup: `tripeaks_v2_tutorial_interactive.svg` (step 1 full-size; steps 2–3 as thumbnails).

---

## 5. Accessibility

- When a step starts, send the step's **action line** to the existing polite `aria-live` region.
- The target element gets `aria-describedby` → the bubble's text node; move **focus** to the target so a switch/keyboard user can complete each step with one activation.
- Dimmed, non-interactive elements are `aria-disabled="true"` for the duration of the step (do not remove them from the tree — the layout must not shift).
- Bubble 4's «הבנתי» button is a real `<button>` and the first focusable element in HANDOFF.
- Nothing the tutorial teaches is load-bearing: the legal-move glow, hint button and `a11y.*` announcements cover the same rules in normal play.

---

## 6. Copy (string table keys)

Hebrew is the default; English is the secondary language. Add these to the game's string table. Plural imperative, as in the rest of the app.

| Key | Hebrew | English |
|---|---|---|
| `tut.s1.action` | הקישו על הקלף הזוהר | Tap the glowing card |
| `tut.s1.rule` | הוא גדול באחד מהקלף הפתוח (7) | It's one higher than the open card (7) |
| `tut.s2.action` | אין מהלך — הקישו על החפיסה | No move — tap the deck |
| `tut.s2.rule` | כדי לפתוח קלף חדש | to turn over a new card |
| `tut.s3.action` | אס מתחבר למלך! | An Ace connects to a King! |
| `tut.s3.rule` | הקישו על האס | Tap the Ace |
| `tut.s4.action` | עכשיו לבד — נקו את שלוש הפסגות | Now on your own — clear all three peaks |
| `tut.s4.rule` | אין לחץ זמן. ביטול ורמז תמיד זמינים | No time pressure. Undo and hints are always available |
| `tut.done` | הבנתי | Got it |
| `tut.confirmRestart` | להתחיל את ההדרכה מחדש? המשחק הנוכחי יאבד | Restart the tutorial? The current round will be lost |
| `settings.howToPlay` | איך משחקים | How to play |

The literal `(7)` in `tut.s1.rule` is correct — the deal is fixed. Do not add any other text to the tutorial.

---

## 7. Suggested implementation shape (React + TS)

```ts
type TutStep = "idle" | "step1" | "step2" | "step3" | "handoff" | "done";

// Derived from the game store — never from click handlers.
function useTutorial(game: GameStore, settings: Settings) {
  const [step, setStep] = useState<TutStep>(settings.tutorialSeen ? "done" : "idle");
  const script = tutorialDeal.script;

  // start: load the fixed deal through the normal path
  const start = () => { game.loadDeal(tutorialDeal); setStep("step1"); };

  // advance on state changes
  useEffect(() => game.on("cardPlayed", (i) => {
    if (step === "step1" && i === script.step1_target) setStep("step2");
    if (step === "step3" && i === script.step3_target) { setStep("handoff"); settings.set({ tutorialSeen: true }); }
    if (step === "handoff") setStep("done");
  }), [step]);
  useEffect(() => game.on("stockDrawn", () => { if (step === "step2") setStep("step3"); }), [step]);

  // what the coaching layer needs to render
  const allowed = { step1: [`card:${script.step1_target}`], step2: ["stock"], step3: [`card:${script.step3_target}`] }[step] ?? null; // null = everything
  const spotlight = { step1: [`card:${script.step1_target}`, "waste"], step2: ["stock"], step3: [`card:${script.step3_target}`, "waste"] }[step] ?? [];
  return { step, start, allowed, spotlight, dismissHandoff: () => setStep("done") };
}
```

- The game's tap handler checks `allowed` first: if the element is not in the list, run the illegal-tap feedback and return **before** any game-state change.
- `TutorialOverlay` renders the dim mask, cut-outs and bubble from `spotlight`/`step`; it reads element rectangles from the board layout (`getBoundingClientRect` or the layout model), so mirroring and scaling are free.
- Undo/Hint/⚙ read `step` and render disabled while `step` is `step1|step2|step3`.

---

## 8. Acceptance criteria (tutorial only)

1. First launch with `tutorialSeen` unset loads `tutorial_deal.json` and shows STEP1 with the 8♣ and the waste 7♣ spotlit; the rest of the board is dimmed.
2. Tapping any dimmed card, the stock, Undo, Hint or ⚙ in STEP1 produces the standard wiggle feedback, changes no game state, and does not advance the step.
3. Tapping the 8♣ plays it and advances to STEP2; tapping the deck advances to STEP3 with K♥ on the waste; tapping the A♦ advances to HANDOFF. Tapping K♣ or 2♥ in STEP3 is rejected.
4. In HANDOFF: dim is gone, 2♥ and K♣ show the normal glow, Undo/Hint/⚙ are enabled, bubble 4 is visible with «הבנתי»; playing a card without tapping the button also dismisses it.
5. `tutorialSeen` becomes `true` exactly when HANDOFF is entered; closing the tab during STEP1–STEP3 leaves it unset and the tutorial runs again.
6. ⚙ → «איך משחקים» restarts the tutorial deal (with confirmation if a round is in progress).
7. Rotating to portrait mid-tutorial shows the rotate overlay; rotating back resumes the same step with the same spotlight.
8. Every tutorial string comes from the string table; the screen renders correctly in Hebrew (RTL, default) and English (LTR), with bubble tails still pointing at the right elements.
9. `prefers-reduced-motion`: all tutorial transitions are instant; nothing pulses or loops.
10. `node test.js` passes (it includes the tutorial-deal assertions).
