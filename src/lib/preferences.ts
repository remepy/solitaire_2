// The only values the game persists on the device across sessions (BR-06,
// spec revision C): the tutorial-seen flag and the participant's own sound
// on/off choice. Nothing about progression is stored; the app owns that (BR-03).
const TUTORIAL_SEEN_KEY = "solitaire.tutorialSeen";
const SOUND_ON_KEY = "solitaire.soundOn";

export function readTutorialSeen(): boolean {
  try {
    return window.localStorage.getItem(TUTORIAL_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeTutorialSeen(): void {
  try {
    window.localStorage.setItem(TUTORIAL_SEEN_KEY, "1");
  } catch {
    // Storage unavailable: the tutorial simply shows again next time.
  }
}

/** Sound is on unless the player turned it off in an earlier session. */
export function readSoundOn(): boolean {
  try {
    return window.localStorage.getItem(SOUND_ON_KEY) !== "0";
  } catch {
    return true;
  }
}

export function writeSoundOn(on: boolean): void {
  try {
    window.localStorage.setItem(SOUND_ON_KEY, on ? "1" : "0");
  } catch {
    // Storage unavailable: the choice lasts for this session only.
  }
}
