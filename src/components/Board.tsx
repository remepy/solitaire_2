import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PlayingCard } from "./Card";
import { useGame, isAdjacent, computeUncovered } from "@/store/game";
import { useSession } from "@/context/SessionContext";
import type { TKey } from "@/lib/translations";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";
import { BulbIcon, CloseIcon, HelpIcon, MusicIcon } from "./icons";
import { RoundEndOverlay } from "./RoundEndOverlay";
import { PortraitOverlay } from "./overlay/PortraitOverlay";
import { useIsRotated } from "@/hooks/useIsRotated";
import { TutorialOverlay, TUT_BUBBLE_TEXT_ID } from "./TutorialOverlay";
import { TutorialRestartDialog } from "./TutorialRestartDialog";
import { useTutorial, isGuidedStep, isAllowed, primaryTarget, type TutTarget } from "@/store/tutorial";
import { findBestMove, RANKS, N as N_TABLEAU } from "@/lib/solver";
import { FRAME_W, FRAME_H, PLAY_BOUNDS, getBoardScale, getCardPos, getStockPos, getStockTapRect, getWastePos } from "@/lib/layout";

const TUT_TEXT_KEYS = {
  intro: "tut.intro.action",
  step1: "tut.s1.action",
  step2: "tut.s2.action",
  step3: "tut.s3.action",
  step4: "tut.s4.action",
  handoff: "tut.handoff.action",
} as const;

export function GameBoard() {
  const {
    t, translations, reducedMotion, paused, soundOn, toggleSound,
    requestExit, openTutorial, finishTutorial, noteHint,
    stage,
  } = useSession();
  const rtl = translations?.dir === "rtl";
  const sound = soundOn;
  const game = useGame();
  const isPortrait = useIsRotated();
  const tutStep = useTutorial((s) => s.step);
  const startTutorial = useTutorial((s) => s.start);
  const resetTutorial = useTutorial((s) => s.reset);
  const guided = isGuidedStep(tutStep);
  const tutorialVisible = tutStep !== "idle" && tutStep !== "done";
  const tutTarget = guided ? primaryTarget(tutStep) : null;

  // Restarting the tutorial replaces the deal, so a round already in progress
  // is only discarded after the player confirms.
  const [confirmTutorial, setConfirmTutorial] = useState(false);
  const requestTutorial = () => {
    if (useGame.getState().history.length > 0) setConfirmTutorial(true);
    else openTutorial();
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
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtx.current = new Ctor();
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
      } else if (type === "lose") {
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.35);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === "win") {
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.setValueAtTime(600, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(800, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      }
    } catch {
      // Audio is a nicety: a blocked or unavailable AudioContext must never
      // interrupt play.
    }
  };
  
  // The session decides the stage; entering "tutorial" deals the scripted deal.
  useEffect(() => {
    if (stage === "tutorial") startTutorial();
    else resetTutorial();
  }, [stage, startTutorial, resetTutorial]);

  // The scripted tutorial hands over to the real round once it is done.
  useEffect(() => {
    if (stage === "tutorial" && tutStep === "done") finishTutorial();
  }, [stage, tutStep, finishTutorial]);
  
  const [ariaMsg, setAriaMsg] = useState("");

  // Tutorial step start: announce the action line and move focus to the
  // element the player must activate (spec §5).
  useEffect(() => {
    if (tutStep === "idle" || tutStep === "done") return;
    const key = TUT_TEXT_KEYS[tutStep];
    const ruleKey = key.replace(".action", ".rule") as TKey;
    setAriaMsg(`${t(key)}. ${t(ruleKey)}`);
    const target = primaryTarget(tutStep);
    if (!target) return;
    const el = document.getElementById(target === "stock" ? "stock-area" : `tableau-${target.slice(5)}`);
    el?.focus({ preventScroll: true });
  }, [tutStep, t]);
  useEffect(() => {
    if (!game.lastAnnouncement) return;
    const msg = game.lastAnnouncement;
    if (msg === "illegal") {
      setAriaMsg(t("a11y.illegal"));
      playSound("error");
    } else if (msg === "win") {
      setAriaMsg(t("end.wonTitle"));
      playSound("win");
    } else if (msg === "lose") {
      setAriaMsg(t("a11y.noMoves"));
      playSound("lose");
    } else if (msg === "undo") {
      setAriaMsg(t("a11y.undo"));
      playSound("tap");
    } else if (msg.startsWith("play:")) {
      const code = msg.split(":")[1];
      setAriaMsg(t("a11y.played", { card: code })); 
      playSound("tap");
    } else if (msg.startsWith("draw:")) {
      const code = msg.split(":")[1];
      setAriaMsg(t("a11y.drew", { card: code }));
      playSound("tap");
    } else if (msg === "wild") {
      setAriaMsg(t("a11y.wild"));
      playSound("tap");
    } else if (msg === "peak") {
      setAriaMsg(t("a11y.peak"));
      playSound("win");
    }
    // A move and its next coaching step arrive together. Keep the full
    // instruction in the live region rather than overwriting it with "Played".
    if (tutStep !== "idle" && tutStep !== "done") {
      const key = TUT_TEXT_KEYS[tutStep];
      const ruleKey = key.replace(".action", ".rule") as TKey;
      setAriaMsg(`${t(key)}. ${t(ruleKey)}`);
    }
    // announceSeq is the trigger: it changes on every announcement, including
    // two identical ones in a row. Listing lastAnnouncement/tutStep as well
    // would re-announce on unrelated renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.announceSeq, t, sound]);
  
  useEffect(() => {
    if (isPortrait) {
      setAriaMsg(t("a11y.paused"));
    } else {
      if (game.originalDeal) setAriaMsg(t("a11y.resumed"));
    }
    // Only a change of orientation should speak; a new deal should not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPortrait, t]);

  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const boardReady = game.originalDeal !== null;

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    // Measure the safe content box, not the full viewport. Native safe-area
    // padding handles BOTH landscape directions without guessing the notch
    // side from screen.orientation or applying a second sideways offset.
    const fit = (width: number, height: number) => {
      setScale(getBoardScale(width, height));
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

  const [hintTarget, setHintTarget] = useState<TutTarget | "continue" | null>(null);
  const hintTimer = useRef<number | null>(null);

  // After 90 seconds without a move the hint button flashes, so a player who
  // is stuck is reminded that help exists rather than being left to stall.
  const IDLE_HINT_MS = 90_000;
  const [hintIdle, setHintIdle] = useState(false);
  useEffect(() => {
    setHintIdle(false);
    if (paused || isPortrait || game.isWon || game.isLost) return;
    const id = window.setTimeout(() => setHintIdle(true), IDLE_HINT_MS);
    return () => window.clearTimeout(id);
  }, [game.lastMove, game.originalDeal, paused, isPortrait, game.isWon, game.isLost]);

  const clearHint = () => {
    if (hintTimer.current !== null) {
      clearTimeout(hintTimer.current);
      hintTimer.current = null;
    }
    setHintTarget(null);
  };

  // A hint glow must never outlive the deal it belongs to: loading another
  // deal (a new game, or an on-demand tutorial restart) would otherwise leave
  // an unrelated card glowing for the rest of the timeout. Also clear the
  // cue as soon as a move or lesson change makes its target obsolete.
  useEffect(() => clearHint, []);
  useEffect(() => {
    clearHint();
  }, [game.originalDeal, game.lastMove, tutStep]);

  const showHint = (target: TutTarget | "continue", message: string) => {
    noteHint();
    setHintIdle(false);
    setHintTarget(target);
    setAriaMsg(message);
    if (hintTimer.current !== null) clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => {
      hintTimer.current = null;
      setHintTarget(null);
    }, 2500);
    playSound("tap");
  };

  const handleHint = () => {
    if (game.isWon || game.isLost) return;
    // Hints explain the current lesson; they never choose an out-of-script
    // move, mutate the deal, or advance the tutorial.
    if (guided) {
      if (tutStep === "intro") {
        showHint("continue", t("tut.hintContinue"));
      } else if (tutTarget) {
        const key = TUT_TEXT_KEYS[tutStep as keyof typeof TUT_TEXT_KEYS];
        const ruleKey = key.replace(".action", ".rule") as TKey;
        showHint(tutTarget, `${t(key)}. ${t(ruleKey)}`);
      }
      return;
    }
    // Perfect play: ask the exact solver for a move that lies on a winning
    // line, so following hints repeatedly clears the board. The greedy
    // heuristic this replaced wins only about half its deals, which made
    // "keep pressing hint" a promise the game could not keep.
    const topWaste = game.waste[game.waste.length - 1];
    const rankOf = (card: string) => (card === "WILD" ? -1 : RANKS.indexOf(card.slice(0, -1)));
    const displayed = computeUncovered(game.tableauStatus);
    let playedMask = 0;
    for (let i = 0; i < N_TABLEAU; i++) {
      if (displayed[i] === "played") playedMask |= 1 << i;
    }
    const best = findBestMove(
      game.tableau.map(rankOf),
      [...game.stock].reverse().map(rankOf), // solver wants draw order
      rankOf(topWaste),
      playedMask,
    );

    if (best?.type === "play") {
      showHint(`card:${best.index}`, t("a11y.hint", { card: game.tableau[best.index] }));
      return;
    }
    if (best?.type === "draw") {
      showHint("stock", t("a11y.noMoves"));
      return;
    }

    // No winning line remains — the deal was lost by an earlier move. Losing is
    // an expected outcome, so fall back to the best legal move rather than
    // telling the player the position is dead.
    const legalIndices = [];
    for (let i = 0; i < N_TABLEAU; i++) {
      if (displayed[i] === "uncovered" && isAdjacent(topWaste, game.tableau[i])) {
        legalIndices.push(i);
      }
    }
    if (legalIndices.length > 0) {
      let bestIndices: number[] = [];
      let bestScore = -1;
      for (const idx of legalIndices) {
        const tempStatus = [...displayed];
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
      showHint(`card:${chosen}`, t("a11y.hint", { card: game.tableau[chosen] }));
    } else if (game.stock.length > 0) {
      showHint("stock", t("a11y.noMoves"));
    } else {
      setAriaMsg(t("a11y.noMoves"));
      playSound("error");
    }
  };
  
  const lastAction = useRef(0);
  const DEBOUNCE = 300;
  
  const withDebounce = (fn: () => void) => () => {
    if (isPortrait || paused) return;
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

  const { left: stockLeft, top: stockTop } = getStockPos(rtl);
  const stockTapRect = getStockTapRect(rtl);
  const { left: wasteLeft, top: wasteTopPos } = getWastePos(rtl);

  // HANDOFF shows the legal cards glowing until the player's next move.
  const handoffGlow = new Set<number>();
  if (tutStep === "handoff") {
    for (let i = 0; i < N_TABLEAU; i++) {
      if (displayStatuses[i] === "uncovered" && isAdjacent(wasteTop, game.tableau[i])) handoffGlow.add(i);
    }
  }
  // A hint changes the outline, not the geometry or neighboring tap targets.
  const glowClass = "ring-4 ring-primary ring-offset-2 ring-offset-background";
  // A requested hint is distinct from the tutorial's permanent gold outline.
  // No pulse, movement or scale change: keep the tap target steady.
  const hintClass = "outline outline-4 outline-offset-4 outline-white";
  const controlsDim = guided ? "opacity-40" : "";
  // Header controls. Icon-only and identically sized in every Cyan game, so a
  // participant meets the same four glyphs in the same places all week.
  const HEADER_ICON = 26;
  const headerBtn =
    "w-[46px] h-[46px] shrink-0 flex items-center justify-center rounded-full border border-border bg-secondary/60 text-secondary-foreground hover:bg-secondary transition-colors active:scale-95 pointer-events-auto disabled:opacity-50 disabled:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

  const hintDisabled = game.isWon || game.isLost;
  // The idle cue is a colour and fill change rather than an animation, so it is
  // shown to everyone: a reduced-motion setting must not cost a stuck player
  // the only prompt that help exists.
  const hintNudge = hintIdle;
  const hintButton = (
    <button
      onClick={withDebounce(handleHint)}
      disabled={hintDisabled}
      className={cn(headerBtn, hintNudge && "bg-primary text-primary-foreground border-primary")}
      aria-label={t("btn.hint")}
      data-testid="btn-hint"
      data-tut-interactive
    >
      <BulbIcon filled={hintNudge} size={HEADER_ICON} color="currentColor" />
    </button>
  );

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
      dir={rtl ? "rtl" : "ltr"}
    >
      <div
        className="relative shrink-0"
        style={{ width: PLAY_BOUNDS.width * scale, height: PLAY_BOUNDS.height * scale }}
        data-testid="game-play-area"
      >
      <div 
        className={cn(
          "absolute origin-top-left",
          isPortrait ? "pointer-events-none" : ""
        )}
        // Center the occupied area while retaining one fixed coordinate frame
        // for cards AND highlights. No clipping or per-device sideways offset.
        style={{
          width: FRAME_W,
          height: FRAME_H,
          left: -PLAY_BOUNDS.left * scale,
          top: -PLAY_BOUNDS.top * scale,
          transform: `scale(${scale})`,
        }}
        data-testid="game-frame"
        aria-hidden={isPortrait}
        inert={isPortrait ? true : undefined}
        onClick={onFrameClick}
      >
        {/* The strip stays pointer-transparent and above the coaching mask, so
            Hint remains reachable while the tutorial bubble covers the board. */}
        <div className={cn(
          "absolute top-0 inset-x-0 h-[46px] flex flex-row items-center justify-between px-[54px] pointer-events-none",
          tutorialVisible ? "z-[500]" : "z-[200]",
        )}>
          {/* The row follows the text direction, so in Hebrew (RTL) it reads,
              left to right: exit, music, name, hint, help. English mirrors it. */}
          <div className="flex flex-row items-center gap-3 shrink-0">
            <button
              onClick={withDebounce(gatedControl(requestTutorial))}
              className={cn(
                headerBtn,
                controlsDim,
                rejected === "controls" && !reducedMotion && "tut-wiggle",
              )}
              aria-label={t("btn.tutorial")}
              aria-disabled={guided || undefined}
              data-testid="btn-tutorial"
              data-tut-interactive
            >
              <HelpIcon size={HEADER_ICON} color="currentColor" />
            </button>
            {hintButton}
          </div>

          <h1
            className="flex-1 min-w-0 mx-3 text-center text-[17px] font-bold text-foreground truncate"
            data-testid="game-title"
          >
            {t("title")}
          </h1>

          <div className="flex flex-row items-center gap-3 shrink-0">
            {/* Sound on/off. The choice is the participant's and is remembered
                across sessions (BR-06); it never affects progression. */}
            <button
              onClick={toggleSound}
              className={headerBtn}
              aria-label={t("btn.sound")}
              aria-pressed={soundOn}
              data-testid="btn-sound"
              data-tut-interactive
            >
              <MusicIcon on={soundOn} size={HEADER_ICON} color="currentColor" />
            </button>
            {/* The host app draws no chrome, so the game must offer the only
                way out of the activity (BR-07). */}
            <button
              onClick={requestExit}
              className={headerBtn}
              aria-label={t("btn.exit")}
              data-testid="btn-exit"
              data-tut-interactive
            >
              <CloseIcon size={HEADER_ICON} color="currentColor" />
            </button>
          </div>
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
            const isHinted = hintTarget === target || isTutTarget || handoffGlow.has(index);
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
                className={cn(isHinted && glowClass, hintTarget === target && hintClass)}
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
              left={stockLeft + (rtl ? -offset : offset)}
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
               "focus-visible:ring-4 focus-visible:ring-primary",
               hintTarget !== "stock" && "focus:outline-none",
               hintTarget === "stock" && hintClass,
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
            aria-label={t("a11y.stock", { n: stockCount })}
            aria-describedby={tutTarget === "stock" ? TUT_BUBBLE_TEXT_ID : undefined}
            aria-disabled={guided && tutTarget !== "stock" ? true : undefined}
            role="button"
            tabIndex={0}
            data-tut-interactive
          />

          <div
            className="absolute top-0 z-[300] bg-primary text-primary-foreground font-bold rounded-full w-8 h-8 flex items-center justify-center shadow-md pointer-events-none"
            style={{ left: rtl ? 774 : 112 }}
            aria-hidden="true"
          >
            {stockCount}
          </div>
          
          {/* Pills */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 flex items-center"
            style={{ insetInlineEnd: 54 }}
          >
            <button
              onClick={withDebounce(gatedControl(game.undo))}
              disabled={!guided && game.history.length === 0}
              className={cn("w-[150px] h-[58px] flex items-center justify-center gap-2 bg-secondary text-secondary-foreground font-semibold rounded-full hover:bg-secondary/80 disabled:opacity-50 disabled:pointer-events-none transition-colors active:scale-95 z-[200]", controlsDim, rejected === "controls" && !reducedMotion && "tut-wiggle")}
              aria-label={t("btn.undo")}
              aria-disabled={guided || undefined}
              data-testid="btn-undo"
              data-tut-interactive
            >
              <RotateCcw className={cn("w-5 h-5", rtl && "scale-x-[-1]")} />
              <span>{t("btn.undo")}</span>
            </button>
          </div>
        </div>

        {/* Coaching layer: reads game/tutorial state only; gating is above. */}
        <TutorialOverlay
          onContinue={useTutorial.getState().continueIntro}
          onDismiss={useTutorial.getState().dismissHandoff}
          onSkip={useTutorial.getState().skip}
          hintContinue={hintTarget === "continue"}
        />
      </div>
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

      <RoundEndOverlay />
      <PortraitOverlay visible={isPortrait} message={t("rotate.prompt")} />
    </div>
  );
}
