// Single source of truth for board geometry inside the 844 × 390 frame.
// The tableau is a physical, never-mirrored coordinate system; the stock
// and waste piles mirror with text direction (spec BR-15: dir comes from the
// loaded translations file, never from a hard-coded default). The tutorial overlay anchors to these
// same numbers, so scaling and RTL/LTR mirroring keep bubble tails correct.

export const FRAME_W = 844;
export const FRAME_H = 390;
export const CARD_W = 70;
export const CARD_H = 98;
// Adjacent cards are 4px apart. Split that gap equally so an imprecise
// tap never has two neighboring targets competing for it.
export const CARD_HIT_X = 2;
export const CARD_HIT_Y = 6;

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// Fit the occupied area, not the unused margins of the logical frame.
// Includes the header focus outline, card rings, pile counter and tutorial
// reference label in BOTH languages. The logical 844×390 layout stays intact.
export const PLAY_BOUNDS: Rect = { left: 38, top: -4, width: 772, height: 388 };

export function getBoardScale(safeWidth: number, safeHeight: number) {
  const edgeMargin = 4;
  return Math.min(
    Math.min(Math.max(0, safeWidth - edgeMargin * 2), 932) / PLAY_BOUNDS.width,
    Math.max(0, safeHeight - edgeMargin * 2) / PLAY_BOUNDS.height,
  );
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

export function getCardHitRect(idx: number): Rect {
  const r = getCardRect(idx);
  return {
    left: r.left - CARD_HIT_X,
    top: r.top - CARD_HIT_Y,
    width: r.width + 2 * CARD_HIT_X,
    height: r.height + 2 * CARD_HIT_Y,
  };
}

export function getStockPos(rtl: boolean) {
  return { left: rtl ? 720 : 54, top: 259 };
}

// The dashed 100 × 110 tap zone around the stock (controls band top 248 + 11).
export function getStockTapRect(rtl: boolean): Rect {
  return { left: rtl ? FRAME_W - 44 - 100 : 44, top: 259, width: 100, height: 110 };
}

export function getWastePos(rtl: boolean) {
  return { left: rtl ? 596 : 176, top: 258 };
}

export function getWasteRect(rtl: boolean): Rect {
  const { left, top } = getWastePos(rtl);
  return { left, top, width: CARD_W, height: CARD_H };
}
