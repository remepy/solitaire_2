---
name: Card flip transform origin
description: 3D card flips must rotate around the center axis; a corner origin shifts face-down cards off their logical cells and breaks coverage geometry.
---

In the TriPeaks game, every `rotateY(180)` card flip must use `transform-origin: 50% 50%`. A corner origin (e.g. Tailwind `origin-top-left`) projects a face-down card one full card-width away from its logical `left/top` cell, so blockers no longer visually overlap the cards they cover and revealed cards can appear hidden beneath them.

**Why:** This caused a long chain of misdiagnosed "un-flipped / free card" bugs. Face-up cards sat at their correct positions while face-down cards were offset by exactly one card width, so the visual stack disagreed with the solver's coverage graph. Two attempted fixes (RTL coordinate layer, fixed CSS coordinates) were necessary but not sufficient because the corner-origin flip remained.

**How to apply:** Never combine a 3D flip with a non-center transform-origin on positioned game pieces. Keep tableau geometry in an explicit LTR wrapper (the board never mirrors), set left/top directly rather than animating them, and animate only flip/scale. Restart the workflow before judging coordinate fixes — hot reload can retain stale Framer Motion values and make a correct fix look broken.
