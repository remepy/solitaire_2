import { useEffect, useState } from "react";
import { useSettings } from "@/store/settings";

const QUERY = "(prefers-reduced-motion: reduce)";

/** Effective reduced-motion: the in-app toggle OR the OS preference. */
export function useReducedMotion(): boolean {
  const setting = useSettings((s) => s.reducedMotion);
  const [system, setSystem] = useState(() =>
    typeof window !== "undefined" && window.matchMedia(QUERY).matches
  );
  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const update = () => setSystem(mql.matches);
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return setting || system;
}
