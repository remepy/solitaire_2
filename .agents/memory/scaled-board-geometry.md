---
name: Scaled board geometry
description: Why mobile highlight drift and edge clipping must be fixed at the shared coordinate frame, not with device-specific offsets.
---

Keep cards and tutorial SVGs in one non-shrinking coordinate frame. Fit that frame inside native safe-area padding, without a second orientation-based sideways correction. Anchor SVG geometry physically from the left regardless of the text language.

**Why:** An iPhone landscape report combined displaced spotlight holes with a clipped stock pile. Flexbox was allowed to shrink the frame while cards retained fixed coordinates; an explicitly sized SVG with both left and right set followed the RTL right edge, so its origin diverged from the cards. Device-specific offsets would hide the symptom at only one width. Safe-area padding already accounts for the device intrusion.

**How to apply:** Keep visual fitting separate from internal geometry. Ensure measurement starts when the actual board DOM mounts, including cold loads that initially render no board. Verify narrow RTL layouts with simulated asymmetric safe areas and rotation in WebKit; desktop screenshots with zero safe-area padding can conceal these failures.