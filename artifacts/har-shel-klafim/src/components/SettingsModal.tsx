import React from "react";
import { useSettings } from "@/store/settings";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const settings = useSettings();
  const lang = settings.lang;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className={cn(
          "bg-popover text-popover-foreground w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col",
          ""
        )}
        dir={lang === "he" ? "rtl" : "ltr"}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-bold">{t(lang, "settings.title")}</h2>
          <button 
            onClick={onClose}
            className="p-2 -mr-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto max-h-[80vh] flex flex-col gap-6">
          {/* Language */}
          <div className="flex items-center justify-between">
            <span className="font-semibold">{t(lang, "settings.language")}</span>
            <div className="flex gap-2">
              <button 
                onClick={() => settings.setLang("he")}
                className={cn(
                  "px-4 py-2 rounded-lg font-medium transition-colors",
                  lang === "he" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {t(lang, "settings.language.he")}
              </button>
              <button 
                onClick={() => settings.setLang("en")}
                className={cn(
                  "px-4 py-2 rounded-lg font-medium transition-colors",
                  lang === "en" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {t(lang, "settings.language.en")}
              </button>
            </div>
          </div>
          
          {/* Text Size */}
          <div className="flex items-center justify-between">
            <span className="font-semibold">{t(lang, "settings.textSize")}</span>
            <div className="flex gap-2">
              <button 
                onClick={() => settings.setTextSize("normal")}
                className={cn(
                  "px-4 py-2 rounded-lg font-medium transition-colors",
                  settings.textSize === "normal" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {t(lang, "settings.textSize.normal")}
              </button>
              <button 
                onClick={() => settings.setTextSize("large")}
                className={cn(
                  "px-4 py-2 rounded-lg font-medium transition-colors",
                  settings.textSize === "large" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {t(lang, "settings.textSize.large")}
              </button>
            </div>
          </div>
          
          {/* Theme */}
          <div className="flex items-center justify-between">
            <span className="font-semibold">{t(lang, "settings.theme")}</span>
            <div className="flex gap-2">
              <button 
                onClick={() => settings.setTheme("dark")}
                className={cn(
                  "px-4 py-2 rounded-lg font-medium transition-colors",
                  settings.theme === "dark" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {t(lang, "settings.theme.dark")}
              </button>
              <button 
                onClick={() => settings.setTheme("light")}
                className={cn(
                  "px-4 py-2 rounded-lg font-medium transition-colors",
                  settings.theme === "light" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {t(lang, "settings.theme.light")}
              </button>
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-4">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="font-semibold">{t(lang, "settings.motion")}</span>
              <input 
                type="checkbox" 
                className="w-6 h-6 accent-primary"
                checked={settings.reducedMotion}
                onChange={(e) => settings.setReducedMotion(e.target.checked)}
              />
            </label>
            
            <label className="flex items-center justify-between cursor-pointer">
              <span className="font-semibold">{t(lang, "settings.sound")}</span>
              <input 
                type="checkbox" 
                className="w-6 h-6 accent-primary"
                checked={settings.sound}
                onChange={(e) => settings.setSound(e.target.checked)}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
