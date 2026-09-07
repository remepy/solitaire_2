---
name: RTL animated card anchors
description: A positioning quirk affecting animated cards in the Hebrew landscape game.
---

The tableau must live in an explicit LTR coordinate layer, and card positions must use fixed physical CSS coordinates rather than animated left/top values.

**Why:** Framer Motion resolved animated coordinates from unexpected edges under RTL and could retain stale offsets through hot reload. Cards then drifted from blocker positions even when numeric coordinates matched the reference.

**How to apply:** Keep tableau geometry inside an LTR wrapper, set left/top directly, and animate only flip/scale. Restart the workflow before judging coordinate fixes so stale motion values cannot survive hot reload.