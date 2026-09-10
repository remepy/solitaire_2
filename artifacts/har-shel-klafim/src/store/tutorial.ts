import { create } from "zustand";
import { useGame, type OriginalDeal } from "./game";
import { useSettings } from "./settings";
import tutorialDealJson from "@/lib/tutorial_deal.json";

// The tutorial is a layer on top of a normal game, not a separate mode. The
// scripted deal loads through the same `loadDeal` path as a generated deal.
//
// State machine:
//   idle → intro →(Next)→ step1 →(card 20 played)→ step2 →(stock drawn)→ step3
//        →(card 23 played)→ step4 →(card 22 played)→ handoff →(Got it OR any play)→ done
//
// Gameplay steps advance on real moves (`game.lastMove`), never raw taps.
// Only the introductory explanation uses a Next button.

export type TutStep = "idle" | "intro" | "step1" | "step2" | "step3" | "step4" | "handoff" | "done";

/** Element identifiers used for input gating and spotlights. */
export type TutTarget = `card:${number}` | "stock" | "waste";

export interface TutorialScript {
  step1_target: number;
  step2_draws: string;
  step3_target: number;
  step4_target: number;
}

export interface TutorialDeal extends OriginalDeal {
  verified_solvable: boolean;
  script: TutorialScript;
}

// TESTING FLAG: when true, the tutorial runs at the start of EVERY round
// (launch, reload, and "New deal"), ignoring tutorialSeen. Set back to
// false to restore first-run-only behaviour.
export const TUTORIAL_EVERY_ROUND = true;

export const TUTORIAL_DEAL = tutorialDealJson as TutorialDeal;
export const TUTORIAL_DEAL_ID = TUTORIAL_DEAL.deal_id;

const script = TUTORIAL_DEAL.script;

export const GUIDED_STEPS: ReadonlySet<TutStep> = new Set(["intro", "step1", "step2", "step3", "step4"]);

/** Elements the player may interact with in each guided step. */
const ALLOWED: Partial<Record<TutStep, TutTarget[]>> = {
  intro: [],
  step1: [`card:${script.step1_target}`],
  step2: ["stock"],
  step3: [`card:${script.step3_target}`],
  step4: [`card:${script.step4_target}`],
};

/** Elements cut out of the dim mask in each guided step. */
const SPOTLIGHT: Partial<Record<TutStep, TutTarget[]>> = {
  intro: ["waste"],
  step1: [`card:${script.step1_target}`, "waste"],
  step2: ["stock", "waste"],
  step3: [`card:${script.step3_target}`, "waste"],
  step4: [`card:${script.step4_target}`, "waste"],
};

export interface TutorialState {
  step: TutStep;
  /** Start (or restart) the tutorial through the normal deal-loading path. */
  start: () => void;
  continueIntro: () => void;
  /** Close the final explanation without waiting for the next play. */
  dismissHandoff: () => void;
}

export const useTutorial = create<TutorialState>((set) => ({
  step: "idle",
  start: () => {
    // Strip the script block: the game store only knows the deal shape.
    const { script: _script, verified_solvable: _v, ...deal } = TUTORIAL_DEAL;
    useGame.getState().loadDeal(deal);
    set({ step: "intro" });
  },
  continueIntro: () => set((s) => (s.step === "intro" ? { step: "step1" } : s)),
  dismissHandoff: () => set((s) => (s.step === "handoff" ? { step: "done" } : s)),
}));

// ---- Advance on game state, not on taps ----
const unsubscribe = useGame.subscribe((state, prev) => {
  const { step } = useTutorial.getState();
  if (step === "idle" || step === "done") return;

  // Any other deal replacing the tutorial deal ends the tutorial.
  if (state.originalDeal !== prev.originalDeal && state.originalDeal?.deal_id !== TUTORIAL_DEAL_ID) {
    useTutorial.setState({ step: "done" });
    return;
  }

  const move = state.lastMove;
  if (!move || move === prev.lastMove) return;

  if (step === "step1" && move.type === "play" && move.idx === script.step1_target) {
    useTutorial.setState({ step: "step2" });
  } else if (step === "step2" && move.type === "draw") {
    useTutorial.setState({ step: "step3" });
  } else if (step === "step3" && move.type === "play" && move.idx === script.step3_target) {
    useTutorial.setState({ step: "step4" });
  } else if (step === "step4" && move.type === "play" && move.idx === script.step4_target) {
    // Persist exactly on entering HANDOFF (spec §3.5).
    useSettings.getState().setTutorialSeen(true);
    useTutorial.setState({ step: "handoff" });
  } else if (step === "handoff") {
    // Never block a player who just keeps going.
    useTutorial.setState({ step: "done" });
  }
});

// Dev only: a hot reload re-evaluates this module; drop the old listener so
// exactly one subscription drives the state machine.
if (import.meta.hot) import.meta.hot.dispose(unsubscribe);

// ---- Derived helpers (pure) ----
export function isGuidedStep(step: TutStep): boolean {
  return GUIDED_STEPS.has(step);
}

/** null = everything is allowed (no gating). */
export function allowedTargets(step: TutStep): TutTarget[] | null {
  return ALLOWED[step] ?? null;
}

export function spotlightTargets(step: TutStep): TutTarget[] {
  return SPOTLIGHT[step] ?? [];
}

export function isAllowed(step: TutStep, target: TutTarget): boolean {
  const allowed = allowedTargets(step);
  return allowed === null || allowed.includes(target);
}

/** The single tableau/stock element the player must activate in a guided step. */
export function primaryTarget(step: TutStep): TutTarget | null {
  return allowedTargets(step)?.[0] ?? null;
}
