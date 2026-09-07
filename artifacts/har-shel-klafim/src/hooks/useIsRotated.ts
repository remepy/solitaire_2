import { useEffect, useState } from "react";

/**
 * Returns true when a touch device is being held in portrait orientation
 * (viewport height > width). Shows the "please rotate" overlay.
 *
 * Listens to four signals for maximum cross-browser reliability:
 *   1. screen.orientation "change" — most reliable on iOS 16.4+ / Android
 *   2. window.matchMedia("(orientation: portrait)") — good fallback
 *   3. window "resize" — catches viewport settling after rotation
 *   4. window "orientationchange" — legacy fallback
 *
 * The checkPortrait() function prefers screen.orientation.type (reliable on
 * iOS 17 / iPhone 15) and falls back to innerWidth < innerHeight for older
 * browsers where that API isn't available.
 */

function checkPortrait(): boolean {
  if (typeof window === "undefined") return false;
  // Only prompt on real touch devices — not desktop browsers
  if (!navigator.maxTouchPoints) return false;

  // screen.orientation.type is the most reliable signal on iOS 16.4+ and
  // Android. innerWidth/innerHeight can lag on iOS Safari after orientationchange.
  if (typeof screen !== "undefined" && screen.orientation?.type) {
    return screen.orientation.type.startsWith("portrait");
  }

  return window.innerWidth < window.innerHeight;
}

export function useIsRotated(): boolean {
  const [portrait, setPortrait] = useState<boolean>(checkPortrait);

  useEffect(() => {
    const update = () => setPortrait(checkPortrait());

    // 1. screen.orientation — most reliable on iOS 16.4+ / modern Android
    screen.orientation?.addEventListener("change", update);
    // 2. MediaQueryList — good cross-browser fallback
    const mq = window.matchMedia("(orientation: portrait)");
    mq.addEventListener("change", update);
    // 3. resize — catches viewport settling after the rotation animation
    window.addEventListener("resize", update);
    // 4. orientationchange — legacy fallback (deprecated but still fires)
    window.addEventListener("orientationchange", update);

    // Re-evaluate immediately in case orientation changed before mount
    update();

    return () => {
      screen.orientation?.removeEventListener("change", update);
      mq.removeEventListener("change", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return portrait;
}
