/**
 * Fixed level catalogue: solitaire-001 … solitaire-180. The app owns
 * progression (BR-03) and sends the levelIds for each session; this module
 * maps an id to the deal it always produces.
 *
 * The deals are data, not generated at runtime, so the deal a participant saw
 * at a given level is reproducible from the repo alone. scripts/generate-deals.mjs
 * rebuilds levels.json from a fixed seed.
 */
import catalogue from "./levels.json";
import type { OriginalDeal } from "@/store/game";

export const GAME_ID = "solitaire";
export const ROUNDS_PER_SESSION = 2;

type CatalogueDeal = { id: string; tableau: string[]; stock: string[]; waste: string };

const CATALOGUE = catalogue as {
  version: number;
  gameId: string;
  targetWinRate: number;
  measuredWinRate: number;
  count: number;
  deals: CatalogueDeal[];
};

export const LEVEL_COUNT = CATALOGUE.deals.length;

const ID_PATTERN = /^solitaire-(\d{3})$/;
const BY_ID = new Map(CATALOGUE.deals.map((d) => [d.id, d]));

export function levelIdFromNumber(n: number): string {
  return `${GAME_ID}-${String(n).padStart(3, "0")}`;
}

/** Returns the catalogue number (1..LEVEL_COUNT), or null for an unknown id. */
export function parseLevelId(id: string): number | null {
  const m = ID_PATTERN.exec(id);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= LEVEL_COUNT ? n : null;
}

/** The deal for a level id, or null if the id is not in the catalogue. */
export function dealForLevel(id: string): OriginalDeal | null {
  const entry = BY_ID.get(id);
  if (!entry) return null;
  return { deal_id: entry.id, tableau: entry.tableau, stock: entry.stock, waste: entry.waste };
}

export function isKnownLevel(id: string): boolean {
  return BY_ID.has(id);
}

/** Rounds used when the page runs without the app (BR-09): the first session. */
export function standaloneLevelIds(): string[] {
  return Array.from({ length: ROUNDS_PER_SESSION }, (_, i) => levelIdFromNumber(i + 1));
}
