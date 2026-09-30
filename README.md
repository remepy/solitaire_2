# Solitaire

A TriPeaks solitaire for the Cyan daily activity: tap-only, no time pressure,
large targets, forgiving of tremor. Hebrew-first, landscape, built to run
full-window inside the app's WebView.

`gameId: solitaire` · protocol v1 · see `Cyan Game Bridge — v1` (revision C).

## Bridge binding

| | |
|---|---|
| URL | `https://<cdn>/games/solitaire/{lang}/index.html` |
| Level catalogue | 180 fixed deals, `solitaire-001`…`solitaire-180` |
| Rounds per session | 2 |
| `level_completed` | `outcome` is `won` or `lost`; `stats` is empty |
| `game_finished` | `stats: { wins, rounds }` |
| Stored on the device | `solitaire.tutorialSeen`, `solitaire.soundOn` (BR-06) |

The app sends two consecutive ids and owns the pointer (BR-03). A lost round is
a completed round (BR-02) — `outcome` is reported for statistics only and never
affects progression.

## How the game behaves

- **Rounds.** One deal per round. A round ends on a win or when no legal move
  remains. A round-end screen follows every round except the last; after the
  last, `game_finished` is posted and the app draws its own summary (BR-01).
- **Tutorial.** Five guided steps on the scripted deal, shown when
  `session_start` says `tutorialSeen: false`, and reachable any time from the
  help control in the header. The app's flag overrides anything stored on the
  device. Every card except the last carries a skip link, which returns to the
  round and marks the tutorial seen; the last card already ends it with "Got
  it".
- **Hints are perfect play.** `findBestMove` runs the exact solver from the
  current position and returns a move on a winning line, including a stock draw
  when that is what winning requires. Following hints repeatedly clears any
  board. After a move that has already lost the deal no winning line exists, and
  the hint falls back to the best legal move rather than telling the player the
  position is dead.
- **Idle nudge.** 90 seconds after the last tap the hint button pulses twice —
  two 1.2s fade cycles — and then twice more every 30 seconds while the player
  stays idle. Any pointerdown anywhere restarts the 90 seconds, so a player
  reading the board is reminded rather than nagged. Opacity only: the tap target
  never moves or resizes. Under reduced motion the same highlight is held steady
  for the length of a burst instead of fading, so the cue survives the setting.
  The timer does not run while the game is paused, in portrait, or during the
  tutorial, and it restarts on resume.
- **Sound.** Off/on from the speaker control; the choice is remembered across
  sessions (BR-06) and never appears in `stats`.
- **Exit.** The app draws no chrome, so the game carries the only way out
  (BR-07): the exit control posts `game_exit_requested` and the activity ends
  without being marked complete.
- **Pause / resume / abort.** Pause blocks all input; abort blanks the screen
  and posts nothing further.
- **Failure is silent to the participant.** Every error path posts `game_error`
  and renders an empty screen. A raw translation key is never shown (BR-10).

## The deal catalogue

`src/lib/levels.json` holds 180 deals, generated offline from seed `20260922`
by `scripts/generate-deals.mjs`. Deals are data, not generated at runtime, so
the deal a participant saw at a given level is reproducible from the repo.

Every deal is solvable with perfect play. The set is also calibrated so a player
using the game's own heuristic wins about a third of them: each candidate's win
probability is estimated over 15 runs and the catalogue fills difficulty-band
quotas (50 very hard / 55 hard / 47 medium / 18 easy / 10 very easy,
deterministically interleaved). Measured: **33.3%** against a 1/3 target.

Regenerating with the same seed reproduces the same 180 deals.

## Copy and languages

All text lives in `translations/he.json` and `translations/en.json`
(`locale`, `dir`, `keys`). The build copies the right one to
`translations.json` next to the page; the game fetches it relative to itself
(BR-12) and takes text direction from `dir` (BR-15). There are no fallback
strings — a missing key fails the whole load (BR-13).

Hebrew is gender-neutral throughout, using plural imperatives (הקישו, בחרו,
סובבו). Keep it that way: the app resolves the feminine variant before choosing
the URL and games never see it (BR-08).

## Development

```bash
npm install
npm run dev:he      # or dev:en
```

## Build and local QA

```bash
npm run build                 # both languages → dist/games/solitaire/{he,en}/
npm run build -- he           # one language
npm run serve                 # http://localhost:3000/games/solitaire/he/index.html
```

`scripts/serve.mjs` behaves like S3/CloudFront: no clean-URL redirects, and the
same cache headers as production. Add `?bridge=1` to the page URL to have the
server inject a stand-in for the app's channel; messages appear in the browser
console, and `qa.pause()`, `qa.resume()`, `qa.abort()` drive it. Overrides:
`?bridge=1&tutorial=0&levels=solitaire-003,solitaire-004&locale=en-US`.

## Checks

```bash
npm run check          # typecheck + solver + catalogue + layout
npm run check:levels   # all 180 deals solvable; hint-following clears every board
npm run check:layout   # no two uncoverable-together cards have overlapping hit
                       # zones; the coach bubble stays inside the play bounds
```

## Deploying to S3

One prefix per game per language, exactly as built:

```
s3://<bucket>/games/solitaire/he/…
s3://<bucket>/games/solitaire/en/…
```

`index.html` and `translations.json` are served `no-cache`; `assets/*` are
content-hashed and `public, max-age=31536000, immutable`. A CloudFront cache
policy with a non-zero minimum TTL overrides the origin's `no-cache`, so the
stable-name files need a behavior whose minimum TTL is 0.

Copy can be corrected by replacing `translations.json` alone — no rebuild.

## Project layout

```
index.html              relative-URL shell; the title comes from translations
src/lib/bridge.ts       both directions of the bridge, closed-after-final-message
src/lib/translations.ts loading and validating ./translations.json
src/lib/levels.ts       the fixed catalogue, id → deal
src/lib/levels.json     180 generated deals
src/lib/solver.js       exact solver, greedy player, perfect-play move search
src/lib/layout.ts       board geometry inside the 844×390 frame
src/context/SessionContext.tsx   lifecycle, rounds, session stats
src/components/Board.tsx         the board, controls and coaching layer
scripts/                build, serve, dev-language, generator, checks
translations/           he.json, en.json
```

## Notes

- The board is one fixed 844×390 coordinate frame scaled to fit. The tableau is
  physical and never mirrors; only the stock and waste swap sides with `dir`.
- Input is debounced at 300 ms, and a tap is accepted anywhere in a card's
  padded hit zone — both deliberate, for tremor.
- Heebo is bundled rather than fetched from Google Fonts: no third-party request
  on the critical path, and Hebrew never falls back to a system face.
