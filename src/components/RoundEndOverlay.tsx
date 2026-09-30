import { useEffect } from "react";

import { useSession } from "@/context/SessionContext";
import { cn } from "@/lib/utils";

/**
 * Shown after a round ends. A lost round is a completed round (BR-02), so the
 * screen differs only in wording — both offer the same way forward.
 *
 * After the LAST round of a session nothing is shown to a bridged player: the
 * game posts game_finished and the app draws its own summary (BR-01). Only a
 * standalone page (BR-09) offers a replay.
 */
export function RoundEndOverlay() {
  const { t, translations, reducedMotion, roundOutcome, roundIndex, levelIds, isLastRound, bridged, nextRound, finishSession, restart } =
    useSession();

  useEffect(() => {
    if (roundOutcome && isLastRound) finishSession();
  }, [roundOutcome, isLastRound, finishSession]);

  if (!roundOutcome) return null;
  if (isLastRound && bridged) return null;

  const won = roundOutcome === "won";
  const rtl = translations?.dir === "rtl";

  return (
    <div
      className={cn(
        "fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-md",
        reducedMotion ? "animate-in fade-in duration-300" : "animate-in fade-in zoom-in duration-500",
      )}
      role="dialog"
      aria-modal="true"
      dir={rtl ? "rtl" : "ltr"}
    >
      <div className="bg-popover text-popover-foreground max-w-lg w-full mx-4 rounded-3xl shadow-2xl p-8 flex flex-col items-center text-center gap-4">
        <h2 className="text-3xl font-bold text-primary">{t(won ? "end.wonTitle" : "end.lostTitle")}</h2>
        <p className="text-lg text-muted-foreground">{t(won ? "end.wonSubtitle" : "end.lostSubtitle")}</p>
        <p className="text-base text-muted-foreground">
          {t("hud.roundOf", { n: roundIndex + 1, total: levelIds.length })}
        </p>
        <button
          onClick={isLastRound ? restart : nextRound}
          className="mt-2 w-full px-6 py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg hover:bg-primary/90 transition-colors active:scale-95 shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          data-testid="btn-next-round"
          autoFocus
        >
          {t(isLastRound ? "btn.playAgain" : "btn.nextRound")}
        </button>
      </div>
    </div>
  );
}
