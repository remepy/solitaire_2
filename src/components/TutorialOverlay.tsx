import React, { useEffect, useRef } from "react";
import { useTutorial, spotlightTargets, primaryTarget, type TutStep, type TutTarget } from "@/store/tutorial";
import { useSession } from "@/context/SessionContext";
import type { TKey } from "@/lib/translations";
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
// except for the explanation buttons, whose callbacks are owned by Board.

export const TUT_BUBBLE_TEXT_ID = "tut-bubble-text";

const DIM = "rgba(0,0,0,0.55)";
const GOLD = "#FFD166";
const CREAM = "#F7F1E3";
const CUTOUT_PAD = 8;
const CUTOUT_RADIUS = 12;

// All explanations live below the tableau (which ends at y=240), in the
// controls space opposite the piles. Neither cards nor piles are covered.
// This space mirrors; card connectors still use physical tableau geometry.
const BUBBLE_BOX = { x: 54, y: 260, w: 510, h: 112 };

const STEP_COPY: Record<Exclude<TutStep, "idle" | "done">, { n: number | null; action: TKey; rule: TKey }> = {
  intro:   { n: 1,    action: "tut.intro.action", rule: "tut.intro.rule" },
  step1:   { n: 2,    action: "tut.s1.action", rule: "tut.s1.rule" },
  step2:   { n: 3,    action: "tut.s2.action", rule: "tut.s2.rule" },
  step3:   { n: 4,    action: "tut.s3.action", rule: "tut.s3.rule" },
  step4:   { n: 5,    action: "tut.s4.action", rule: "tut.s4.rule" },
  handoff: { n: null, action: "tut.handoff.action", rule: "tut.handoff.rule" },
};

function targetRect(target: TutTarget, rtl: boolean): Rect {
  if (target === "stock") return getStockTapRect(rtl);
  if (target === "waste") return getWasteRect(rtl);
  return getCardRect(Number(target.slice(5)));
}

function pad(r: Rect, p: number): Rect {
  return { left: r.left - p, top: r.top - p, width: r.width + 2 * p, height: r.height + 2 * p };
}

export function TutorialOverlay({ onContinue, onDismiss, hintContinue = false }: { onContinue: () => void; onDismiss: () => void; hintContinue?: boolean }) {
  const step = useTutorial((s) => s.step);
  const { t, translations, reducedMotion } = useSession();
  const rtl = translations?.dir === "rtl";
  const doneBtnRef = useRef<HTMLButtonElement>(null);

  // Only informational steps focus a button; gameplay steps focus the card.
  useEffect(() => {
    if (step === "intro" || step === "handoff") doneBtnRef.current?.focus({ preventScroll: true });
  }, [step]);

  if (step === "idle" || step === "done") return null;

  const isHandoff = step === "handoff";
  const isIntro = step === "intro";
  const hasButton = isIntro || isHandoff;
  const spotlights = spotlightTargets(step).map((tg) => pad(targetRect(tg, rtl), CUTOUT_PAD));
  const box = BUBBLE_BOX;
  const bubbleX = rtl ? box.x : FRAME_W - box.x - box.w;
  const copy = STEP_COPY[step];
  const waste = getWasteRect(rtl);

  // Connect to the real lower edge of the tableau target. A short bent line
  // handles the English step-1 target outside the mirrored bubble's width.
  const primary = primaryTarget(step);
  const target = primary?.startsWith("card:") ? targetRect(primary, rtl) : null;
  const connectorX = target
    ? Math.min(box.w - 28, Math.max(28, target.left + target.width / 2 - bubbleX))
    : null;

  const fade = reducedMotion ? "" : "transition-opacity duration-150";
  const maskId = `tut-mask-${step}`;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-[400]"
      dir="ltr"
      data-testid={`tutorial-overlay-${step}`}
      aria-live="off"
    >
      {/* Dim with mask cut-outs. Cross-fades between steps; gone in HANDOFF. */}
      {!isHandoff && (
        <svg
          key={maskId}
          className={cn("absolute left-0 top-0", fade, !reducedMotion && "animate-in fade-in duration-150")}
          width={FRAME_W}
          height={FRAME_H}
          viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
          aria-hidden="true"
        >
          <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={FRAME_W} height={FRAME_H}>
              <rect x="0" y="0" width={FRAME_W} height={FRAME_H} fill="white" />
              {/* Inspecting "no moves" requires every tableau card at full
                  brightness, not just a spotlight on the deck. */}
              {step === "step2" && <rect x="46" y="38" width="752" height="210" rx="8" fill="black" />}
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
      {target && connectorX !== null && (
        <svg className="absolute left-0 top-0" width={FRAME_W} height={FRAME_H} aria-hidden="true">
          <path
            d={`M ${bubbleX + connectorX} ${box.y} L ${target.left + target.width / 2} ${target.top + target.height + CUTOUT_PAD}`}
            stroke={GOLD} strokeWidth="3" fill="none" strokeLinecap="round"
          />
        </svg>
      )}
      {isIntro && (
        <span
          className="absolute w-4 h-4 rotate-45"
          style={{ left: rtl ? bubbleX + box.w - 8 : bubbleX - 8, top: waste.top + waste.height / 2 - 8, background: CREAM }}
          aria-hidden="true"
        />
      )}
      <div
        className="absolute rounded-full text-[12px] leading-[18px] font-bold text-slate-900 text-center"
        style={{ left: waste.left - 20, top: 362, width: 110, background: GOLD }}
        data-testid="tutorial-reference-label"
      >
        {t("tut.reference")}
      </div>

      {/* Coach bubble */}
      <div
        key={`bubble-${step}`}
        className={cn(
          "absolute rounded-2xl shadow-lg px-4 py-3 text-slate-900 flex items-center gap-4",
          hasButton ? "pointer-events-auto" : "pointer-events-none",
          !reducedMotion && "animate-in fade-in duration-150"
        )}
        style={{ left: bubbleX, top: box.y, width: box.w, minHeight: box.h, background: CREAM }}
        role={hasButton ? "dialog" : undefined}
        aria-labelledby={hasButton ? TUT_BUBBLE_TEXT_ID : undefined}
        dir={rtl ? "rtl" : "ltr"}
        data-testid="tutorial-bubble"
        data-tut-interactive
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

        <div id={TUT_BUBBLE_TEXT_ID} className="flex-1 min-w-0 text-[17px] leading-[22px]">
          <div className="font-bold">{t(copy.action)}</div>
          <div>{t(copy.rule)}</div>
        </div>

        {hasButton && (
          <div className="shrink-0 flex justify-center">
            <button
              ref={doneBtnRef}
              type="button"
              onClick={isIntro ? onContinue : onDismiss}
              className={cn(
                "min-w-[150px] h-[58px] px-6 rounded-full font-bold text-[18px] text-slate-900 shadow active:scale-95 focus-visible:ring-4 focus-visible:ring-amber-500",
                hintContinue && "outline outline-4 outline-offset-4 outline-slate-900",
              )}
              style={{ background: GOLD }}
              data-testid={isIntro ? "tutorial-next" : "tutorial-done"}
              data-tut-interactive
            >
              {t(isIntro ? "tut.next" : "tut.done")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
