---
name: RTL animated card anchors
description: A positioning quirk affecting animated cards in the Hebrew landscape game.
---

In the RTL game frame, the animated stock card's horizontal anchor needs to include the card width to land inside its logical-start tap zone.

**Why:** Framer Motion resolved the animated stock coordinate from the opposite card edge under RTL, leaving the stock overlapping the waste even though the numeric position matched the reference.

**How to apply:** When changing animated pile positions, verify both Hebrew and English visually at the reference landscape size; do not assume identical numeric left anchors produce mirrored visual edges.