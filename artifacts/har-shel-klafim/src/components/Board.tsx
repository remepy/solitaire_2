import React, { useEffect, useRef, useState } from "react";
import { PlayingCard } from "./Card";
import { useGame, isAdjacent, computeUncovered } from "@/store/game";
import { useSettings } from "@/store/settings";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { RotateCcw, Lightbulb, Settings } from "lucide-react";
import { SettingsModal } from "./SettingsModal";
import { WinLoseOverlay } from "./WinLoseOverlay";
import { PortraitOverlay } from "./overlay/PortraitOverlay";
import { useIsRotated } from "@/hooks/useIsRotated";

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

function getCardPos(idx: number) {
  const u = TABLEAU_U_VALUES[idx];
  const r = TABLEAU_R_VALUES[idx];
  return { left: 54 + 74 * u, top: 46 + 32 * r };
}

export function GameBoard() {
  const { lang, sound, textSize } = useSettings();
  const game = useGame();
  const isPortrait = useIsRotated();
  const [showSettings, setShowSettings] = useState(false);
  
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
      game.newDeal();
    }
  }, []);
  
  const [ariaMsg, setAriaMsg] = useState("");
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

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    // Measure the content box inside the safe-area padding so the board
    // always fits between hardware intrusions (Dynamic Island, home
    // indicator) instead of scaling to the raw screen size. A small
    // breathing margin keeps the board visually off the device edges;
    // at ~8px per side the scale drops only ~2%, so hit targets stay
    // effectively the same physical size.
    const EDGE_MARGIN = 8;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      const availableW = Math.min(Math.max(0, width - EDGE_MARGIN * 2), 932);
      const availableH = Math.max(0, height - EDGE_MARGIN * 2);
      setScale(Math.min(availableW / 844, availableH / 390));
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);
  
  // Extra edge margin follows the hardware intrusion (Dynamic Island):
  // landscape-primary = device top/island on the left → shift board right;
  // landscape-secondary = island on the right → shift board left.
  // Desktop (no coarse pointer) keeps the default left shift.
  const [islandOnLeft, setIslandOnLeft] = useState(false);
  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const update = () => {
      setIslandOnLeft(window.screen.orientation?.type === "landscape-primary");
    };
    update();
    window.screen.orientation?.addEventListener("change", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.screen.orientation?.removeEventListener("change", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  const [hintIdx, setHintIdx] = useState<number | null>(null);

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
      setTimeout(() => setHintIdx(null), 1500);
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

  if (!game.originalDeal) return null;
  
  const wasteTop = game.waste[game.waste.length - 1];
  const stockCount = game.stock.length;
  // Coverage is derived from the solver's blocker graph on every render.
  // This prevents a fully exposed card from remaining visually face-down.
  const displayStatuses = computeUncovered(game.tableauStatus);

  const stockLeft = lang === "he" ? 720 : 54;
  const stockTop = 259;
  
  const wasteLeft = lang === "he" ? 596 : 176;
  const wasteTopPos = 258;

  return (
    <div 
      ref={stageRef}
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
          "relative w-[844px] h-[390px] origin-center",
          isPortrait ? "pointer-events-none" : ""
        )}
        // translateX is applied in screen space (before the scale), so the
        // board shifts a true 20px for optical balance against the device's
        // edge intrusion. The direction follows the intrusion side, so
        // rotating the phone 180° mirrors the margin. Content has ~46px
        // clearance on both sides, so nothing clips.
        style={{ transform: `translateX(${islandOnLeft ? 20 : -20}px) scale(${scale})` }}
        aria-hidden={isPortrait}
        inert={isPortrait ? true : undefined}
      >
        {/* Header Strip */}
        <div className="absolute top-0 inset-x-0 h-[46px] flex items-center justify-between px-[54px]">
          <div className="flex items-baseline gap-2 font-bold text-xl">
            <span className="text-muted-foreground uppercase tracking-widest text-sm">{t(lang, "hud.score")}</span>
            <bdi>{new Intl.NumberFormat(lang === "he" ? "he-IL" : "en-US").format(game.score)}</bdi>
          </div>
          
          {game.streak > 1 && (
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 text-primary font-bold animate-in zoom-in duration-300">
              <span className="text-sm">{t(lang, "hud.streak", { n: "" }).replace("×", "").trim()}</span>
              <bdi className="text-lg">×{game.streak}</bdi>
            </div>
          )}
          
          <button
            onClick={withDebounce(() => setShowSettings(true))}
            className="w-[44px] h-[44px] flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-colors"
            aria-label={t(lang, "btn.menu")}
            data-testid="btn-settings"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>
        
        {/* The tableau is a physical, never-mirrored coordinate system. */}
        <div className="absolute inset-0" dir="ltr">
          {game.tableau.map((code, index) => {
            const status = displayStatuses[index];
            if (status === "played") return null;
            const position = getCardPos(index);
            const isHinted = index === hintIdx;
            return (
              <PlayingCard
                key={`tableau-${index}`}
                code={code}
                status={status}
                onClick={withDebounce(() => game.playCard(index))}
                // Once a card is logically uncovered, it must render above
                // every remaining face-down layer. Preserve physical order
                // within each status group using the tableau index.
                zIndex={status === "uncovered" ? 100 + index : index}
                left={position.left}
                top={position.top}
                className={isHinted ? "ring-4 ring-primary ring-offset-2 ring-offset-background scale-[1.05]" : ""}
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
              onClick={isTop ? withDebounce(game.drawStock) : undefined}
              isStock
              zIndex={200 + visibleIndex}
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
        />
        
        {/* Controls Band */}
        <div className="absolute top-[248px] inset-x-0 h-[120px]">
          {/* Stock Area Hitbox */}
          <div 
            className="absolute top-[11px] z-[180] w-[100px] h-[110px] rounded-xl border-2 border-dashed border-muted flex items-center justify-center cursor-pointer"
            style={{ insetInlineStart: 44 }}
            onClick={withDebounce(game.drawStock)}
            data-testid="stock-area"
            aria-label={t(lang, "a11y.stock", { n: stockCount })}
            role="button"
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
              onClick={withDebounce(game.undo)}
              disabled={game.history.length === 0}
              className="w-[150px] h-[58px] flex items-center justify-center gap-2 bg-secondary text-secondary-foreground font-semibold rounded-full hover:bg-secondary/80 disabled:opacity-50 disabled:pointer-events-none transition-colors active:scale-95 z-[200]"
              aria-label={t(lang, "btn.undo")}
            >
              <RotateCcw className={cn("w-5 h-5", lang === "he" && "scale-x-[-1]")} />
              <span>{t(lang, "btn.undo")}</span>
            </button>
            
            <button
              onClick={withDebounce(handleHint)}
              className="w-[150px] h-[58px] flex items-center justify-center gap-2 bg-secondary text-secondary-foreground font-semibold rounded-full hover:bg-secondary/80 transition-colors active:scale-95 z-[200]"
              aria-label={t(lang, "btn.hint")}
            >
              <Lightbulb className="w-5 h-5" />
              <span>{t(lang, "btn.hint")}</span>
            </button>
          </div>
        </div>
      </div>
      
      <div className="sr-only" aria-live="polite" role="status">
        {ariaMsg}
      </div>
      
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {(game.isWon || game.isLost) && <WinLoseOverlay />}
      <PortraitOverlay visible={isPortrait} message={t(lang, "rotate.prompt")} />
    </div>
  );
}
