---
name: RTL animated card anchors
description: A positioning quirk affecting animated cards in the Hebrew landscape game.
---

In the RTL game frame, the animated stock card's horizontal anchor needs to include the card width to land inside its logical-start tap zone. The tableau itself must live in an explicit LTR coordinate layer.

**Why:** Framer Motion resolved animated coordinates from unexpected edges under RTL. This moved pile cards and surviving tableau blockers away from their physical coverage positions even though their numeric coordinates matched the reference.

**How to apply:** Keep tableau geometry inside an LTR wrapper because it must never mirror. When changing animated pile positions, verify both languages visually; do not assume identical numeric left anchors produce mirrored visual edges.