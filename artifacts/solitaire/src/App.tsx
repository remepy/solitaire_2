import { useEffect } from 'react';
import { GameBoard } from '@/components/Board';
import { useSettings } from '@/store/settings';
import { ErrorBoundary } from '@/components/error-boundary';

function ThemeManager() {
  const { theme, lang, reducedMotion, textSize } = useSettings();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("theme-light");
      root.classList.remove("dark");
    } else {
      root.classList.remove("theme-light");
      root.classList.add("dark");
    }
    
    if (reducedMotion) {
      root.classList.add("reduced-motion-enabled");
    } else {
      root.classList.remove("reduced-motion-enabled");
    }

    root.lang = lang;
    root.dir = lang === "he" ? "rtl" : "ltr";
    
    // Scale font-size
    const baseSize = lang === "he" ? 18 : 16;
    const scale = textSize === "large" ? 1.3 : 1.0;
    root.style.fontSize = `${baseSize * scale}px`;

  }, [theme, lang, reducedMotion, textSize]);

  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeManager />
      <GameBoard />
    </ErrorBoundary>
  );
}

export default App;
