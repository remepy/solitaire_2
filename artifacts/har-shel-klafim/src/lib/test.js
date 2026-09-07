"use strict";
const assert = require("assert");
import { isSolvable, generateSolvableDeal, coveredBy, N, STOCK_SIZE } from "./solver.js";

// --- 1. Coverage graph structural checks ---
assert.strictEqual(coveredBy.length, 28);
const rowOf = i => i < 3 ? 0 : i < 9 ? 1 : i < 18 ? 2 : 3;
coveredBy.forEach((bs, i) => {
  if (rowOf(i) === 3) assert.deepStrictEqual(bs, []);
  else { assert.strictEqual(bs.length, 2); bs.forEach(b => assert.strictEqual(rowOf(b), rowOf(i) + 1)); assert.strictEqual(bs[1], bs[0] + 1); }
});
// inverse map: row-2 cards under a peak column (10,13,16) block 2; the other row-2 cards block 1;
// bottom-row ends (18,27) block 1, interior bottom cards block 2; apexes block none
const blocks = Array.from({length: 28}, () => []);
coveredBy.forEach((bs,i)=>bs.forEach(b=>blocks[b].push(i)));
[0,1,2].forEach(i => assert.deepStrictEqual(blocks[i], []));
[10,13,16].forEach(i => assert.strictEqual(blocks[i].length, 2));
[9,11,12,14,15,17,18,27].forEach(i => assert.strictEqual(blocks[i].length, 1));
for (let i=19;i<=26;i++) assert.strictEqual(blocks[i].length, 2);
console.log("coverage graph OK");

// --- 2. Solver edge cases ---
const R = {A:0,2:1,3:2,4:3,5:4,6:5,7:6,8:7,9:8,10:9,J:10,Q:11,K:12};
// Bottom-row-only plays impossible → must use stock; wrap A<->K
{
  // tableau all Kings-adjacent chain: make trivially solvable board: every card rank alternates A,K
  const t = Array.from({length:28},(_, i) => (i%2 ? R.A : R.K));
  assert.strictEqual(isSolvable(t, [], R.A), true);   // A on waste, K playable, alternate forever
  const t2 = Array.from({length:28},() => R[7]);
  assert.strictEqual(isSolvable(t2, [], R[7]), false); // 7 on 7 never legal, no stock
  assert.strictEqual(isSolvable(t2, [R[6]], R[7]), false); // one 6 → plays one 7, then stuck
  // wildcard on waste: any card playable
  assert.strictEqual(isSolvable(t2, [], -1), false); // wild lets one 7, then 7 on 7 stuck
  const t3 = Array.from({length:28},(_, i) => (i%2 ? R[8] : R[7]));
  // bottom row indices 18..27 alternate 7,8 → playable chain requires 7/8 adjacency: yes
  assert.strictEqual(isSolvable(t3, [], R[6]), true);
}
console.log("solver edge cases OK");

// --- 3. Contract invariants over 300 deals ---
let wild = 0, attempts = 0;
const t0 = Date.now();
for (let k = 0; k < 300; k++) {
  import { deal, attempts: a } = generateSolvableDeal("auto");
  attempts += a;
  assert.strictEqual(deal.tableau.length, 28);
  assert.strictEqual(deal.stock.length, STOCK_SIZE);
  const all = [...deal.tableau, ...deal.stock, deal.waste].filter(c => c !== "WILD");
  assert.strictEqual(new Set(all).size, all.length, "duplicate card");
  const w = deal.stock.filter(c => c === "WILD").length;
  assert.ok(w <= 1); wild += w;
  assert.ok(!deal.tableau.includes("WILD") && deal.waste !== "WILD");
}
const ms = Date.now() - t0;
console.log(`300 deals: wild rate ${(wild/3).toFixed(1)}%, avg attempts ${(attempts/300).toFixed(2)}, ${(ms/300).toFixed(1)} ms/deal`);

// --- 4. Raw solvability rate & greedy-bot win rate (difficulty stats) ---
const SUITS=["S","H","D","C"];
function deck(){const d=[];for(let r=0;r<13;r++)for(const s of SUITS)d.push(r);for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];}return d;}
function greedy(t, stock, waste){ // same heuristic as hint: prefer most-unblocking legal move
  let mask=0, si=0;
  const adj=(a,b)=>{const d=Math.abs(a-b)%13;return d===1||d===12;};
  const unc=(i)=>!(mask&(1<<i))&&coveredBy[i].every(b=>mask&(1<<b));
  while(true){
    if(mask===(1<<28)-1) return true;
    let best=-1,bs=-1;
    for(let i=0;i<28;i++) if(unc(i)&&(waste===-1||adj(t[i],waste))){let s=0;for(const j of blocks[i]) if(!(mask&(1<<j))&&coveredBy[j].every(b=>b===i||(mask&(1<<b)))) s++; if(s>bs){bs=s;best=i;}}
    if(best>=0){mask|=1<<best;waste=t[best];continue;}
    if(si<stock.length){waste=stock[si++];continue;}
    return false;
  }
}
function stats(withWild, n){
  let solv=0, win=0; const t0=Date.now();
  for(let k=0;k<n;k++){
    const d=deck(); const t=d.slice(0,28), w=d[28];
    let s=d.slice(29,29+(withWild?22:23));
    if(withWild){const p=Math.floor(Math.random()*(s.length+1)); s=[...s.slice(0,p),-1,...s.slice(p)];}
    if(isSolvable(t,s,w)) solv++;
    if(greedy(t,s,w)) win++;
  }
  return {solvable:(100*solv/n).toFixed(1)+"%", greedyWin:(100*win/n).toFixed(1)+"%", msPerSolve:((Date.now()-t0)/n).toFixed(1)};
}
console.log("no wild, stock 23:", stats(false, 1000));
console.log("wild,    stock 23:", stats(true, 1000));
console.log("ALL TESTS PASSED");
