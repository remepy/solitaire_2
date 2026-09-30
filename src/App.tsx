import { GameBoard } from "@/components/Board";
import MusicManager from "@/components/MusicManager";
import { SessionProvider, useSession } from "@/context/SessionContext";

/** Connects the session (bridge, translations, rounds) to the board. */
function SessionGate() {
  const { stage, translations, musicOn, paused } = useSession();

  // Before session_start, and after exit / abort / error: render nothing.
  // Never a message — a participant must not see a bridge failure (BR-10).
  // Unmounting takes the music with it, which is how audio stops on exit.
  if (!translations || (stage !== "tutorial" && stage !== "playing")) {
    return <div className="blank" />;
  }
  return (
    <>
      <MusicManager audible={musicOn && !paused} />
      <GameBoard />
    </>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <SessionGate />
    </SessionProvider>
  );
}
