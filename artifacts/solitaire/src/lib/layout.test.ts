import assert from "node:assert/strict";
import { coveredBy } from "./solver.js";
import { getBoardScale, getCardHitRect, getCardRect, getStockTapRect, PLAY_BOUNDS, type Rect } from "./layout.ts";

const right = (r: Rect) => r.left + r.width;
const bottom = (r: Rect) => r.top + r.height;
const overlaps = (a: Rect, b: Rect) =>
  a.left < right(b) && right(a) > b.left && a.top < bottom(b) && bottom(a) > b.top;

// Every card pair that can be uncovered together must have disjoint hit zones.
function descendants(index: number): Set<number> {
  return new Set(coveredBy[index].flatMap((i: number) => [i, ...descendants(i)]));
}
for (let a = 0; a < 28; a++) {
  const hit = getCardHitRect(a);
  assert.ok(hit.left >= PLAY_BOUNDS.left && right(hit) <= right(PLAY_BOUNDS));
  assert.ok(hit.top >= PLAY_BOUNDS.top && bottom(hit) <= bottom(PLAY_BOUNDS));
  assert.ok(!overlaps(hit, getStockTapRect("he")));
  assert.ok(!overlaps(hit, getStockTapRect("en")));
  for (let b = a + 1; b < 28; b++) {
    if (descendants(a).has(b) || descendants(b).has(a)) continue;
    assert.ok(!overlaps(getCardRect(a), getCardRect(b)), `cards ${a}/${b} overlap`);
    assert.ok(!overlaps(hit, getCardHitRect(b)), `hit zones ${a}/${b} overlap`);
  }
}

// Safe content sizes: iPhone in both landscape directions, narrow browser
// windows, portrait, and desktop. Never consume the reserved edge margin.
for (const [width, height] of [[734, 372], [793, 372], [681, 319], [393, 852], [844, 390], [1366, 768]]) {
  const scale = getBoardScale(width, height);
  assert.ok(PLAY_BOUNDS.width * scale <= width - 8 + 1e-8);
  assert.ok(PLAY_BOUNDS.height * scale <= height - 8 + 1e-8);
}
const oldIphoneScale = Math.min((734 - 16) / 844, (372 - 16) / 390);
assert.ok(getBoardScale(734, 372) / oldIphoneScale > 1.10, "iPhone cards should be at least 10% larger");
assert.equal(getBoardScale(0, 0), 0);
console.log("Board fitting and non-overlapping card hit zones passed");