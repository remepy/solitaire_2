import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";

import {
  GAME_ID,
  PROTOCOL_VERSION,
  closeBridge,
  hasAppBridge,
  installReceiver,
  postToApp,
  type GameMessageType,
} from "@/lib/bridge";
import { dealForLevel, isKnownLevel, standaloneLevelIds } from "@/lib/levels";
import { readMusicOn, readTutorialSeen, writeMusicOn, writeTutorialSeen } from "@/lib/preferences";
import { format, loadTranslations, type TKey, type Translations } from "@/lib/translations";
import { useGame } from "@/store/game";

const SESSION_START_TIMEOUT_MS = 5000;

/**
 * loading  – fetching translations
 * waiting  – game_ready posted, waiting for session_start
 * tutorial – guided deal before the first round
 * playing  – rounds from levelIds
 * ended    – exit requested, aborted or unrecoverable error: render nothing
 */
export type SessionStage = "loading" | "waiting" | "tutorial" | "playing" | "ended";
export type RoundOutcome = "won" | "lost";

type SessionContextType = {
  stage: SessionStage;
  translations: Translations | null;
  t: (key: TKey, params?: Record<string, string | number>) => string;
  bridged: boolean;
  levelIds: string[];
  roundIndex: number;
  isLastRound: boolean;
  reducedMotion: boolean;
  paused: boolean;
  musicOn: boolean;
  toggleMusic: () => void;
  /** Set once the current round has ended; drives the round-end screen. */
  roundOutcome: RoundOutcome | null;
  nextRound: () => void;
  finishSession: () => void;
  restart: () => void;
  requestExit: () => void;
  openTutorial: () => void;
  finishTutorial: () => void;
  noteHint: () => void;
};

const SessionContext = createContext<SessionContextType | null>(null);

function prefersReducedMotion(): boolean {
  if (!window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function applyDocumentLanguage(tr: Translations) {
  document.documentElement.dir = tr.dir;
  document.documentElement.lang = tr.locale;
  document.title = tr.keys["title"];
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [stage, setStageState] = useState<SessionStage>("loading");
  const [translations, setTranslations] = useState<Translations | null>(null);
  const [bridged, setBridged] = useState(false);
  const [levelIds, setLevelIds] = useState<string[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [paused, setPaused] = useState(false);
  const [musicOn, setMusicOn] = useState(true);
  const [roundOutcome, setRoundOutcome] = useState<RoundOutcome | null>(null);

  const stageRef = useRef<SessionStage>("loading");
  const bridgedRef = useRef(false);
  const musicOnRef = useRef(true);
  const translationsRef = useRef<Translations | null>(null);
  const levelIdsRef = useRef<string[]>([]);
  const roundIndexRef = useRef(0);
  const totalsRef = useRef({ wins: 0, rounds: 0 });
  const hintsRef = useRef(0);
  const finishedRef = useRef(false);
  /** Index of the last round reported via level_completed (-1: none yet). */
  const completedRoundRef = useRef(-1);
  const sessionStartedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setStage = (next: SessionStage) => {
    stageRef.current = next;
    setStageState(next);
  };

  const post = (type: GameMessageType, data?: Record<string, unknown>) => {
    if (stageRef.current === "ended") return;
    postToApp(type, data);
  };

  const fail = (code: string, message: string) => {
    post("game_error", { code, message });
    setStage("ended");
  };

  const loadRound = (index: number) => {
    const deal = dealForLevel(levelIdsRef.current[index]);
    if (!deal) {
      fail("unknown_level", `no deal for ${levelIdsRef.current[index]}`);
      return;
    }
    hintsRef.current = 0;
    setRoundOutcome(null);
    useGame.getState().loadDeal(deal);
  };

  const beginSession = (ids: string[], motion: boolean, tutorialSeen: boolean) => {
    levelIdsRef.current = ids;
    roundIndexRef.current = 0;
    totalsRef.current = { wins: 0, rounds: 0 };
    finishedRef.current = false;
    completedRoundRef.current = -1;
    setLevelIds(ids);
    setRoundIndex(0);
    setReducedMotion(motion);
    setRoundOutcome(null);
    if (tutorialSeen) {
      setStage("playing");
      loadRound(0);
    } else {
      setStage("tutorial");
    }
  };

  const handleMessage = (message: { type?: unknown; data?: unknown }) => {
    if (stageRef.current === "ended") return;
    const data = (message.data ?? {}) as Record<string, unknown>;
    switch (message.type) {
      case "session_start": {
        if (sessionStartedRef.current) return;
        sessionStartedRef.current = true;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        const tr = translationsRef.current!;
        if (data.protocolVersion !== PROTOCOL_VERSION) {
          fail("protocol_mismatch", `expected protocol ${PROTOCOL_VERSION}, got ${String(data.protocolVersion)}`);
          return;
        }
        if (data.expectedLocale !== tr.locale) {
          fail("locale_mismatch", `expected ${String(data.expectedLocale)}, loaded ${tr.locale}`);
          return;
        }
        const ids = data.levelIds;
        if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string" && isKnownLevel(id))) {
          fail("invalid_level_ids", `unsupported levelIds ${JSON.stringify(ids)}`);
          return;
        }
        beginSession(ids as string[], data.reducedMotion === true, data.tutorialSeen === true);
        return;
      }
      case "pause":
        setPaused(true);
        return;
      case "resume":
        setPaused(false);
        return;
      case "abort":
        closeBridge();
        setStage("ended");
        return;
    }
  };
  const handleMessageRef = useRef(handleMessage);
  handleMessageRef.current = handleMessage;

  // Errors outside rendering never reach the ErrorBoundary: report and end.
  useEffect(() => {
    const onError = (event: ErrorEvent) => fail("unexpected_error", event.message || "uncaught error");
    const onRejection = (event: PromiseRejectionEvent) =>
      fail("unexpected_error", event.reason instanceof Error ? event.reason.message : "unhandled rejection");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    let uninstall: (() => void) | null = null;

    loadTranslations()
      .then((tr) => {
        if (cancelled) return;
        const storedMusic = readMusicOn();
        musicOnRef.current = storedMusic;
        setMusicOn(storedMusic);
        translationsRef.current = tr;
        applyDocumentLanguage(tr);
        setTranslations(tr);
        uninstall = installReceiver((m) => handleMessageRef.current(m));

        bridgedRef.current = hasAppBridge();
        setBridged(bridgedRef.current);
        if (bridgedRef.current) {
          setStage("waiting");
          post("game_ready", { gameId: GAME_ID, protocolVersion: PROTOCOL_VERSION, locale: tr.locale });
          timeoutRef.current = setTimeout(() => {
            if (!sessionStartedRef.current) {
              sessionStartedRef.current = true;
              fail("session_start_timeout", `no session_start within ${SESSION_START_TIMEOUT_MS}ms`);
            }
          }, SESSION_START_TIMEOUT_MS);
        } else {
          sessionStartedRef.current = true;
          beginSession(standaloneLevelIds(), prefersReducedMotion(), readTutorialSeen());
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        fail("translations_unavailable", err instanceof Error ? err.message : "translations failed to load");
      });

    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      uninstall?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A round ends on a win or a loss; both count as completed (BR-02).
  useEffect(() => {
    return useGame.subscribe((state) => {
      if (stageRef.current !== "playing") return;
      if (!state.isWon && !state.isLost) return;
      if (completedRoundRef.current === roundIndexRef.current) return;
      completedRoundRef.current = roundIndexRef.current;
      const outcome: RoundOutcome = state.isWon ? "won" : "lost";
      totalsRef.current.rounds += 1;
      if (state.isWon) totalsRef.current.wins += 1;
      post("level_completed", {
        levelId: levelIdsRef.current[roundIndexRef.current],
        outcome,
        stats: {},
      });
      setRoundOutcome(outcome);
    });
     
  }, []);

  const t = useCallback(
    (key: TKey, params?: Record<string, string | number>) =>
      translations ? format(translations.keys[key], params) : "",
    [translations],
  );

  const finishSession = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const ids = levelIdsRef.current;
    post("game_finished", {
      lastCompletedLevelId: ids[ids.length - 1],
      stats: { ...totalsRef.current },
    });
    if (bridgedRef.current) setStage("ended");
     
  }, []);

  const nextRound = useCallback(() => {
    if (completedRoundRef.current !== roundIndexRef.current) return;
    if (roundIndexRef.current >= levelIdsRef.current.length - 1) return;
    roundIndexRef.current += 1;
    setRoundIndex(roundIndexRef.current);
    loadRound(roundIndexRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restart = useCallback(() => {
    if (bridgedRef.current) return; // The app owns progression; only standalone replays.
    beginSession(standaloneLevelIds(), reducedMotion, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  const toggleMusic = useCallback(() => {
    const next = !musicOnRef.current;
    musicOnRef.current = next;
    setMusicOn(next);
    writeMusicOn(next);
  }, []);

  const requestExit = useCallback(() => {
    if (bridgedRef.current) {
      post("game_exit_requested");
      setStage("ended");
    } else {
      window.close();
    }
     
  }, []);

  const openTutorial = useCallback(() => {
    if (stageRef.current !== "playing") return;
    setStage("tutorial");
     
  }, []);

  const finishTutorial = useCallback(() => {
    if (stageRef.current !== "tutorial") return;
    writeTutorialSeen();
    setStage("playing");
    loadRound(roundIndexRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const noteHint = useCallback(() => {
    hintsRef.current += 1;
  }, []);

  return (
    <SessionContext.Provider
      value={{
        stage,
        translations,
        t,
        bridged,
        levelIds,
        roundIndex,
        isLastRound: roundIndex === levelIds.length - 1,
        reducedMotion,
        paused,
        musicOn,
        toggleMusic,
        roundOutcome,
        nextRound,
        finishSession,
        restart,
        requestExit,
        openTutorial,
        finishTutorial,
        noteHint,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
