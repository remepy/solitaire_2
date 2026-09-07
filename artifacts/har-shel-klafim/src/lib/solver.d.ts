export const N: number;
export const coveredBy: number[][];
export const BOARD: string;
export const STOCK_SIZE: number;
export const WILD_CHANCE: number;
export function isSolvable(tableauRanks: number[], stockRanks: number[], wasteRank: number): boolean;
export function generateSolvableDeal(wildMode?: "auto" | "always" | "never", rng?: () => number, maxAttempts?: number): { attempts: number; deal: any };
export function generateDeal(wildMode?: "auto" | "always" | "never", rng?: () => number, maxAttempts?: number): { attempts: number; deal: any };
export function playGreedy(tableauRanks: number[], stockRanks: number[], wasteRank: number, rng?: () => number): boolean;
