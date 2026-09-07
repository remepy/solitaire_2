import React, { useEffect, useRef } from "react";
import { useTutorial, spotlightTargets, primaryTarget, type TutStep, type TutTarget } from "@/store/tutorial";
import { useSettings } from "@/store/settings";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { t, type Lang, type TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  FRAME_W, FRAME_H,
  getCardRect, getStockTapRect, getWasteRect,
  type Rect,
} from "@/lib/layout";

// Coaching layer (tutorial spec §4). Renders inside the scaled 844 × 390
// frame so every coordinate is a frame coordinate: scaling and RTL/LTR
// mirroring come for free. This component only READS state — input gating
// happens in the board's tap handler, so the layer is pointer-transparent
// except for the real «הבנתי» button in HANDOFF.

export const TUT_BUBBLE_TEXT_ID = "tut-bubble-text";

const DIM = "rgba(0,0,0,0.55)";
const GOLD = "#FFD166";
const CREAM = "#F7F1E3";
const CUTOUT_PAD = 8;
const CUTOUT_RADIUS = 12;

// Bubble boxes (x, y, w) in the 844 × 390 frame, from the spec table (RTL).
// Card-target bubbles sit over the never-mirrored tableau rows, so they keep
// the same x in both languages; the stock bubble mirrors with the stock.
const BUBBLE_BOX: Record<Exclude<TutStep, "idle" | "done">, { x: number; y: number; w: number; mirror: boolean }> = {
  step1:   { x: 60,  y: 48,  w: 370, mirror: false },
  step2:   { x: 390, y: 150, w: 390, mirror: true },
  step3:   { x: 230, y: 48,  w: 300, mirror: false },
  handoff: { x: (FRAME_W - 420) / 2, y: 60, w: 420, mirror: false },
};

const STEP_COPY: Record<Exclude<TutStep, "idle" | "done">, { n: number | null; action: TranslationKey; rule: TranslationKey }> = {
  step1:   { n: 1,    action: "tut.s1.action", rule: "tut.s1.rule" },
  step2:   { n: 2,    action: "tut.s2.action", rule: "tut.s2.rule" },
  step3:   { n: 3,    action: "tut.s3.action", rule: "tut.s3.rule" },
  handoff: { n: null, action: "tut.s4.action", rule: "tut.s4.rule" },
};

function targetRect(target: TutTarget, lang: Lang): Rect {
  if (target === "stock") return getStockTapRect(lang);
  if (target === "waste") return getWasteRect(lang);
  return getCardRect(Number(target.slice(5)));
}

function pad(r: Rect, p: number): Rect {
  return { left: r.left - p, top: r.top - p, width: r.width + 2 * p, height: r.height + 2 * p };
}

export function TutorialOverlay() {
  const step = useTutorial((s) => s.step);
  const dismissHandoff = useTutorial((s) => s.dismissHandoff);
  const lang = useSettings((s) => s.lang);
  const reducedMotion = useReducedMotion();
  const doneBtnRef = useRef<HTMLButtonElement>(null);

  // «הבנתי» is the first focusable element in HANDOFF (spec §5).
  useEffect(() => {
    if (step === "handoff") doneBtnRef.current?.focus();
  }, [step]);

  if (step === "idle" || step === "done") return null;

  const isHandoff = step === "handoff";
  const spotlights = spotlightTargets(step).map((tg) => pad(targetRect(tg, lang), CUTOUT_PAD));
  const box = BUBBLE_BOX[step];
  const bubbleX = box.mirror && lang === "en" ? FRAME_W - box.x - box.w : box.x;
  const copy = STEP_COPY[step];

  // Tail points at the top edge of the primary target.
  const primary = primaryTarget(step);
  const target = primary ? targetRect(primary, lang) : null;
  const tailX = target
    ? Math.min(box.w - 28, Math.max(28, target.left + target.width / 2 - bubbleX))
    : null;

  const fade = reducedMotion ? "" : "transition-opacity duration-150";
  const maskId = `tut-mask-${step}`;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-[400]"
      data-testid={`tutorial-overlay-${step}`}
      aria-live="off"
    >
      {/* Dim with mask cut-outs. Cross-fades between steps; gone in HANDOFF. */}
      {!isHandoff && (
        <svg
          key={maskId}
          className={cn("absolute inset-0", fade, !reducedMotion && "animate-in fade-in duration-150")}
          width={FRAME_W}
          height={FRAME_H}
          viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
          aria-hidden="true"
        >
          <defs>
            <mask id={maskId}>
              <rect x="0" y="0" width={FRAME_W} height={FRAME_H} fill="white" />
              {spotlights.map((r, i) => (
                <rect key={i} x={r.left} y={r.top} width={r.width} height={r.height} rx={CUTOUT_RADIUS} fill="black" />
              ))}
            </mask>
          </defs>
          <rect x="0" y="0" width={FRAME_W} height={FRAME_H} fill={DIM} mask={`url(#${maskId})`} />
          {spotlights.map((r, i) => (
            <rect
              key={`b${i}`}
              x={r.left} y={r.top} width={r.width} height={r.height} rx={CUTOUT_RADIUS}
              fill="none" stroke={GOLD} strokeWidth={2} strokeDasharray="6 4"
            />
          ))}
        </svg>
      )}

      {/* Coach bubble */}
      <div
        key={`bubble-${step}`}
        className={cn(
          "absolute rounded-2xl shadow-lg px-5 py-3 text-slate-900",
          isHandoff ? "pointer-events-auto" : "pointer-events-none",
          !reducedMotion && "animate-in fade-in duration-150"
        )}
        style={{ left: bubbleX, top: box.y, width: box.w, background: CREAM }}
        role={isHandoff ? "dialog" : undefined}
        aria-labelledby={isHandoff ? TUT_BUBBLE_TEXT_ID : undefined}
        dir={lang === "he" ? "rtl" : "ltr"}
        data-testid="tutorial-bubble"
      >
        {copy.n !== null && (
          <span
            className="absolute -top-3 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-slate-900 shadow"
            style={{ background: GOLD, insetInlineStart: -10 }}
            aria-hidden="true"
          >
            {copy.n}
          </span>
        )}

        <div id={TUT_BUBBLE_TEXT_ID} className="text-[18px] leading-snug">
          <div className="font-bold">{t(lang, copy.action)}</div>
          <div>{t(lang, copy.rule)}</div>
        </div>

        {isHandoff && (
          <div className="mt-3 flex justify-center">
            <button
              ref={doneBtnRef}
              type="button"
              onClick={dismissHandoff}
              className="min-w-[150px] h-[58px] px-6 rounded-full font-bold text-[18px] text-slate-900 shadow active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-500"
              style={{ background: GOLD }}
              data-testid="tutorial-done"
            >
              {t(lang, "tut.done")}
            </button>
          </div>
        )}

        {tailX !== null && (
          <span
            className="absolute -bottom-2 w-4 h-4 rotate-45"
            style={{ left: tailX - 8, background: CREAM }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}
