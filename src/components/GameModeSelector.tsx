"use client";

import React from "react";
import { Check } from "lucide-react";
import {
  CONCRETE_GAME_MODES,
  GAME_MODES_META,
  TactiGameMode,
} from "@/lib/gameModes";
import { useLanguage } from "@/components/LanguageProvider";

interface GameModeSelectorProps {
  value: TactiGameMode;
  onChange: (nextMode: TactiGameMode) => void;
  disabled?: boolean;
}

const ORDERED_MODES: TactiGameMode[] = ["RANDOM", ...CONCRETE_GAME_MODES];

export default function GameModeSelector({
  value,
  onChange,
  disabled = false,
}: GameModeSelectorProps) {
  const { lang } = useLanguage();

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
          {lang === "EN" ? "Tactical Arena Mode" : "Mode Arena Taktik"}
        </span>
        <span className="text-xs font-black text-[#2B90FF]">
          {GAME_MODES_META[value]?.emoji} {GAME_MODES_META[value]?.name}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {ORDERED_MODES.map((modeId) => {
          const meta = GAME_MODES_META[modeId];
          const isSelected = value === modeId;

          return (
            <button
              key={modeId}
              type="button"
              disabled={disabled}
              onClick={() => onChange(modeId)}
              className={`relative flex flex-col items-start p-3 rounded-2xl border-2 border-b-4 text-left transition ${
                isSelected
                  ? "bg-sky-50 border-[#2B90FF] border-b-[#1D7AFC] shadow-xs"
                  : "bg-white border-slate-200 hover:bg-slate-50"
              } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              {isSelected && (
                <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[#2B90FF] text-white flex items-center justify-center">
                  <Check className="w-3 h-3 stroke-[3]" />
                </span>
              )}

              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className={`w-8 h-8 rounded-xl ${meta.badgeColor} text-white flex items-center justify-center text-base shrink-0`}
                >
                  {meta.emoji}
                </span>
                <span className="font-black text-xs sm:text-sm text-slate-800 leading-tight pr-4">
                  {meta.name}
                </span>
              </div>

              <p className="text-[11px] font-medium text-slate-500 line-clamp-2 leading-snug">
                {lang === "EN" ? meta.descEn : meta.descId}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
