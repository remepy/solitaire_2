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

  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  
  useEffect(() => {
    const onResize = () => {
      if (!containerRef.current) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const refW = 844;
      const refH = 390;
      
      const availableW = Math.min(w, 932);
      const scaleW = availableW / refW;
      const scaleH = h / refH;
      setScale(Math.min(scaleW, scaleH));
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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

  // Framer Motion resolves the animated horizontal card anchor from the
  // inline-end edge in RTL, so include the card width to land at x=720.
  const stockLeft = lang === "he" ? 790 : 54;
  const stockTop = 259;
  
  const wasteLeft = lang === "he" ? 596 : 176;
  const wasteTopPos = 258;

  return (
    <div 
      className={cn(
        "fixed inset-0 bg-background text-foreground flex items-center justify-center overflow-hidden touch-none",
        ""
      )}
      dir={lang === "he" ? "rtl" : "ltr"}
      lang={lang}
    >
      <div 
        ref={containerRef}
        className={cn(
          "relative w-[844px] h-[390px] origin-center",
          isPortrait ? "pointer-events-none" : ""
        )}
        style={{ transform: `scale(${scale})` }}
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
        
        {/* Tableau cards use their physical index as identity; card codes repeat by rank/suit. */}
        {game.tableau.map((code, index) => {
          const status = game.tableauStatus[index];
          if (status === "played") return null;
          const position = getCardPos(index);
          const isHinted = index === hintIdx;
          return (
            <PlayingCard
              key={`tableau-${index}`}
              code={code}
              status={status}
              onClick={withDebounce(() => game.playCard(index))}
              zIndex={index}
              left={position.left}
              top={position.top}
              className={isHinted ? "ring-4 ring-primary ring-offset-2 ring-offset-background scale-[1.05]" : ""}
            />
          );
        })}

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
