import catalogue from "./deals.json";
import type { OriginalDeal } from "@/store/game";

/**
 * The fixed deal catalogue. Every deal is solvable with perfect play, and the
 * set is calibrated so the game's own hint heuristic wins about a third of
 * them (see tools/generate-deals.mjs). Deals are data, not generated at
 * runtime, so the deal a participant saw at a given level is reproducible.
 */
export interface CatalogueDeal {
  id: string;
  tableau: string[];
  stock: string[];
  waste: string;
}

interface Catalogue {
  version: number;
  board: string;
  seed: number;
  targetWinRate: number;
  measuredWinRate: number;
  count: number;
  deals: CatalogueDeal[];
}

const CATALOGUE = catalogue as Catalogue;

export const DEAL_COUNT = CATALOGUE.deals.length;
export const CATALOGUE_VERSION = CATALOGUE.version;

/**
 * The deal for a level, wrapping after DEAL_COUNT so an 84-day programme that
 * runs long restarts the sequence rather than running out. Accepts any integer
 * and any 0- or 1-based convention, as long as the caller is consistent:
 * levels DEAL_COUNT apart resolve to the same deal.
 */
export function dealForLevel(level: number): OriginalDeal {
  const n = Math.trunc(level);
  const index = ((n % DEAL_COUNT) + DEAL_COUNT) % DEAL_COUNT;
  const entry = CATALOGUE.deals[index];
  return {
    deal_id: entry.id,
    tableau: entry.tableau,
    stock: entry.stock,
    waste: entry.waste,
  };
}

/** The level a deal id belongs to, or null if it is not a catalogue deal. */
export function levelForDealId(dealId: string): number | null {
  const i = CATALOGUE.deals.findIndex((d) => d.id === dealId);
  return i === -1 ? null : i;
}
