/**
 * Copy is loaded from ./translations.json next to the page (BR-12) — one
 * language-specific build per URL (spec §4). There are no fallback strings:
 * if the file is missing, unparseable or incomplete the caller reports
 * translations_unavailable and renders nothing (BR-13).
 */
export const REQUIRED_KEYS = [
  "a11y.cardFaceDown",
  "a11y.drew",
  "a11y.hint",
  "a11y.illegal",
  "a11y.noMoves",
  "a11y.paused",
  "a11y.peak",
  "a11y.played",
  "a11y.resumed",
  "a11y.stock",
  "a11y.undo",
  "a11y.waste",
  "a11y.wild",
  "btn.exit",
  "btn.hint",
  "btn.nextRound",
  "btn.playAgain",
  "btn.sound",
  "btn.tutorial",
  "btn.undo",
  "card.name",
  "card.rank.10",
  "card.rank.2",
  "card.rank.3",
  "card.rank.4",
  "card.rank.5",
  "card.rank.6",
  "card.rank.7",
  "card.rank.8",
  "card.rank.9",
  "card.rank.A",
  "card.rank.J",
  "card.rank.K",
  "card.rank.Q",
  "card.suit.C",
  "card.suit.D",
  "card.suit.H",
  "card.suit.S",
  "card.wild",
  "end.lostSubtitle",
  "end.lostTitle",
  "end.wonSubtitle",
  "end.wonTitle",
  "hud.roundOf",
  "hud.stockCount",
  "rotate.prompt",
  "title",
  "tut.confirmNo",
  "tut.confirmRestart",
  "tut.confirmYes",
  "tut.done",
  "tut.handoff.action",
  "tut.handoff.rule",
  "tut.hintContinue",
  "tut.intro.action",
  "tut.intro.rule",
  "tut.next",
  "tut.reference",
  "tut.s1.action",
  "tut.s1.rule",
  "tut.s2.action",
  "tut.s2.rule",
  "tut.s3.action",
  "tut.s3.rule",
  "tut.s4.action",
  "tut.s4.rule",
] as const;

export type TKey = (typeof REQUIRED_KEYS)[number];
export type TextDirection = "ltr" | "rtl";

export type Translations = {
  locale: string;
  dir: TextDirection;
  keys: Record<TKey, string>;
};

function validate(raw: unknown): Translations {
  if (!raw || typeof raw !== "object") throw new Error("translations: not an object");
  const { locale, dir, keys } = raw as { locale?: unknown; dir?: unknown; keys?: unknown };
  if (typeof locale !== "string" || locale.length === 0) throw new Error("translations: bad locale");
  if (dir !== "ltr" && dir !== "rtl") throw new Error("translations: bad dir");
  if (!keys || typeof keys !== "object") throw new Error("translations: bad keys");
  const map = keys as Record<string, unknown>;
  for (const key of REQUIRED_KEYS) {
    if (typeof map[key] !== "string" || (map[key] as string).length === 0) {
      throw new Error(`translations: missing key ${key}`);
    }
  }
  return { locale, dir, keys: map as Record<TKey, string> };
}

/** Substitutes {name} placeholders. */
export function format(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    name in params ? String(params[name]) : match,
  );
}

export async function loadTranslations(): Promise<Translations> {
  const response = await fetch("./translations.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(`translations: http ${response.status}`);
  return validate(await response.json());
}
