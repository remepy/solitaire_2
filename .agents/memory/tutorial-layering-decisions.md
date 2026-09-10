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
The tableau container spans the whole 844×390 frame and sits above other controls in DOM order; without `pointer-events: none` it swallowed real clicks on a control that lived in the top strip (programmatic `.click()` still worked, which hid the bug in earlier tests). Cards manage their own pointer-events.
**Why:** Synthetic clicks bypassed a real hit-testing failure.
**How to apply:** any new full-frame layer (overlays, dim masks) should be pointer-transparent unless it owns a real control.

## No score, streak, or settings surface for the player
Scoring and streak state may exist in the store (undo history depends on it), but nothing about them may reach the screen — no HUD, no end-of-round score line, no settings entry point. The header is reserved for tutorial-related controls, not a HUD.
**Why:** The user asked for a calm board with only the cards and the play controls, and said the scoring logic could stay only if it stays invisible.
**How to apply:** Do not reintroduce a HUD or a gear/menu button without the user asking. Preferences (language, theme, sound, text size, reduced motion) still live in the settings store and apply from their defaults; if any of them ever needs to be user-changeable again, get the user's decision on the entry point first. Tableau rows start at y=46, so the header strip must stay that height.

## The tutorial auto-runs once, and is replayable on demand
It starts by itself only on a player's first launch, gated by a persisted flag that is written when the player reaches the final handoff step; abandoning it early leaves it unset so it runs again. Afterwards it is reachable from the header button.
**Why:** The user asked for once-per-user behaviour plus an explicit way to see it again. An earlier build had a "run every round" testing toggle — do not reintroduce one; use the button instead.
**How to apply:** Restarting the tutorial loads the scripted deal and discards the round in progress, so confirm first whenever the player has already made a move. Component-local timers such as the hint glow must be cleared when the deal changes, since the game store cannot reset them.

## Hints remain available during coaching
Hints explain the current lesson without performing a move or advancing the tutorial. Keep the control visible outside the coaching bubble, and use the scripted action during guided steps rather than the normal move optimizer.
**Why:** The user reported Hint being inactive in the tutorial; treating non-mutating help like a forbidden game action made the teaching flow less usable.
**How to apply:** Exempt help from gameplay input gating. Cover informational steps, drawing from the deck, guided card plays and the final handoff. A cue must disappear when its step or move becomes obsolete.
