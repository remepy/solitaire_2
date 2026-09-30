import React, { useEffect, useState } from "react";
import { useGame } from "@/store/game";
import { useSettings } from "@/store/settings";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function WinLoseOverlay() {
  const game = useGame();
  const { lang, reducedMotion } = useSettings();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // slight delay for win cascade / lose realization
    const tId = setTimeout(() => setVisible(true), 500);
    return () => clearTimeout(tId);
  }, []);

  if (!visible) return null;

  return (
    <div className={cn(
      "fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-md",
      reducedMotion ? "animate-in fade-in duration-300" : "animate-in fade-in zoom-in duration-500"
    )}>
      <div 
        className={cn(
          "bg-popover text-popover-foreground max-w-lg w-full mx-4 rounded-3xl shadow-2xl p-8 flex flex-col items-center text-center gap-6",
          ""
        )}
        dir={lang === "he" ? "rtl" : "ltr"}
      >
        <h2 className="text-3xl font-bold text-primary">
          {game.isWon ? t(lang, "end.win") : t(lang, "end.lose")}
        </h2>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full mt-4">
          <button
            onClick={() => game.replayDeal()}
            className="flex-1 px-6 py-4 rounded-xl bg-secondary text-secondary-foreground font-bold hover:bg-secondary/80 transition-colors active:scale-95 shadow-sm"
          >
            {t(lang, "btn.replay")}
          </button>
          
          <button
            onClick={() => game.newDeal()}
            className="flex-1 px-6 py-4 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors active:scale-95 shadow-md"
          >
            {t(lang, "btn.newDeal")}
          </button>
        </div>
      </div>
    </div>
  );
}
