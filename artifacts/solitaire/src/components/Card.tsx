import React, { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/store/settings";
import { t } from "@/lib/i18n";
import { motion } from "framer-motion";
import { CARD_HIT_X, CARD_HIT_Y } from "@/lib/layout";

export interface PlayingCardProps {
  code: string;
  status: "face-down" | "uncovered" | "played" | "stock" | "waste";
  onClick?: () => void;
  className?: string;
  isWaste?: boolean;
  isStock?: boolean;
  zIndex?: number;
  left: number;
  top: number;
  id?: string;
  ariaDescribedBy?: string;
  /** Announced as unavailable but still tappable (the handler gives feedback). */
  ariaDisabled?: boolean;
  /** Brief rejection wiggle (applied to the inner face so it never fights the flip transform). */
  wiggle?: boolean;
}

const suitSymbols: Record<string, { glyph: string; color: string }> = {
  S: { glyph: "♠", color: "text-slate-950" },
  H: { glyph: "♥", color: "text-red-600" },
  D: { glyph: "♦", color: "text-red-600" },
  C: { glyph: "♣", color: "text-slate-950" },
};

function getCardDetails(code: string, lang: "he" | "en") {
  if (code === "WILD") {
    return { name: t(lang, "card.wild"), rank: "★", suit: "", color: "text-primary" };
  }
  const rank = code.slice(0, -1);
  const suit = code.slice(-1);
  const rankKey = `card.rank.${rank}` as any;
  const suitKey = `card.suit.${suit}` as any;
  
  const name = t(lang, "card.name", { 
    rank: t(lang, rankKey) || rank, 
    suit: t(lang, suitKey) || suit 
  });
  
  return {
    name,
    rank,
    suit: suitSymbols[suit]?.glyph || suit,
    color: suitSymbols[suit]?.color || "text-foreground",
  };
}

export function PlayingCard({ code, status, onClick, className, isWaste, isStock, zIndex, left, top, id, ariaDescribedBy, ariaDisabled, wiggle }: PlayingCardProps) {
  const { lang, reducedMotion } = useSettings();
  const details = getCardDetails(code, lang);
  
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);
  const hitAreaRef = useRef<HTMLDivElement>(null);
  
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    if ('touches' in e) {
      if (e.touches.length !== 1) {
        setTouchStart(null);
        return;
      }
      setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    } else {
      setTouchStart({ x: e.clientX, y: e.clientY });
    }
  };
  
  const handleTouchEnd = (e: React.TouchEvent | React.MouseEvent) => {
    if (!touchStart || !onClick) return;
    setTouchStart(null);
    
    let endX, endY;
    if ('changedTouches' in e && e.changedTouches.length > 0) {
      endX = e.changedTouches[0].clientX;
      endY = e.changedTouches[0].clientY;
    } else if ('clientX' in e) {
      endX = (e as React.MouseEvent).clientX;
      endY = (e as React.MouseEvent).clientY;
    } else {
      return;
    }
    
    const dist = Math.hypot(endX - touchStart.x, endY - touchStart.y);
    const bounds = hitAreaRef.current?.getBoundingClientRect();
    const stillOnCard = bounds &&
      endX >= bounds.left && endX <= bounds.right &&
      endY >= bounds.top && endY <= bounds.bottom;
    const releaseTarget = document.elementFromPoint(endX, endY)?.closest("[data-tut-interactive]");
    // Keep the existing small-slip allowance, but never activate this card
    // when the finger ends on another control. Movement within the same card
    // is accepted regardless of distance, so a tremor doesn't cancel a tap.
    if ((stillOnCard || dist < 24) && (!releaseTarget || releaseTarget === e.currentTarget)) {
      e.preventDefault();
      onClick();
    }
  };

  const isFaceUp = status !== "face-down" && status !== "stock";
  const isWild = code === "WILD";
  
  let ariaLabel = "";
  if (!isFaceUp) ariaLabel = t(lang, "a11y.cardFaceDown");
  else if (isWaste) ariaLabel = t(lang, "a11y.waste", { card: details.name });
  else ariaLabel = details.name;

  return (
    <motion.div 
      initial={{ rotateY: !reducedMotion && !isFaceUp ? 180 : 0, scale: 1 }}
      animate={{ 
        rotateY: !reducedMotion && !isFaceUp ? 180 : 0,
        scale: isWaste ? (72/70) : 1, // small visual bump for waste
      }}
      transition={reducedMotion ? { duration: 0.15 } : { duration: 0.3, ease: "easeOut" }}
      className={cn(
        "absolute flex items-center justify-center rounded-lg shadow-sm select-none",
        "w-[70px] h-[98px]", // Base size
        !isFaceUp ? "pointer-events-none" : "pointer-events-auto cursor-pointer",
        // Only the top stock card is a control; the cards under it let taps
        // fall through to the dashed stock zone.
        isStock && onClick && "pointer-events-auto cursor-pointer",
        className
      )}
      style={{
        left,
        top,
        zIndex: zIndex,
        transformStyle: "preserve-3d",
        // The flip MUST rotate around the card's center axis. A corner origin
        // projects a face-down card one full card-width away from its logical
        // cell, which breaks the physical coverage layout.
        transformOrigin: "50% 50%",
        direction: "ltr",
      }}
      dir="ltr"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => setTouchStart(null)}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      role={onClick ? "button" : "img"}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-disabled={ariaDisabled || undefined}
      tabIndex={onClick ? 0 : -1}
      id={id}
      data-tut-interactive={onClick ? true : undefined}
      data-testid={`card-${status}-${code}`}
    >
      {/* Fill the horizontal gaps, and use spare space above/below the card.
          Keep this rectangular and unscaled so neighboring targets never overlap. */}
      {onClick && (
        <div
          ref={hitAreaRef}
          className="absolute z-10"
          style={{ left: -CARD_HIT_X, right: -CARD_HIT_X, top: -CARD_HIT_Y, bottom: -CARD_HIT_Y }}
          data-card-hit-zone
          aria-hidden="true"
        />
      )}

      {/* Card Inner Wrapper for Flip */}
      <div 
        className={cn("relative w-full h-full rounded-lg", wiggle && !reducedMotion && "tut-wiggle")}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Front */}
        <div 
          className={cn(
            "absolute inset-0 bg-card rounded-lg border border-card-border overflow-hidden",
            "flex flex-col items-center justify-center transition-all duration-300",
            reducedMotion && !isFaceUp ? "opacity-0" : "opacity-100",
            isWild && "bg-gradient-to-br from-yellow-50 to-amber-200 border-amber-400 dark:from-yellow-900/40 dark:to-amber-900/60 dark:border-amber-600"
          )}
          style={{ backfaceVisibility: "hidden" }}
        >
          {isWild ? (
            <div className="flex flex-col items-center justify-center text-amber-500 dark:text-amber-400">
              <span className="text-4xl">★</span>
            </div>
          ) : (
            <>
              {/* Top Left Rank/Suit */}
              <div className={cn("absolute top-1 left-1 flex flex-col items-center leading-none", details.color)}>
                <span className="text-lg font-bold font-sans">{details.rank}</span>
                <span className="text-sm">{details.suit}</span>
              </div>
              
              {/* Center Suit */}
              <div className={cn("text-3xl", details.color)}>
                {details.suit}
              </div>
            </>
          )}
        </div>

        {/* Back */}
        <div 
          className={cn(
            "absolute inset-0 bg-indigo-900 rounded-lg border border-indigo-950 overflow-hidden",
            reducedMotion && isFaceUp ? "opacity-0" : "opacity-100"
          )}
          style={{ 
            backfaceVisibility: "hidden",
            transform: !reducedMotion ? "rotateY(180deg)" : "rotateY(0deg)",
            backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.1) 4px, rgba(255,255,255,0.1) 8px)"
          }}
        />
      </div>
    </motion.div>
  );
}
