export const N: number;
export const coveredBy: number[][];
export const BOARD: string;
export const STOCK_SIZE: number;
export const WILD_CHANCE: number;
export function isSolvable(tableauRanks: number[], stockRanks: number[], wasteRank: number): boolean;
export function generateSolvableDeal(wildMode?: "auto" | "always" | "never", rng?: () => number, maxAttempts?: number): { attempts: number; deal: any };
export function generateDeal(wildMode?: "auto" | "always" | "never", rng?: () => number, maxAttempts?: number): { attempts: number; deal: any };
export function playGreedy(tableauRanks: number[], stockRanks: number[], wasteRank: number, rng?: () => number): boolean;
export const RANKS: string[];
export function mulberry32(seed: number): () => number;
export type SolverMove = { type: "play"; index: number } | { type: "draw" };
/**
 * A move lying on a winning line from the given position, or null when no
 * winning line remains. `playedMask` is a 28-bit mask of removed tableau cards.
 */
export function findBestMove(
  tableauRanks: number[],
  stockRanks: number[],
  wasteRank: number,
  playedMask?: number,
): SolverMove | null;
