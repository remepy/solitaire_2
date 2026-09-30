import { useEffect, useRef } from "react";

import track from "@/assets/music.mp3";

// Background music sits under the game, not over it: quiet enough that the
// card sound and the app's own audio stay legible.
const VOLUME = 0.35;
// A WebView refuses autoplay until the participant has touched the page, and
// which event counts differs between iOS and Android, so listen for all four.
const GESTURE_EVENTS = ["touchstart", "pointerdown", "click", "keydown"] as const;

/**
 * One looping track. `audible` is the music toggle and the session together:
 * it goes false on pause and the component unmounts on exit, abort and error,
 * which is what stops the audio (the app unloads the page, but only after).
 * The track fades in and out to silence, so it loops without a seam.
 * Renders nothing.
 */
export default function MusicManager({ audible }: { audible: boolean }) {
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const audibleRef = useRef(audible);
  audibleRef.current = audible;

  if (!playerRef.current) {
    const audio = new Audio(track);
    audio.loop = true;
    audio.volume = VOLUME;
    audio.preload = "auto";
    playerRef.current = audio;
  }

  const play = (audio: HTMLAudioElement) => {
    // Refused autoplay is not an error: the gesture fallback below retries.
    audio.play().catch(() => {});
  };

  useEffect(() => {
    const audio = playerRef.current!;
    if (audibleRef.current) play(audio);

    const removeGesture = () => {
      GESTURE_EVENTS.forEach((ev) => document.removeEventListener(ev, onGesture, true));
    };
    const onGesture = () => {
      // While music is off — turned off in an earlier session, or paused —
      // keep listening, so a later gesture can still start it once it is on.
      if (!audibleRef.current) return;
      if (audio.paused) play(audio);
      removeGesture();
    };
    GESTURE_EVENTS.forEach((ev) => document.addEventListener(ev, onGesture, true));

    return () => {
      removeGesture();
      audio.pause();
    };
  }, []);

  useEffect(() => {
    const audio = playerRef.current!;
    if (audible) {
      if (audio.paused) play(audio);
    } else {
      audio.pause();
    }
  }, [audible]);

  return null;
}
