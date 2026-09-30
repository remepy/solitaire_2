/**
 * Builds the fixed deal catalogue shipped with the game.
 *
 *   node tools/generate-deals.mjs [--seed N] [--count N] [--out PATH]
 *
 * Why a committed data file rather than seeded generation at runtime:
 * the trial needs the deal a participant saw on a given level to be a fixed,
 * auditable artifact. Runtime generation would silently produce different
 * deals if the generator or the rejection loop ever changed, and it puts an
 * unbounded exact-solver search on the main thread.
 *
 * Difficulty: every deal is solvable with perfect play. The catalogue is also
 * calibrated so that a player using the game's own greedy heuristic wins about
 * TARGET_WIN_RATE of them. Each candidate's win probability is estimated over
 * GREEDY_TRIALS runs (the heuristic breaks ties randomly, so a single run is a
 * coin flip on borderline deals — the previous probabilistic filter sampled it
 * once and drifted to ~41% against a 1/3 target). Selection here is
 * deterministic: candidates are accepted only while they keep the running mean
 * moving toward target.
 */
import { writeFileSync } from "node:fs";
import {
  isSolvable, playGreedy, mulberry32, BOARD, STOCK_SIZE, WILD_CHANCE, N, RANKS,
} from "../src/lib/solver.js";

const args = Object.fromEntries(
  process.argv.slice(2).join(" ").split("--").filter(Boolean)
    .map((s) => s.trim().split(/\s+/)).map(([k, v]) => [k, v]),
);
const SEED = Number(args.seed ?? 20260922);
const COUNT = Number(args.count ?? 180);
const OUT = args.out ?? new URL("../src/lib/deals.json", import.meta.url).pathname;

const TARGET_WIN_RATE = 1 / 3;
const GREEDY_TRIALS = 15;
const SUITS = ["S", "H", "D", "C"];
const WILD = -1;

const rng = mulberry32(SEED);

function shuffledDeck() {
  const deck = [];
  for (let r = 0; r < 13; r++) for (const s of SUITS) deck.push({ r, s });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
const code = (c) => (c.r === WILD ? "WILD" : RANKS[c.r] + c.s);

function candidate() {
  const wantWild = rng() < WILD_CHANCE;
  const deck = shuffledDeck();
  const tableau = deck.slice(0, N);
  const waste = deck[N];
  let stock = deck.slice(N + 1, N + 1 + (wantWild ? STOCK_SIZE - 1 : STOCK_SIZE));
  if (wantWild) {
    const pos = Math.floor(rng() * (stock.length + 1));
    stock = [...stock.slice(0, pos), { r: WILD, s: "" }, ...stock.slice(pos)];
  }
  const tRanks = tableau.map((c) => c.r);
  const sRanks = stock.map((c) => c.r);
  if (!isSolvable(tRanks, sRanks, waste.r)) return null;

  let wins = 0;
  for (let t = 0; t < GREEDY_TRIALS; t++) {
    if (playGreedy(tRanks, sRanks, waste.r, rng)) wins++;
  }
  return {
    pWin: wins / GREEDY_TRIALS,
    hasWild: wantWild,
    deal: {
      tableau: tableau.map(code),
      stock: stock.map(code).reverse(), // draw order: last element drawn first
      waste: code(waste),
    },
  };
}

// Difficulty bands and how many of each the catalogue holds. The quotas are
// chosen so the weighted mean lands on TARGET_WIN_RATE while the set still
// spans genuinely easy and genuinely hard deals — 180 levels of identical
// difficulty would be worse than a slightly off mean.
const BANDS = [
  { name: "very hard", lo: 0.00, hi: 0.20, quota: 50 },
  { name: "hard",      lo: 0.20, hi: 0.40, quota: 55 },
  { name: "medium",    lo: 0.40, hi: 0.60, quota: 47 },
  { name: "easy",      lo: 0.60, hi: 0.80, quota: 18 },
  { name: "very easy", lo: 0.80, hi: 1.01, quota: 10 },
];
if (BANDS.reduce((a, b) => a + b.quota, 0) !== COUNT) {
  throw new Error("band quotas must sum to COUNT");
}

const buckets = BANDS.map(() => []);
const seen = new Set();
let examined = 0;
const MAX_EXAMINED = 400000;

while (examined < MAX_EXAMINED && buckets.some((b, i) => b.length < BANDS[i].quota)) {
  examined++;
  const c = candidate();
  if (!c) continue;
  const key = c.deal.tableau.join("") + "|" + c.deal.waste;
  if (seen.has(key)) continue;
  const bi = BANDS.findIndex((b) => c.pWin >= b.lo && c.pWin < b.hi);
  if (bi < 0 || buckets[bi].length >= BANDS[bi].quota) continue;
  seen.add(key);
  buckets[bi].push(c);
}

const short = BANDS.map((b, i) => (buckets[i].length < b.quota ? `${b.name} ${buckets[i].length}/${b.quota}` : null)).filter(Boolean);
if (short.length) throw new Error(`could not fill bands after ${examined} candidates: ${short.join(", ")}`);

// Interleave the bands deterministically so difficulty is spread across the
// 180 levels rather than arriving in blocks.
const pool = buckets.flat();
const order = mulberry32(SEED ^ 0x5bf03635);
for (let i = pool.length - 1; i > 0; i--) {
  const j = Math.floor(order() * (i + 1));
  [pool[i], pool[j]] = [pool[j], pool[i]];
}
const chosen = pool;
const sum = chosen.reduce((a, c) => a + c.pWin, 0);

const mean = sum / chosen.length;
const catalogue = {
  version: 1,
  board: BOARD,
  seed: SEED,
  generatedBy: "tools/generate-deals.mjs",
  targetWinRate: Number(TARGET_WIN_RATE.toFixed(4)),
  measuredWinRate: Number(mean.toFixed(4)),
  greedyTrials: GREEDY_TRIALS,
  count: chosen.length,
  deals: chosen.map((c, i) => ({ id: `${BOARD}-L${String(i + 1).padStart(3, "0")}`, ...c.deal })),
};

writeFileSync(OUT, JSON.stringify(catalogue, null, 0) + "\n");

const wild = chosen.filter((c) => c.hasWild).length;
const band = (lo, hi) => chosen.filter((c) => c.pWin >= lo && c.pWin < hi).length;
console.log(`seed ${SEED} · examined ${examined} candidates · kept ${chosen.length}`);
console.log(`greedy win rate: ${(mean * 100).toFixed(1)}%  (target ${(TARGET_WIN_RATE * 100).toFixed(1)}%)`);
console.log(`wildcard deals: ${wild} (${((wild / chosen.length) * 100).toFixed(1)}%)`);
console.log(`difficulty spread: <20% ${band(0, 0.2)} | 20-40% ${band(0.2, 0.4)} | 40-60% ${band(0.4, 0.6)} | 60-80% ${band(0.6, 0.8)} | >=80% ${band(0.8, 1.01)}`);
console.log(`wrote ${OUT}`);
