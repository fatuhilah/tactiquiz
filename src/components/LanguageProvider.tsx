"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { Language, translations, TranslationKey } from "@/lib/i18n";

interface LanguageContextValue {
  lang: Language;
  setLang: (next: Language) => void;
  toggleLang: () => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "ID",
  setLang: () => {},
  toggleLang: () => {},
  t: (key) => translations.ID[key],
});

const STORAGE_KEY = "tactiquiz_lang";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("ID");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "ID" || saved === "EN") {
      setLangState(saved);
    }
  }, []);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === "ID" ? "EN" : "ID");
  }, [lang, setLang]);

  const t = useCallback(
    (key: TranslationKey): string => {
      return translations[lang][key] || translations.ID[key];
    },
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}

      {/* Tombol Switcher Bahasa Mengambang (Otomatis sembunyi saat print PDF) */}
      <div className="fixed bottom-4 left-4 z-40 print:hidden">
        <LanguageToggle />
      </div>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLanguage();

  return (
    <div
      className={`inline-flex items-center gap-1 p-1 rounded-2xl bg-white/95 backdrop-blur-xs border-2 border-slate-200 border-b-4 shadow-md ${className}`}
      role="group"
      aria-label="Language Switcher"
    >
      <button
        type="button"
        onClick={() => setLang("ID")}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black transition cursor-pointer ${
          lang === "ID"
            ? "bg-[#2B90FF] text-white shadow-xs"
            : "text-slate-500 hover:text-slate-800"
        }`}
      >
        <span>🇮🇩</span>
        <span>ID</span>
      </button>

      <button
        type="button"
        onClick={() => setLang("EN")}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black transition cursor-pointer ${
          lang === "EN"
            ? "bg-[#2B90FF] text-white shadow-xs"
            : "text-slate-500 hover:text-slate-800"
        }`}
      >
        <span>🇬🇧</span>
        <span>EN</span>
      </button>
    </div>
  );
}
