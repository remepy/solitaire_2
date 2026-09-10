import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PlayingCard } from "./Card";
import { useGame, isAdjacent, computeUncovered } from "@/store/game";
import { useSettings } from "@/store/settings";
import { t, type TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { RotateCcw, Lightbulb } from "lucide-react";
import { WinLoseOverlay } from "./WinLoseOverlay";
import { PortraitOverlay } from "./overlay/PortraitOverlay";
import { useIsRotated } from "@/hooks/useIsRotated";
import { TutorialOverlay, TUT_BUBBLE_TEXT_ID } from "./TutorialOverlay";
import { TutorialRestartDialog } from "./TutorialRestartDialog";
import { useTutorial, isGuidedStep, isAllowed, primaryTarget, type TutTarget } from "@/store/tutorial";
import { FRAME_W, FRAME_H, getCardPos, getStockPos, getStockTapRect, getWastePos } from "@/lib/layout";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const TUT_TEXT_KEYS = {
  intro: "tut.intro.action",
  step1: "tut.s1.action",
  step2: "tut.s2.action",
  step3: "tut.s3.action",
  step4: "tut.s4.action",
  handoff: "tut.handoff.action",
} as const;

export function GameBoard() {
  const { lang, sound, tutorialSeen } = useSettings();
  const reducedMotion = useReducedMotion();
  const game = useGame();
  const isPortrait = useIsRotated();
  const tutStep = useTutorial((s) => s.step);
  const startTutorial = useTutorial((s) => s.start);
  const guided = isGuidedStep(tutStep);
  const tutTarget = guided ? primaryTarget(tutStep) : null;

  // Restarting the tutorial replaces the deal, so a round already in progress
  // is only discarded after the player confirms.
  const [confirmTutorial, setConfirmTutorial] = useState(false);
  const requestTutorial = () => {
    if (useGame.getState().history.length > 0) setConfirmTutorial(true);
    else startTutorial();
  };

  // Rejection feedback: the tapped element wiggles and the waste highlights.
  const [rejected, setRejected] = useState<TutTarget | "controls" | null>(null);
  useEffect(() => {
    if (!rejected) return;
    const id = setTimeout(() => setRejected(null), 350);
    return () => clearTimeout(id);
  }, [rejected]);
  
  // Audio refs
  const audioCtx = useRef<AudioContext | null>(null);
  
  const playSound = (type: "tap" | "win" | "lose" | "error") => {
    if (!sound) return;
    try {
      if (!audioCtx.current) {
        audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtx.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === "tap") {
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === "error") {
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === "win") {
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.setValueAtTime(600, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(800, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      }
    } catch(e) {}
  };
  
  useEffect(() => {
    if (!game.originalDeal) {
      // The tutorial runs by itself only on a player's first launch; after
      // that it is opt-in through the board's tutorial button.
      if (tutorialSeen) game.newDeal();
      else startTutorial();
    }
  }, []);
  
  const [ariaMsg, setAriaMsg] = useState("");

  // Tutorial step start: announce the action line and move focus to the
  // element the player must activate (spec §5).
  useEffect(() => {
    if (tutStep === "idle" || tutStep === "done") return;
    const key = TUT_TEXT_KEYS[tutStep];
    const ruleKey = key.replace(".action", ".rule") as TranslationKey;
    setAriaMsg(`${t(lang, key)}. ${t(lang, ruleKey)}`);
    const target = primaryTarget(tutStep);
    if (!target) return;
    const el = document.getElementById(target === "stock" ? "stock-area" : `tableau-${target.slice(5)}`);
    el?.focus({ preventScroll: true });
  }, [tutStep, lang]);
  useEffect(() => {
    if (!game.lastAnnouncement) return;
    const msg = game.lastAnnouncement;
    if (msg === "illegal") {
      setAriaMsg(t(lang, "a11y.illegal"));
      playSound("error");
    } else if (msg === "win") {
      setAriaMsg(t(lang, "end.win"));
      playSound("win");
    } else if (msg === "lose") {
      setAriaMsg(t(lang, "a11y.noMoves"));
      playSound("lose");
    } else if (msg === "undo") {
      setAriaMsg(t(lang, "a11y.undo"));
      playSound("tap");
    } else if (msg.startsWith("play:")) {
      const code = msg.split(":")[1];
      setAriaMsg(t(lang, "a11y.played", { card: code })); 
      playSound("tap");
    } else if (msg.startsWith("draw:")) {
      const code = msg.split(":")[1];
      setAriaMsg(t(lang, "a11y.drew", { card: code }));
      playSound("tap");
    } else if (msg === "wild") {
      setAriaMsg(t(lang, "a11y.wild"));
      playSound("tap");
    } else if (msg === "peak") {
      setAriaMsg(t(lang, "a11y.peak"));
      playSound("win");
    }
    // A move and its next coaching step arrive together. Keep the full
    // instruction in the live region rather than overwriting it with "Played".
    if (tutStep !== "idle" && tutStep !== "done") {
      const key = TUT_TEXT_KEYS[tutStep];
      const ruleKey = key.replace(".action", ".rule") as TranslationKey;
      setAriaMsg(`${t(lang, key)}. ${t(lang, ruleKey)}`);
    }
  }, [game.lastAnnouncement, lang, sound]);
  
  useEffect(() => {
    if (isPortrait) {
      setAriaMsg(t(lang, "a11y.paused"));
    } else {
      if (game.originalDeal) setAriaMsg(t(lang, "a11y.resumed"));
    }
  }, [isPortrait, lang]);

  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const boardReady = game.originalDeal !== null;

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    // Measure the safe content box, not the full viewport. Native safe-area
    // padding handles BOTH landscape directions without guessing the notch
    // side from screen.orientation or applying a second sideways offset.
    const EDGE_MARGIN = 8;
    const fit = (width: number, height: number) => {
      const availableW = Math.min(Math.max(0, width - EDGE_MARGIN * 2), 932);
      const availableH = Math.max(0, height - EDGE_MARGIN * 2);
      setScale(Math.min(availableW / FRAME_W, availableH / FRAME_H));
    };
    // Fit before the first visible paint, then track rotation, safe-area and
    // browser-chrome size changes via the stage's content box.
    const padding = getComputedStyle(stage);
    fit(
      stage.clientWidth - parseFloat(padding.paddingLeft) - parseFloat(padding.paddingRight),
      stage.clientHeight - parseFloat(padding.paddingTop) - parseFloat(padding.paddingBottom),
    );
    const observer = new ResizeObserver(([entry]) => {
      fit(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(stage);
    return () => observer.disconnect();
    // The initial render has no deal and returns null. Attach the observer
    // when the stage actually mounts, not only on GameBoard's first render.
  }, [boardReady]);

  const [hintIdx, setHintIdx] = useState<number | null>(null);
  const hintTimer = useRef<number | null>(null);

  const clearHint = () => {
    if (hintTimer.current !== null) {
      clearTimeout(hintTimer.current);
      hintTimer.current = null;
    }
    setHintIdx(null);
  };

  // A hint glow must never outlive the deal it belongs to: loading another
  // deal (a new game, or an on-demand tutorial restart) would otherwise leave
  // an unrelated card glowing for the rest of the 1.5s timeout.
  useEffect(() => clearHint, []);
  useEffect(() => {
    clearHint();
  }, [game.originalDeal]);

  const handleHint = () => {
    if (game.isWon || game.isLost) return;
    const topWaste = game.waste[game.waste.length - 1];
    const legalIndices = [];
    for (let i=0; i<28; i++) {
      if (game.tableauStatus[i] === "uncovered" && isAdjacent(topWaste, game.tableau[i])) {
        legalIndices.push(i);
      }
    }
    if (legalIndices.length > 0) {
      let bestIndices: number[] = [];
      let bestScore = -1;
      for (const idx of legalIndices) {
        const tempStatus = [...game.tableauStatus];
        tempStatus[idx] = "played";
        const nextStatus = computeUncovered(tempStatus);
        const uncoveredCount = nextStatus.filter(s => s === "uncovered").length;
        if (uncoveredCount > bestScore) {
          bestScore = uncoveredCount;
          bestIndices = [idx];
        } else if (uncoveredCount === bestScore) {
          bestIndices.push(idx);
        }
      }
      const chosen = bestIndices[Math.floor(Math.random() * bestIndices.length)];
      setHintIdx(chosen);
      if (hintTimer.current !== null) clearTimeout(hintTimer.current);
      hintTimer.current = window.setTimeout(() => {
        hintTimer.current = null;
        setHintIdx(null);
      }, 1500);
      playSound("tap");
    } else {
      setAriaMsg(t(lang, "a11y.noMoves"));
      playSound("error");
    }
  };
  
  const lastAction = useRef(0);
  const DEBOUNCE = 300;
  
  const withDebounce = (fn: () => void) => () => {
    if (isPortrait) return;
    const now = Date.now();
    if (now - lastAction.current > DEBOUNCE) {
      lastAction.current = now;
      fn();
    }
  };

  // Tutorial input gating (spec §7): during a guided step, any tap outside
  // the allowed target gets rejection feedback and never reaches the game.
  const rejectTap = (what: TutTarget | "controls") => {
    setRejected(what);
    playSound("error");
  };
  const gated = (target: TutTarget, fn: () => void) => () => {
    if (guided && !isAllowed(tutStep, target)) return rejectTap(target);
    fn();
  };
  const gatedControl = (fn: () => void) => () => {
    if (guided) return rejectTap("controls");
    fn();
  };
  // Taps that land on the dimmed background (including face-down cards,
  // which are pointer-transparent) still get the standard rejection cue.
  const onFrameClick = (e: React.MouseEvent) => {
    if (!guided || isPortrait) return;
    if ((e.target as Element).closest("[data-tut-interactive]")) return;
    rejectTap("waste");
  };

  if (!game.originalDeal) return null;
  
  const wasteTop = game.waste[game.waste.length - 1];
  const stockCount = game.stock.length;
  // Coverage is derived from the solver's blocker graph on every render.
  // This prevents a fully exposed card from remaining visually face-down.
  const displayStatuses = computeUncovered(game.tableauStatus);

  const { left: stockLeft, top: stockTop } = getStockPos(lang);
  const stockTapRect = getStockTapRect(lang);
  const { left: wasteLeft, top: wasteTopPos } = getWastePos(lang);

  // HANDOFF shows the legal cards glowing until the player's next move.
  const handoffGlow = new Set<number>();
  if (tutStep === "handoff") {
    for (let i = 0; i < 28; i++) {
      if (displayStatuses[i] === "uncovered" && isAdjacent(wasteTop, game.tableau[i])) handoffGlow.add(i);
    }
  }
  const glowClass = "ring-4 ring-primary ring-offset-2 ring-offset-background scale-[1.05]";
  const controlsDim = guided ? "opacity-40" : "";

  return (
    <div 
      ref={stageRef}
      data-testid="game-stage"
      className={cn(
        "fixed inset-0 bg-background text-foreground flex items-center justify-center overflow-hidden touch-none",
        ""
      )}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingRight: "env(safe-area-inset-right)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
      }}
      dir={lang === "he" ? "rtl" : "ltr"}
      lang={lang}
    >
      <div 
        className={cn(
          "relative shrink-0 origin-center",
          isPortrait ? "pointer-events-none" : ""
        )}
        // Keep the coordinate frame full-size even when it is wider than the
        // safe area. ONLY the shared transform may scale cards and overlays;
        // flex-shrink would change the RTL SVG origin without moving cards.
        style={{ width: FRAME_W, height: FRAME_H, transform: `scale(${scale})` }}
        data-testid="game-frame"
        aria-hidden={isPortrait}
        inert={isPortrait ? true : undefined}
        onClick={onFrameClick}
      >
        {/* Header strip. No HUD here: score and streak are still tracked in the
            game store for scoring logic, but nothing about them is shown. The
            only control is the on-demand tutorial. */}
        <div className="absolute top-0 inset-x-0 h-[46px] flex items-center px-[54px] z-[200]">
          <button
            onClick={withDebounce(gatedControl(requestTutorial))}
            className={cn(
              "h-[38px] px-4 flex items-center rounded-full text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-95",
              controlsDim,
              rejected === "controls" && !reducedMotion && "tut-wiggle",
            )}
            aria-label={t(lang, "btn.tutorial")}
            aria-disabled={guided || undefined}
            data-testid="btn-tutorial"
            data-tut-interactive
          >
            {t(lang, "btn.tutorial")}
          </button>
        </div>

        {/* The tableau is a physical, never-mirrored coordinate system.
            The layer itself must be pointer-transparent: it spans the whole
            frame and would otherwise swallow taps meant for other controls. */}
        <div className="absolute inset-0 pointer-events-none" dir="ltr">
          {game.tableau.map((code, index) => {
            const status = displayStatuses[index];
            if (status === "played") return null;
            const position = getCardPos(index);
            const target: TutTarget = `card:${index}`;
            const isTutTarget = tutTarget === target;
            const isHinted = index === hintIdx || isTutTarget || handoffGlow.has(index);
            return (
              <PlayingCard
                key={`tableau-${index}`}
                id={`tableau-${index}`}
                code={code}
                status={status}
                // Only uncovered cards are controls; face-down cards are
                // pointer-transparent images and stay out of the tab order.
                onClick={status === "uncovered" ? withDebounce(gated(target, () => game.playCard(index))) : undefined}
                // Once a card is logically uncovered, it must render above
                // every remaining face-down layer. Preserve physical order
                // within each status group using the tableau index.
                // The tutorial target rises above the dim layer's cut-out.
                zIndex={isTutTarget ? 450 : status === "uncovered" ? 100 + index : index}
                left={position.left}
                top={position.top}
                className={isHinted ? glowClass : ""}
                ariaDescribedBy={isTutTarget ? TUT_BUBBLE_TEXT_ID : undefined}
                ariaDisabled={guided && !isTutTarget}
                wiggle={rejected === target}
              />
            );
          })}
        </div>

        {/* Show a subtle three-card stack, fully inside the dashed stock target. */}
        {game.stock.slice(-3).map((code, visibleIndex, visibleStock) => {
          const isTop = visibleIndex === visibleStock.length - 1;
          const offset = (visibleStock.length - 1 - visibleIndex) * 3;
          return (
            <PlayingCard
              key={`stock-${game.stock.length - visibleStock.length + visibleIndex}`}
              code={code}
              status="stock"
              onClick={isTop ? withDebounce(gated("stock", game.drawStock)) : undefined}
              isStock
              zIndex={200 + visibleIndex}
              wiggle={isTop && rejected === "stock"}
              left={stockLeft + (lang === "he" ? -offset : offset)}
              top={stockTop - offset}
            />
          );
        })}

        <PlayingCard
          key={`waste-${game.waste.length}`}
          code={wasteTop}
          status="waste"
          isWaste
          zIndex={150}
          left={wasteLeft}
          top={wasteTopPos}
          className={rejected ? "ring-4 ring-destructive ring-offset-2 ring-offset-background" : ""}
        />
        
        {/* Controls Band */}
        <div className="absolute top-[248px] inset-x-0 h-[120px]">
          {/* Stock Area Hitbox */}
          <div 
            id="stock-area"
            className={cn(
              "absolute top-[11px] z-[180] w-[100px] h-[110px] rounded-xl border-2 border-dashed border-muted flex items-center justify-center cursor-pointer",
              "focus:outline-none focus-visible:ring-4 focus-visible:ring-primary",
              rejected === "stock" && !reducedMotion && "tut-wiggle"
            )}
            style={{ left: stockTapRect.left }}
            onClick={withDebounce(gated("stock", game.drawStock))}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                withDebounce(gated("stock", game.drawStock))();
              }
            }}
            data-testid="stock-area"
            aria-label={t(lang, "a11y.stock", { n: stockCount })}
            aria-describedby={tutTarget === "stock" ? TUT_BUBBLE_TEXT_ID : undefined}
            aria-disabled={guided && tutTarget !== "stock" ? true : undefined}
            role="button"
            tabIndex={0}
            data-tut-interactive
          />

          <div
            className="absolute top-0 z-[300] bg-primary text-primary-foreground font-bold rounded-full w-8 h-8 flex items-center justify-center shadow-md pointer-events-none"
            style={{ left: lang === "he" ? 774 : 112 }}
            aria-hidden="true"
          >
            {stockCount}
          </div>
          
          {/* Pills */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 flex items-center gap-6"
            style={{ insetInlineEnd: 54 }}
          >
            <button
              onClick={withDebounce(gatedControl(game.undo))}
              disabled={!guided && game.history.length === 0}
              className={cn("w-[150px] h-[58px] flex items-center justify-center gap-2 bg-secondary text-secondary-foreground font-semibold rounded-full hover:bg-secondary/80 disabled:opacity-50 disabled:pointer-events-none transition-colors active:scale-95 z-[200]", controlsDim, rejected === "controls" && !reducedMotion && "tut-wiggle")}
              aria-label={t(lang, "btn.undo")}
              aria-disabled={guided || undefined}
              data-testid="btn-undo"
              data-tut-interactive
            >
              <RotateCcw className={cn("w-5 h-5", lang === "he" && "scale-x-[-1]")} />
              <span>{t(lang, "btn.undo")}</span>
            </button>
            
            <button
              onClick={withDebounce(gatedControl(handleHint))}
              className={cn("w-[150px] h-[58px] flex items-center justify-center gap-2 bg-secondary text-secondary-foreground font-semibold rounded-full hover:bg-secondary/80 transition-colors active:scale-95 z-[200]", controlsDim, rejected === "controls" && !reducedMotion && "tut-wiggle")}
              aria-label={t(lang, "btn.hint")}
              aria-disabled={guided || undefined}
              data-testid="btn-hint"
              data-tut-interactive
            >
              <Lightbulb className="w-5 h-5" />
              <span>{t(lang, "btn.hint")}</span>
            </button>
          </div>
        </div>

        {/* Coaching layer: reads game/tutorial state only; gating is above. */}
        <TutorialOverlay
          onContinue={useTutorial.getState().continueIntro}
          onDismiss={useTutorial.getState().dismissHandoff}
        />
      </div>
      
      <div className="sr-only" aria-live="polite" role="status">
        {ariaMsg}
      </div>
      
      {confirmTutorial && (
        <TutorialRestartDialog
          onConfirm={() => {
            setConfirmTutorial(false);
            startTutorial();
          }}
          onCancel={() => setConfirmTutorial(false)}
        />
      )}

      {(game.isWon || game.isLost) && <WinLoseOverlay />}
      <PortraitOverlay visible={isPortrait} message={t(lang, "rotate.prompt")} />
    </div>
  );
}
