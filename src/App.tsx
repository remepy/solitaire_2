import { GameBoard } from "@/components/Board";
import { SessionProvider, useSession } from "@/context/SessionContext";

/** Connects the session (bridge, translations, rounds) to the board. */
function SessionGate() {
  const { stage, translations } = useSession();

  // Before session_start, and after exit / abort / error: render nothing.
  // Never a message — a participant must not see a bridge failure (BR-10).
  if (!translations || (stage !== "tutorial" && stage !== "playing")) {
    return <div className="blank" />;
  }
  return <GameBoard />;
}

export default function App() {
  return (
    <SessionProvider>
      <SessionGate />
    </SessionProvider>
  );
}
