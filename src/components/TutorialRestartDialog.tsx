import { useEffect, useRef } from "react";
import { useSession } from "@/context/SessionContext";
import { cn } from "@/lib/utils";

interface Props {
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Guard for the header's tutorial button. Restarting the tutorial loads the
 * scripted deal, which throws away the round in progress, so it is only shown
 * when the player has actually made moves.
 */
export function TutorialRestartDialog({ onConfirm, onCancel }: Props) {
  const { t, translations, reducedMotion } = useSession();
  const rtl = translations?.dir === "rtl";
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Default focus on the non-destructive choice, and let Escape back out.
  useEffect(() => {
    cancelRef.current?.focus({ preventScroll: true });
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md",
        reducedMotion ? "animate-in fade-in duration-200" : "animate-in fade-in zoom-in duration-300",
      )}
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={t("tut.confirmRestart")}
        dir={rtl ? "rtl" : "ltr"}
        className="bg-popover text-popover-foreground max-w-md w-full mx-4 rounded-3xl shadow-2xl p-8 flex flex-col items-center text-center gap-6"
        onClick={(e) => e.stopPropagation()}
        data-testid="tutorial-restart-dialog"
      >
        <p className="text-xl font-semibold">{t("tut.confirmRestart")}</p>

        <div className="flex flex-col sm:flex-row gap-4 w-full">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="flex-1 px-6 py-4 rounded-xl bg-secondary text-secondary-foreground font-bold hover:bg-secondary/80 transition-colors active:scale-95 shadow-sm"
            data-testid="tutorial-restart-cancel"
          >
            {t("tut.confirmNo")}
          </button>

          <button
            onClick={onConfirm}
            className="flex-1 px-6 py-4 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors active:scale-95 shadow-md"
            data-testid="tutorial-restart-confirm"
          >
            {t("tut.confirmYes")}
          </button>
        </div>
      </div>
    </div>
  );
}
