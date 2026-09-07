// Single source of truth for board geometry inside the 844 × 390 frame.
// The tableau is a physical, never-mirrored coordinate system; the stock
// and waste piles mirror by language. The tutorial overlay anchors to these
// same numbers, so scaling and RTL/LTR mirroring keep bubble tails correct.

import type { Lang } from "@/lib/i18n";

export const FRAME_W = 844;
export const FRAME_H = 390;
export const CARD_W = 70;
export const CARD_H = 98;

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const TABLEAU_U_VALUES = [
  // row 0
  1.5, 4.5, 7.5,
  // row 1
  1, 2, 4, 5, 7, 8,
  // row 2
  0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5,
  // row 3
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9
];

const TABLEAU_R_VALUES = [
  ...Array(3).fill(0),
  ...Array(6).fill(1),
  ...Array(9).fill(2),
  ...Array(10).fill(3)
];

export function getCardPos(idx: number) {
  const u = TABLEAU_U_VALUES[idx];
  const r = TABLEAU_R_VALUES[idx];
  return { left: 54 + 74 * u, top: 46 + 32 * r };
}

export function getCardRect(idx: number): Rect {
  const { left, top } = getCardPos(idx);
  return { left, top, width: CARD_W, height: CARD_H };
}

export function getStockPos(lang: Lang) {
  return { left: lang === "he" ? 720 : 54, top: 259 };
}

// The dashed 100 × 110 tap zone around the stock (controls band top 248 + 11).
export function getStockTapRect(lang: Lang): Rect {
  return { left: lang === "he" ? FRAME_W - 44 - 100 : 44, top: 259, width: 100, height: 110 };
}

export function getWastePos(lang: Lang) {
  return { left: lang === "he" ? 596 : 176, top: 258 };
}

export function getWasteRect(lang: Lang): Rect {
  const { left, top } = getWastePos(lang);
  return { left, top, width: CARD_W, height: CARD_H };
}
