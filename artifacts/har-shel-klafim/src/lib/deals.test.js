// Catalogue + perfect-play hint invariants.
// Run: node src/lib/deals.test.js   (from the package root)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isSolvable, findBestMove, coveredBy, N, RANKS } from "./solver.js";

const cat = JSON.parse(readFileSync(new URL("./deals.json", import.meta.url)));
const rankOf = (c) => (c === "WILD" ? -1 : RANKS.indexOf(c.slice(0, -1)));

// --- 1. Shape ---
assert.equal(cat.deals.length, cat.count);
assert.equal(cat.count, 180, "catalogue must hold 180 deals");
const ids = new Set(cat.deals.map((d) => d.id));
assert.equal(ids.size, 180, "deal ids must be unique");
for (const d of cat.deals) {
  assert.equal(d.tableau.length, N);
  assert.equal(d.stock.length, 23);
  assert.equal(typeof d.waste, "string");
  const all = [...d.tableau, ...d.stock, d.waste];
  assert.equal(all.length, 52);
  const wilds = all.filter((c) => c === "WILD").length;
  assert.ok(wilds <= 1, "at most one wildcard");
  assert.equal(new Set(all).size, 52 - (wilds ? 0 : 0), "no duplicate cards");
  assert.ok(!d.tableau.includes("WILD"), "wildcard never sits in the tableau");
}
// no two deals share a tableau
assert.equal(new Set(cat.deals.map((d) => d.tableau.join(""))).size, 180, "deals must be distinct");
console.log("catalogue shape OK");

// --- 2. Every deal solvable with perfect play ---
for (const d of cat.deals) {
  const ok = isSolvable(d.tableau.map(rankOf), [...d.stock].reverse().map(rankOf), rankOf(d.waste));
  assert.ok(ok, `deal ${d.id} is not solvable`);
}
console.log(`all ${cat.count} deals solvable OK`);

// --- 3. Following the hint always clears the board ---
// This is the requirement: repeatedly pressing hint solves the level.
const FULLMASK = (1 << N) - 1;
let maxMs = 0, totalMoves = 0;
for (const d of cat.deals) {
  const tRanks = d.tableau.map(rankOf);
  const drawOrder = [...d.stock].reverse().map(rankOf);
  let mask = 0, stockIdx = 0, waste = rankOf(d.waste), guard = 0;
  const t0 = performance.now();
  while (mask !== FULLMASK) {
    assert.ok(++guard < 200, `deal ${d.id}: hint loop did not terminate`);
    const remainingStock = drawOrder.slice(stockIdx);
    const mv = findBestMove(tRanks, remainingStock, waste, mask);
    assert.ok(mv, `deal ${d.id}: hint found no winning move at move ${guard}`);
    if (mv.type === "play") {
      assert.ok(!(mask & (1 << mv.index)), `deal ${d.id}: hint picked a played card`);
      for (const b of coveredBy[mv.index]) {
        assert.ok(mask & (1 << b), `deal ${d.id}: hint picked a covered card`);
      }
      assert.ok(waste === -1 || tRanks[mv.index] === -1 ||
        [1, 12].includes(Math.abs(tRanks[mv.index] - waste)), `deal ${d.id}: hint picked an illegal card`);
      mask |= 1 << mv.index;
      waste = tRanks[mv.index];
    } else {
      assert.ok(stockIdx < drawOrder.length, `deal ${d.id}: hint said draw with an empty stock`);
      waste = drawOrder[stockIdx++];
    }
    totalMoves++;
  }
  maxMs = Math.max(maxMs, performance.now() - t0);
}
console.log(`hint-following cleared all ${cat.count} boards OK (${totalMoves} moves, slowest full deal ${maxMs.toFixed(0)}ms)`);

// --- 4. Hint latency for a single press, from the opening position ---
let worst = 0;
for (const d of cat.deals) {
  const t0 = performance.now();
  findBestMove(d.tableau.map(rankOf), [...d.stock].reverse().map(rankOf), rankOf(d.waste), 0);
  worst = Math.max(worst, performance.now() - t0);
}
console.log(`worst single hint press: ${worst.toFixed(1)}ms`);

// --- 5. A lost position degrades to null rather than throwing ---
const d0 = cat.deals[0];
const lost = findBestMove(d0.tableau.map(rankOf), [], rankOf(d0.waste), 0);
assert.ok(lost === null || lost.type, "must return a move or null, never throw");
console.log("lost-position fallback OK");

console.log("ALL CATALOGUE TESTS PASSED");
