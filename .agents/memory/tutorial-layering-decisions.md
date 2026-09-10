---
name: Tutorial & board layering decisions
description: Tutorial teaching constraints, physical card anchoring, and pointer-layer pitfalls.
---

## Preserve the board as evidence for the lesson
Keep tutorial prompts below the tableau, and leave the whole tableau undimmed when asking players to see that no move exists.
**Why:** On 2026-09-10 the user reported that the old no-move prompt covered the very cards needed to understand the rule, then explicitly approved the revised tutorial. Preserve that approach; the original spec's overlay boxes are no longer the desired placement.
**How to apply:** Use the free controls area opposite the piles for prompts. That area mirrors by language, but connector endpoints must follow physical tableau cards, which never mirror.

## Teach the reference card before asking for a move
Identify the waste as the open reference card, explain both one-higher and one-lower moves, and teach Ace with both King and 2 rather than just the King exception.
**Why:** The user identified these as missing mental-model basics in the original script.
**How to apply:** Prefer a short introductory explanation and real guided moves over adding all rules to one bubble.

## Describe the goal without "three peaks"
Use plain descriptions of clearing cards from the board, not "three peaks" terminology, in player-facing copy.
**Why:** The user explicitly requested avoiding that term over proprietary-term concerns and because it adds no meaning for players.
**How to apply:** Keep tutorial, victory, and spoken feedback wording consistent; internal game mechanics need not change.

## Where tutorial logic lives (user-stated constraints)
The tutorial must load its deal through the same path as generated deals; the separate overlay only reads state. Gameplay steps advance from successful moves, while informational explanations may use a continuation button.
**Why:** Shared loading and a read-only overlay were explicit user constraints. Rejected taps must not advance the tutorial or change game rules.
**How to apply:** Keep gameplay and input gating outside the overlay; pass callbacks for explanation buttons from the board.

## Full-frame layers must be pointer-transparent
The tableau container spans the whole 844×390 frame and sits after the header in DOM order; without `pointer-events: none` it swallowed real clicks on the ⚙ button (programmatic `.click()` still worked, which hid the bug in earlier tests). Cards manage their own pointer-events.
**Why:** Synthetic clicks bypassed a real hit-testing failure.
**How to apply:** any new full-frame layer (overlays, dim masks) should be pointer-transparent unless it owns a real control.
