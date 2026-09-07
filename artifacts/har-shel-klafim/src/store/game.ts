import { create } from "zustand";
import { generateDeal, coveredBy, N } from "../lib/solver";

function fallbackDeal() {
  const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
  const SUITS = ["S","H","D","C"];
  const deck: string[] = [];
  for (let r of RANKS) for (let s of SUITS) deck.push(r + s);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  if (Math.random() < 0.4) {
    const pos = Math.floor(Math.random() * 23);
    deck[28 + 1 + pos] = "WILD";
  }
  return {
    deal_id: "fallback-" + Date.now(),
    tableau: deck.slice(0, 28),
    waste: deck[28],
    stock: deck.slice(29, 29 + 23).reverse()
  } as OriginalDeal;
}

export type CardCode = string; // e.g. "6C", "10H", "WILD"

export interface OriginalDeal {
  deal_id: string;
  tableau: CardCode[];
  stock: CardCode[];
  waste: CardCode;
}

export type TableauStatus = "face-down" | "uncovered" | "played";

export interface GameHistoryEntry {
  type: "play" | "draw";
  card: CardCode;
  tableauIdx?: number;
  prevScore: number;
  prevStreak: number;
  prevStatus: TableauStatus[]; // to easily restore uncovered state
}

export interface GameState {
  originalDeal: OriginalDeal | null;
  
  tableau: CardCode[];
  tableauStatus: TableauStatus[];
  stock: CardCode[]; // last element is top of stack
  waste: CardCode[]; // last element is top of waste
  
  score: number;
  streak: number;
  isWon: boolean;
  isLost: boolean;
  
  history: GameHistoryEntry[];

  newDeal: () => void;
  replayDeal: () => void;
  playCard: (idx: number) => void;
  drawStock: () => void;
  undo: () => void;
  
  // A11y / announcer state
  lastAnnouncement: string | null;
  announce: (msg: string) => void;
}

export function computeUncovered(status: TableauStatus[]): TableauStatus[] {
  const newStatus = [...status];
  for (let i = 0; i < N; i++) {
    if (newStatus[i] === "face-down") {
      const blockers = coveredBy[i] as number[];
      const isBlocked = blockers.some((b) => newStatus[b] !== "played");
      if (!isBlocked) {
        newStatus[i] = "uncovered";
      }
    }
  }
  return newStatus;
}

export function isAdjacent(wasteCard: string, playCard: string): boolean {
  if (wasteCard === "WILD" || playCard === "WILD") return true;
  const wasteRank = wasteCard.slice(0, -1);
  const playRank = playCard.slice(0, -1);
  const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
  const wIdx = RANKS.indexOf(wasteRank);
  const pIdx = RANKS.indexOf(playRank);
  if (wIdx === -1 || pIdx === -1) return false;
  
  const d = Math.abs(wIdx - pIdx) % 13;
  return d === 1 || d === 12;
}

export function checkWinLose(tableauStatus: TableauStatus[], stock: string[], wasteTop: string, tableauCards: string[]): { isWon: boolean; isLost: boolean } {
  const isWon = tableauStatus.every(s => s === "played");
  if (isWon) return { isWon: true, isLost: false };
  
  if (stock.length > 0) return { isWon: false, isLost: false };
  if (wasteTop === "WILD") return { isWon: false, isLost: false }; // can always play if wild
  
  // Check if any legal move exists
  for (let i = 0; i < N; i++) {
    if (tableauStatus[i] === "uncovered" && isAdjacent(wasteTop, tableauCards[i])) {
      return { isWon: false, isLost: false };
    }
  }
  
  return { isWon: false, isLost: true };
}

export const useGame = create<GameState>((set, get) => ({
  originalDeal: null,
  tableau: [],
  tableauStatus: [],
  stock: [],
  waste: [],
  score: 0,
  streak: 1,
  isWon: false,
  isLost: false,
  history: [],
  lastAnnouncement: null,
  announce: (msg) => set({ lastAnnouncement: msg }),

  newDeal: () => {
    // Calibrated deal: always solvable with perfect play, but winnable by
    // heuristic play only ~1/3 of the time (see solver.js).
    let res;
    try {
      res = generateDeal("auto");
    } catch(e) {
      // Fallback
      res = { deal: fallbackDeal() };
    }
    const deal = res.deal as OriginalDeal;
    
    let status = Array(N).fill("face-down") as TableauStatus[];
    // bottom row uncovered
    for(let i = 18; i < 28; i++) status[i] = "uncovered";
    
    set({
      originalDeal: deal,
      tableau: deal.tableau,
      tableauStatus: status,
      stock: deal.stock,
      waste: [deal.waste],
      score: 0,
      streak: 1,
      isWon: false,
      isLost: false,
      history: [],
      lastAnnouncement: null
    });
  },

  replayDeal: () => {
    const orig = get().originalDeal;
    if (!orig) return;
    let status = Array(N).fill("face-down") as TableauStatus[];
    for(let i = 18; i < 28; i++) status[i] = "uncovered";
    
    set({
      tableau: orig.tableau,
      tableauStatus: status,
      stock: orig.stock,
      waste: [orig.waste],
      score: 0,
      streak: 1,
      isWon: false,
      isLost: false,
      history: [],
      lastAnnouncement: null
    });
  },

  playCard: (idx: number) => {
    const state = get();
    if (state.isWon || state.isLost) return;
    // Reconcile against the blocker graph before validating the tap so the
    // visual stack and logical clickability can never drift apart.
    const reconciledStatus = computeUncovered(state.tableauStatus);
    if (reconciledStatus[idx] !== "uncovered") return;
    
    const card = state.tableau[idx];
    const topWaste = state.waste[state.waste.length - 1];
    
    if (!isAdjacent(topWaste, card)) {
      set({ lastAnnouncement: "illegal" });
      return;
    }
    
    const nextStreak = Math.min(5, state.streak + 1);
    const addedScore = 100 * state.streak;
    let newScore = state.score + addedScore;
    
    if (idx === 0 || idx === 1 || idx === 2) {
      newScore += 500; // peak clear
    }
    
    const newStatus = [...reconciledStatus];
    newStatus[idx] = "played";
    const finalStatus = computeUncovered(newStatus);
    
    const newWaste = [...state.waste, card];
    
    const { isWon, isLost } = checkWinLose(finalStatus, state.stock, card, state.tableau);
    if (isWon) {
      newScore += 1000;
    }
    
    set({
      history: [...state.history, {
        type: "play",
        card,
        tableauIdx: idx,
        prevScore: state.score,
        prevStreak: state.streak,
        prevStatus: state.tableauStatus
      }],
      tableauStatus: finalStatus,
      waste: newWaste,
      score: newScore,
      streak: nextStreak,
      isWon,
      isLost,
      lastAnnouncement: isWon ? "win" : (idx <= 2 ? "peak" : `play:${card}`)
    });
  },

  drawStock: () => {
    const state = get();
    if (state.isWon || state.isLost || state.stock.length === 0) return;
    
    const newStock = [...state.stock];
    const card = newStock.pop()!;
    const newWaste = [...state.waste, card];
    
    const isWild = card === "WILD";
    const nextStreak = isWild ? state.streak : 1;
    
    const { isWon, isLost } = checkWinLose(state.tableauStatus, newStock, card, state.tableau);
    
    set({
      history: [...state.history, {
        type: "draw",
        card,
        prevScore: state.score,
        prevStreak: state.streak,
        prevStatus: state.tableauStatus // same but keep for consistency
      }],
      stock: newStock,
      waste: newWaste,
      streak: nextStreak,
      isWon,
      isLost,
      lastAnnouncement: isLost ? "lose" : (isWild ? "wild" : `draw:${card}`)
    });
  },

  undo: () => {
    const state = get();
    if (state.history.length === 0) return;
    
    const newHistory = [...state.history];
    const last = newHistory.pop()!;
    
    let newStock = state.stock;
    let newWaste = [...state.waste];
    let newStatus = state.tableauStatus;
    
    if (last.type === "play") {
      newWaste.pop(); // remove from waste
      newStatus = last.prevStatus;
    } else if (last.type === "draw") {
      newWaste.pop(); // remove from waste
      newStock = [...state.stock, last.card];
    }
    
    set({
      history: newHistory,
      stock: newStock,
      waste: newWaste,
      tableauStatus: newStatus,
      score: last.prevScore,
      streak: last.prevStreak,
      isWon: false,
      isLost: false,
      lastAnnouncement: "undo"
    });
  }
}));
