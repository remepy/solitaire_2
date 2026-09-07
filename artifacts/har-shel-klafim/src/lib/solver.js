// TriPeaks solvable-deal generator — board 3p4r28 (classic TriPeaks), PRD v2 §3 & §5
// Zero dependencies. Node 18+.

"use strict";

// ---- Board definition (PRD v2 §3.2) ----
// Rows: 0 apexes (3) | 1 (6) | 2 (9) | 3 bottom (10). Indices 0-27.
const N = 28;
const FULL = (1 << N) - 1;
const coveredBy = [
  [3, 4], [5, 6], [7, 8],                                   // apexes 0,1,2
  [9, 10], [10, 11], [12, 13], [13, 14], [15, 16], [16, 17], // row 1: 3-8
  [18, 19], [19, 20], [20, 21], [21, 22], [22, 23],          // row 2: 9-13
  [23, 24], [24, 25], [25, 26], [26, 27],                    // row 2: 14-17
  [], [], [], [], [], [], [], [], [], []                     // bottom row: 18-27
];
// blocks[i] = cards that card i is a blocker for (inverse map)
const blocks = Array.from({ length: N }, () => []);
coveredBy.forEach((bs, card) => bs.forEach(b => blocks[b].push(card)));

const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const SUITS = ["S","H","D","C"];
const WILD = -1; // internal rank sentinel

function adj(a, b) {
  const d = Math.abs(a - b) % 13;
  return d === 1 || d === 12;
}

// ---- Exact solver ----
// tableauRanks: int[28]; stockRanks: int[] in draw order (index 0 drawn first),
// entries 0..12 or WILD; wasteRank: int or WILD.
// Returns true iff at least one winning line exists.
function isSolvable(tableauRanks, stockRanks, wasteRank) {
  const memo = new Map();
  const stockLen = stockRanks.length;

  function uncovered(mask, i) {
    if (mask & (1 << i)) return false;
    for (const b of coveredBy[i]) if (!(mask & (1 << b))) return false;
    return true;
  }

  function dfs(mask, stockIdx, waste) {
    if (mask === FULL) return true;
    // key fits in a double exactly: 2^28 * 32 * 15 < 2^53
    const key = mask * 32 * 15 + stockIdx * 15 + (waste === WILD ? 14 : waste);
    const hit = memo.get(key);
    if (hit !== undefined) return hit;

    const moves = [];
    for (let i = 0; i < N; i++) {
      if (uncovered(mask, i) && (waste === WILD || adj(tableauRanks[i], waste))) {
        let s = 0; // how many cards does removing i unblock?
        for (const j of blocks[i]) {
          if (!(mask & (1 << j))) {
            let free = true;
            for (const b of coveredBy[j]) if (b !== i && !(mask & (1 << b))) { free = false; break; }
            if (free) s++;
          }
        }
        moves.push([s, i]);
      }
    }
    moves.sort((a, b) => b[0] - a[0]);

    for (const [, i] of moves) {
      if (dfs(mask | (1 << i), stockIdx, tableauRanks[i])) { memo.set(key, true); return true; }
    }
    if (stockIdx < stockLen) {
      if (dfs(mask, stockIdx + 1, stockRanks[stockIdx])) { memo.set(key, true); return true; }
    }
    memo.set(key, false);
    return false;
  }

  return dfs(0, 0, wasteRank);
}

// ---- Deal generation ----
function shuffledDeck(rng) {
  const deck = [];
  for (let r = 0; r < 13; r++) for (const s of SUITS) deck.push({ r, s });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function code(card) { return card.r === WILD ? "WILD" : RANKS[card.r] + card.s; }

const BOARD = "3p4r28";
const STOCK_SIZE = 23;   // 28 tableau + 1 waste + 23 stock = 52 (classic TriPeaks)
const WILD_CHANCE = 0.4;

// wildMode: "auto" | "always" | "never"
// When a wildcard is present it takes one of the 23 stock slots (22 rank cards + WILD);
// the displaced rank card is set aside unused. Stock length is always 23.
function generateSolvableDeal(wildMode = "auto", rng = Math.random, maxAttempts = 500) {
  const wantWild =
    wildMode === "always" ? true :
    wildMode === "never"  ? false :
    rng() < WILD_CHANCE;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const deck = shuffledDeck(rng);
    const tableau = deck.slice(0, N);
    const waste = deck[N];
    let stock = deck.slice(N + 1, N + 1 + (wantWild ? STOCK_SIZE - 1 : STOCK_SIZE));
    if (wantWild) {
      const pos = Math.floor(rng() * (stock.length + 1));
      stock = [...stock.slice(0, pos), { r: WILD, s: "" }, ...stock.slice(pos)];
    }
    const solvable = isSolvable(tableau.map(c => c.r), stock.map(c => c.r), waste.r);
    if (solvable) {
      return {
        attempts: attempt,
        deal: {
          deal_id: `${BOARD}-${Date.now().toString(36)}-${Math.floor(rng() * 1e9).toString(36)}`,
          verified_solvable: true,
          tableau: tableau.map(code),
          // PRD: stock array draw order = LAST element drawn first → reverse internal order
          stock: stock.map(code).reverse(),
          waste: code(waste)
        }
      };
    }
  }
  throw new Error("maxAttempts exceeded");
}

export { isSolvable, generateSolvableDeal, BOARD, STOCK_SIZE, WILD_CHANCE, coveredBy, N };
