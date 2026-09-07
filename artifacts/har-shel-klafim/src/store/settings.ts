import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type Lang } from "@/lib/i18n";

export interface SettingsState {
  lang: Lang;
  textSize: "normal" | "large";
  theme: "dark" | "light";
  glow: boolean;
  reducedMotion: boolean;
  sound: boolean;
  setLang: (lang: Lang) => void;
  setTextSize: (size: "normal" | "large") => void;
  setTheme: (theme: "dark" | "light") => void;
  setGlow: (glow: boolean) => void;
  setReducedMotion: (rm: boolean) => void;
  setSound: (sound: boolean) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      lang: "he",
      textSize: "normal",
      theme: "dark",
      glow: true,
      reducedMotion: false,
      sound: false,
      setLang: (lang) => set({ lang }),
      setTextSize: (textSize) => set({ textSize }),
      setTheme: (theme) => set({ theme }),
      setGlow: (glow) => set({ glow }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setSound: (sound) => set({ sound }),
    }),
    {
      name: "tripeaks-settings-v2",
    }
  )
);
