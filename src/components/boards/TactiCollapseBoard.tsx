"use client";

import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Sparkles,
  RotateCcw,
  AlertTriangle,
  Send,
  Check,
  Flame,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import {
  OptionKey,
  OPTION_STYLES,
  QuestionData,
} from "@/components/ChessQuizBoard";
import { useLanguage } from "@/components/LanguageProvider";
import { sound } from "@/lib/sound";

interface Coord {
  r: number;
  c: number;
}

interface TactiCollapseBoardProps {
  question: QuestionData;
  eliminatedOptions?: OptionKey[];
  disabled?: boolean;
  onAnswer: (
    selected: OptionKey,
    isCorrect: boolean,
    movesUsed: number,
  ) => void;
}

const BOARD_SIZE = 6;
const START_POS: Coord = { r: 5, c: 0 };

function coordKey(r: number, c: number): string {
  return `${r},${c}`;
}

function parseBoardOptionKeys(
  rawList: unknown,
  fallbackSingle?: unknown,
): OptionKey[] {
  const validSet = new Set<OptionKey>(["A", "B", "C", "D"]);
  let candidates: unknown[] = [];

  if (Array.isArray(rawList)) {
    candidates = rawList;
  } else if (typeof rawList === "string" && rawList.trim()) {
    const trimmed = rawList.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) candidates = parsed;
      } catch {
        // abaikan
      }
    } else {
      candidates = trimmed.replace(/[{}"]/g, "").split(",");
    }
  }

  if (candidates.length === 0 && typeof fallbackSingle === "string") {
    candidates = fallbackSingle.replace(/[{}"]/g, "").split(",");
  }

  const normalized = candidates
    .map((item) => String(item).trim().toUpperCase() as OptionKey)
    .filter((k) => validSet.has(k));

  return normalized.length > 0 ? Array.from(new Set(normalized)) : ["A"];
}

function canReachCollapseTarget(
  origin: Coord,
  targetCoord: Coord,
  otherTokenCoords: Set<string>,
  obstacles: Set<string>,
): boolean {
  const startKey = coordKey(origin.r, origin.c);
  const targetKey = coordKey(targetCoord.r, targetCoord.c);
  const blockers = new Set<string>(obstacles);
  otherTokenCoords.forEach((k) => blockers.add(k));

  if (blockers.has(startKey) || blockers.has(targetKey)) return false;

  const visited = new Set<string>([startKey]);
  const queue: Coord[] = [origin];
  const dirs: [number, number][] = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr.r === targetCoord.r && curr.c === targetCoord.c) return true;

    for (const [dr, dc] of dirs) {
      const nr = curr.r + dr;
      const nc = curr.c + dc;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
      const k = coordKey(nr, nc);
      if (!visited.has(k) && !blockers.has(k)) {
        visited.add(k);
        queue.push({ r: nr, c: nc });
      }
    }
  }

  return false;
}

function isCollapseLayoutPlayable(
  tokens: Record<OptionKey, Coord>,
  obstacles: Set<string>,
): boolean {
  const keys: OptionKey[] = ["A", "B", "C", "D"];

  // 1. Pastikan tiap opsi bisa dicapai dari titik awal tanpa menabrak 3 opsi lain
  for (const targetOpt of keys) {
    const others = new Set<string>();
    keys.forEach((k) => {
      if (k !== targetOpt) {
        others.add(coordKey(tokens[k].r, tokens[k].c));
      }
    });
    if (
      !canReachCollapseTarget(START_POS, tokens[targetOpt], others, obstacles)
    ) {
      return false;
    }
  }

  // 2. Pastikan antar opsi juga terhubung (menjamin Multiple Answers tidak buntu)
  for (const fromOpt of keys) {
    for (const toOpt of keys) {
      if (fromOpt === toOpt) continue;
      const others = new Set<string>();
      keys.forEach((k) => {
        if (k !== fromOpt && k !== toOpt) {
          others.add(coordKey(tokens[k].r, tokens[k].c));
        }
      });
      if (
        !canReachCollapseTarget(
          tokens[fromOpt],
          tokens[toOpt],
          others,
          obstacles,
        )
      ) {
        return false;
      }
    }
  }

  return true;
}

function generateCollapseLayout(obstacleCount: number): {
  tokens: Record<OptionKey, Coord>;
  obstacles: Set<string>;
  initialDurability: Record<string, number>;
} {
  const optionKeys: OptionKey[] = ["A", "B", "C", "D"];
  const clampedObstacles = Math.max(0, Math.min(5, obstacleCount || 0));
  const startKey = coordKey(START_POS.r, START_POS.c);

  let chosenTokens: Record<OptionKey, Coord> | null = null;
  let chosenObstacles = new Set<string>();

  for (let attempt = 0; attempt < 140; attempt++) {
    const tokenCandidates: Coord[] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (Math.abs(r - START_POS.r) + Math.abs(c - START_POS.c) <= 1)
          continue;
        tokenCandidates.push({ r, c });
      }
    }

    const shuffledTokens = [...tokenCandidates].sort(() => Math.random() - 0.5);
    const tokens = {} as Record<OptionKey, Coord>;
    const occupied = new Set<string>([startKey]);

    optionKeys.forEach((opt, idx) => {
      tokens[opt] = shuffledTokens[idx];
      occupied.add(coordKey(shuffledTokens[idx].r, shuffledTokens[idx].c));
    });

    if (!isCollapseLayoutPlayable(tokens, new Set())) continue;

    const obsCandidates: Coord[] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const k = coordKey(r, c);
        if (!occupied.has(k)) {
          if (Math.abs(r - START_POS.r) <= 1 && Math.abs(c - START_POS.c) <= 1)
            continue;
          obsCandidates.push({ r, c });
        }
      }
    }

    const shuffledObs = [...obsCandidates].sort(() => Math.random() - 0.5);
    const obstacles = new Set<string>();

    for (const cand of shuffledObs) {
      if (obstacles.size >= clampedObstacles) break;
      const k = coordKey(cand.r, cand.c);
      obstacles.add(k);
      if (!isCollapseLayoutPlayable(tokens, obstacles)) {
        obstacles.delete(k);
      }
    }

    if (isCollapseLayoutPlayable(tokens, obstacles)) {
      chosenTokens = tokens;
      chosenObstacles = obstacles;
      break;
    }
  }

  if (!chosenTokens) {
    chosenTokens = {
      A: { r: 1, c: 1 },
      B: { r: 1, c: 4 },
      C: { r: 4, c: 2 },
      D: { r: 3, c: 5 },
    };
    chosenObstacles = new Set(["2,2", "4,4"]);
  }

  const initialDurability: Record<string, number> = {};
  const tokenCoords = new Set<string>(
    optionKeys.map((opt) =>
      coordKey(chosenTokens![opt].r, chosenTokens![opt].c),
    ),
  );

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const k = coordKey(r, c);
      if (chosenObstacles.has(k)) {
        initialDurability[k] = 0;
      } else if (k === startKey || tokenCoords.has(k)) {
        // Petak start & petak opsi diberi ketahanan 2 agar aman keluar-masuk
        initialDurability[k] = 2;
      } else {
        // ~40% petak rapuh (1x injak), ~60% petak batu kokoh (2x injak)
        initialDurability[k] = Math.random() < 0.4 ? 1 : 2;
      }
    }
  }

  return {
    tokens: chosenTokens,
    obstacles: chosenObstacles,
    initialDurability,
  };
}

export default function TactiCollapseBoard({
  question,
  eliminatedOptions = [],
  disabled = false,
  onAnswer,
}: TactiCollapseBoardProps) {
  const { lang } = useLanguage();

  const validCorrectKeys: OptionKey[] = useMemo(
    () =>
      parseBoardOptionKeys(question.correct_options, question.correct_option),
    [question.correct_options, question.correct_option],
  );

  const isMultiple =
    Boolean(question.allow_multiple) || validCorrectKeys.length > 1;

  const { tokens, obstacles, initialDurability } = useMemo(
    () => generateCollapseLayout(question.obstacles),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [question.id],
  );

  const [playerPos, setPlayerPos] = useState<Coord>(START_POS);
  const playerPosRef = useRef<Coord>(START_POS);
  const [durability, setDurability] =
    useState<Record<string, number>>(initialDurability);
  const durabilityRef = useRef<Record<string, number>>(initialDurability);
  const [movesUsed, setMovesUsed] = useState<number>(0);
  const movesUsedRef = useRef<number>(0);
  const [selectedOptions, setSelectedOptions] = useState<OptionKey[]>([]);
  const selectedOptionsRef = useRef<OptionKey[]>([]);
  const [boardLocked, setBoardLocked] = useState<boolean>(false);
  const [hasWrongResult, setHasWrongResult] = useState<boolean>(false);

  useEffect(() => {
    setPlayerPos(START_POS);
    playerPosRef.current = START_POS;
    setDurability(initialDurability);
    durabilityRef.current = initialDurability;
    setMovesUsed(0);
    movesUsedRef.current = 0;
    setSelectedOptions([]);
    selectedOptionsRef.current = [];
    setBoardLocked(false);
    setHasWrongResult(false);
  }, [question.id, initialDurability]);

  const isInteractionDisabled = disabled || boardLocked;

  const validNeighbors = useMemo(() => {
    const set = new Set<string>();
    if (isInteractionDisabled) return set;

    const dirs: [number, number][] = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (const [dr, dc] of dirs) {
      const nr = playerPos.r + dr;
      const nc = playerPos.c + dc;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
      const k = coordKey(nr, nc);
      if (!obstacles.has(k) && (durability[k] ?? 0) > 0) {
        set.add(k);
      }
    }
    return set;
  }, [playerPos, obstacles, durability, isInteractionDisabled]);

  const isStranded = !isInteractionDisabled && validNeighbors.size === 0;

  const finalizeMultipleSelection = useCallback(
    (finalPicks: OptionKey[], movesScore: number) => {
      const isAllCorrect =
        finalPicks.length === validCorrectKeys.length &&
        validCorrectKeys.every((key) => finalPicks.includes(key));

      if (isAllCorrect) {
        sound.playCorrect();
        setBoardLocked(true);
        onAnswer(finalPicks[0], true, movesScore);
      } else {
        sound.playWrong();
        setHasWrongResult(true);
        const firstWrong =
          finalPicks.find((key) => !validCorrectKeys.includes(key)) ||
          finalPicks[0];
        setBoardLocked(true);
        onAnswer(firstWrong, false, movesScore);
      }
    },
    [validCorrectKeys, onAnswer],
  );

  const handleStepTo = useCallback(
    (r: number, c: number) => {
      if (isInteractionDisabled) return;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return;

      const currPos = playerPosRef.current;
      const dist = Math.abs(r - currPos.r) + Math.abs(c - currPos.c);
      if (dist !== 1) return;

      const targetKey = coordKey(r, c);
      const currDurability = durabilityRef.current;
      if (obstacles.has(targetKey) || (currDurability[targetKey] ?? 0) <= 0) {
        return;
      }

      const prevKey = coordKey(currPos.r, currPos.c);
      const nextDurability = {
        ...currDurability,
        [prevKey]: Math.max(0, (currDurability[prevKey] ?? 1) - 1),
      };
      durabilityRef.current = nextDurability;
      setDurability(nextDurability);

      const nextMoves = movesUsedRef.current + 1;
      movesUsedRef.current = nextMoves;
      setMovesUsed(nextMoves);

      const nextPos = { r, c };
      playerPosRef.current = nextPos;
      setPlayerPos(nextPos);

      // Cek apakah menginjak opsi jawaban aktif
      const currSelected = selectedOptionsRef.current;
      const hitOption = (["A", "B", "C", "D"] as OptionKey[]).find((opt) => {
        if (eliminatedOptions.includes(opt)) return false;
        if (currSelected.includes(opt)) return false;
        const tPos = tokens[opt];
        return tPos && tPos.r === r && tPos.c === c;
      });

      if (!hitOption) {
        sound.playMove();
        return;
      }

      if (!isMultiple) {
        const isCorrect = validCorrectKeys.includes(hitOption);
        if (isCorrect) {
          sound.playCorrect();
        } else {
          sound.playWrong();
          setHasWrongResult(true);
        }
        selectedOptionsRef.current = [hitOption];
        setSelectedOptions([hitOption]);
        setBoardLocked(true);
        onAnswer(hitOption, isCorrect, nextMoves);
        return;
      }

      // Mode Multiple Answers: biarkan lanjut meski pilihan pertama salah
      const nextSelected = [...currSelected, hitOption];
      selectedOptionsRef.current = nextSelected;
      setSelectedOptions(nextSelected);

      if (nextSelected.length >= validCorrectKeys.length) {
        finalizeMultipleSelection(nextSelected, nextMoves);
      } else {
        sound.playPowerUp();
      }
    },
    [
      isInteractionDisabled,
      obstacles,
      eliminatedOptions,
      tokens,
      isMultiple,
      validCorrectKeys,
      onAnswer,
      finalizeMultipleSelection,
    ],
  );

  // Dukungan kontrol keyboard (Arrow Keys & WASD)
  useEffect(() => {
    if (isInteractionDisabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      let dr = 0;
      let dc = 0;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") dr = -1;
      else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") dr = 1;
      else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") dc = -1;
      else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") dc = 1;
      else return;

      e.preventDefault();
      const curr = playerPosRef.current;
      handleStepTo(curr.r + dr, curr.c + dc);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isInteractionDisabled, handleStepTo]);

  const handleResetBridge = () => {
    if (isInteractionDisabled) return;
    sound.playMove();
    playerPosRef.current = START_POS;
    setPlayerPos(START_POS);
    durabilityRef.current = initialDurability;
    setDurability(initialDurability);
    const nextMoves = movesUsedRef.current + 1;
    movesUsedRef.current = nextMoves;
    setMovesUsed(nextMoves);
  };

  const handleManualSubmitMultiple = () => {
    if (
      isInteractionDisabled ||
      !isMultiple ||
      selectedOptionsRef.current.length === 0
    ) {
      return;
    }
    finalizeMultipleSelection(
      selectedOptionsRef.current,
      Math.max(1, movesUsedRef.current),
    );
  };

  const canStepDir = (dr: number, dc: number) => {
    if (isInteractionDisabled) return false;
    return validNeighbors.has(coordKey(playerPos.r + dr, playerPos.c + dc));
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Volcanic Bridge HUD Header */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-stone-900 via-[#23170D] to-stone-900 border border-amber-500/35 text-white shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/45 flex items-center justify-center text-xl shrink-0">
            <span>🌉</span>
            <Flame className="w-3 h-3 text-orange-400 absolute -top-1 -right-1 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-black text-xs sm:text-sm text-white tracking-tight truncate">
                TactiCollapse
              </p>
              <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[9px] font-black uppercase tracking-wider">
                Fragile Path
              </span>
            </div>
            <p className="text-[11px] font-medium text-amber-100/80 truncate">
              {lang === "EN"
                ? "Tiles crack & fall after you leave—watch durability (1–2)!"
                : "Pijakan retak & runtuh saat ditinggalkan—cek angka ketahanan!"}
            </p>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-xl bg-white/10 border border-white/15 text-[11px] font-black text-amber-100 shrink-0">
          {lang === "EN" ? `Steps: ${movesUsed}` : `Langkah: ${movesUsed}`}
        </span>
      </div>

      {/* Peringatan saat Terjebak di Pulau Buntu */}
      <AnimatePresence>
        {isStranded && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            className="px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 text-white text-xs font-black flex items-center justify-between gap-2 shadow-md"
          >
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0 animate-bounce" />
              {lang === "EN"
                ? "Bridge collapsed around you! Restore bridge to continue."
                : "Jembatan di sekitarmu runtuh! Pulihkan jembatan untuk lanjut."}
            </span>
            <button
              type="button"
              onClick={handleResetBridge}
              className="px-2.5 py-1 rounded-xl bg-white text-rose-700 hover:bg-rose-50 text-[11px] font-black shrink-0 cursor-pointer shadow-xs"
            >
              {lang === "EN" ? "Restore" : "Pulihkan"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HUD Khusus Multiple Answers (Netral saat memilih, evaluasi di akhir) */}
      {isMultiple && (
        <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50/80 border-2 border-amber-300 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              {lang === "EN"
                ? `Select ${validCorrectKeys.length} Options (${selectedOptions.length}/${validCorrectKeys.length})`
                : `Pilih ${validCorrectKeys.length} Jawaban (${selectedOptions.length}/${validCorrectKeys.length})`}
            </span>
            <div className="flex items-center gap-1.5">
              {validCorrectKeys.map((_, slotIdx) => {
                const pickedOpt = selectedOptions[slotIdx];
                if (!pickedOpt) {
                  return (
                    <span
                      key={`slot-${slotIdx}`}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white/80 border border-dashed border-amber-400 text-amber-700 text-[11px] font-black"
                    >
                      #{slotIdx + 1} ?
                    </span>
                  );
                }

                if (!boardLocked) {
                  return (
                    <span
                      key={`slot-${slotIdx}`}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white text-[11px] font-black shadow-2xs"
                    >
                      <Check className="w-3 h-3" /> {pickedOpt}
                    </span>
                  );
                }

                const isRight = validCorrectKeys.includes(pickedOpt);
                return (
                  <span
                    key={`slot-${slotIdx}`}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-white text-[11px] font-black shadow-2xs ${
                      isRight ? "bg-emerald-500" : "bg-rose-500"
                    }`}
                  >
                    {isRight ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <XCircle className="w-3 h-3" />
                    )}{" "}
                    {pickedOpt}
                  </span>
                );
              })}
            </div>
          </div>

          {selectedOptions.length > 0 && !isInteractionDisabled && (
            <button
              type="button"
              onClick={handleManualSubmitMultiple}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black transition cursor-pointer shrink-0"
            >
              <Send className="w-3 h-3" />
              <span>{lang === "EN" ? "Lock Answer" : "Kunci"}</span>
            </button>
          )}
        </div>
      )}

      {/* Arena Jembatan 6x6 dengan 60fps Smooth Glide Overlay */}
      <motion.div
        animate={hasWrongResult ? { x: [0, -7, 7, -5, 5, 0] } : { x: 0 }}
        transition={{ duration: 0.35 }}
        className={`relative aspect-square w-full max-w-[385px] mx-auto rounded-2xl overflow-hidden border-4 shadow-xl bg-[#140C08] p-1.5 select-none transition-colors ${
          hasWrongResult
            ? "border-rose-500"
            : isStranded
              ? "border-rose-400"
              : "border-stone-900"
        }`}
      >
        {/* Pendaran Lava di Dasar Jurang */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(234,88,12,0.16),transparent_75%)] pointer-events-none" />

        {/* Grid Sel Jembatan 6x6 */}
        <div className="relative w-full h-full grid grid-cols-6 grid-rows-6 gap-1">
          {Array.from({ length: BOARD_SIZE }).map((_, r) =>
            Array.from({ length: BOARD_SIZE }).map((__, c) => {
              const key = coordKey(r, c);
              const isStartTile = r === START_POS.r && c === START_POS.c;
              const isObstacle = obstacles.has(key);
              const tileDurability = durability[key] ?? 0;
              const isCollapsed = !isObstacle && tileDurability <= 0;
              const isNeighbor = validNeighbors.has(key);

              const tokenHere = (["A", "B", "C", "D"] as OptionKey[]).find(
                (opt) => {
                  const tPos = tokens[opt];
                  return tPos && tPos.r === r && tPos.c === c;
                },
              );

              const isEliminated = tokenHere
                ? eliminatedOptions.includes(tokenHere)
                : false;
              const isAlreadySelected = tokenHere
                ? selectedOptions.includes(tokenHere)
                : false;
              const showActiveToken =
                tokenHere && !isEliminated && !isAlreadySelected;

              let tileStyle =
                "bg-stone-950/65 border-stone-800/35 shadow-inner";
              if (isObstacle) {
                tileStyle =
                  "bg-gradient-to-b from-stone-700 to-stone-900 border-stone-600/70";
              } else if (!isCollapsed) {
                if (tileDurability >= 2) {
                  tileStyle = isNeighbor
                    ? "bg-gradient-to-b from-emerald-50 to-emerald-100 border-emerald-400 ring-2 ring-emerald-400/70 shadow-sm"
                    : "bg-gradient-to-b from-[#FAF5EE] to-[#EDE2D2] border-amber-300/90 shadow-xs";
                } else {
                  tileStyle = isNeighbor
                    ? "bg-gradient-to-b from-amber-100 to-orange-200 border-dashed border-orange-500 ring-2 ring-amber-400/80 shadow-sm"
                    : "bg-gradient-to-b from-orange-100 to-amber-200/90 border-dashed border-orange-500/85";
                }
              }

              return (
                <button
                  key={key}
                  type="button"
                  disabled={!isNeighbor || isInteractionDisabled}
                  onClick={() => handleStepTo(r, c)}
                  className={`relative rounded-xl border-2 flex items-center justify-center transition-all duration-150 ${tileStyle} ${
                    isNeighbor && !isInteractionDisabled
                      ? "cursor-pointer hover:brightness-95 active:scale-95"
                      : "cursor-default"
                  }`}
                >
                  {/* Lubang Jurang Runtuh */}
                  {isCollapsed && (
                    <motion.div
                      initial={{ scale: 1.15, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex flex-col items-center justify-center text-orange-500/35 pointer-events-none"
                    >
                      <span className="text-xs font-black">✕</span>
                    </motion.div>
                  )}

                  {/* Label START di pojok awal */}
                  {isStartTile &&
                    !isCollapsed &&
                    !(playerPos.r === r && playerPos.c === c) && (
                      <span className="text-[8px] font-black text-stone-400 uppercase tracking-tighter pointer-events-none">
                        START
                      </span>
                    )}

                  {/* Indikator Pips Ketahanan Pijakan (2 titik kokoh / 1 titik retak) */}
                  {!isObstacle &&
                    !isCollapsed &&
                    !(playerPos.r === r && playerPos.c === c) && (
                      <div className="absolute top-1 right-1 flex items-center gap-0.5 pointer-events-none">
                        {tileDurability >= 2 ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-stone-500" />
                            <span className="w-1.5 h-1.5 rounded-full bg-stone-500" />
                          </>
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-ping" />
                        )}
                      </div>
                    )}

                  {/* Titik Hijau Langkah Valid */}
                  {isNeighbor &&
                    !showActiveToken &&
                    !(playerPos.r === r && playerPos.c === c) && (
                      <span className="w-3 h-3 rounded-full bg-emerald-600/80 ring-4 ring-emerald-500/20 pointer-events-none" />
                    )}

                  {/* Pilar Batu Penghalang */}
                  {isObstacle && (
                    <span className="text-lg sm:text-xl drop-shadow-xs pointer-events-none">
                      🧱
                    </span>
                  )}

                  {/* Badge Opsi Sudah Dipilih (Netral saat berlangsung, Hijau/Merah saat selesai) */}
                  {tokenHere && isAlreadySelected && (
                    <span
                      className={`z-10 w-7 h-7 rounded-lg border-2 font-black text-xs flex items-center justify-center pointer-events-none ${
                        !boardLocked
                          ? "bg-indigo-500/20 border-indigo-500 text-indigo-800"
                          : validCorrectKeys.includes(tokenHere)
                            ? "bg-emerald-500/25 border-emerald-500 text-emerald-800"
                            : "bg-rose-500/25 border-rose-500 text-rose-800"
                      }`}
                    >
                      {!boardLocked
                        ? `●${tokenHere}`
                        : validCorrectKeys.includes(tokenHere)
                          ? `✓${tokenHere}`
                          : `✗${tokenHere}`}
                    </span>
                  )}

                  {/* Target Pilihan Jawaban (A, B, C, D) */}
                  {showActiveToken && tokenHere && (
                    <div className="relative z-10 flex items-center justify-center pointer-events-none">
                      {isNeighbor && (
                        <span className="absolute -inset-1.5 rounded-xl border-2 border-amber-500/80 animate-ping" />
                      )}
                      <span
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${OPTION_STYLES[tokenHere].badgeBg} text-white font-black text-sm sm:text-base flex items-center justify-center shadow-md border-b-2 border-black/25`}
                      >
                        {tokenHere}
                      </span>
                    </div>
                  )}
                </button>
              );
            }),
          )}

          {/* Layer Karakter Penjelajah (60fps Smooth Glide Overlay) */}
          <motion.div
            initial={false}
            animate={{
              left: `${(playerPos.c / BOARD_SIZE) * 100}%`,
              top: `${(playerPos.r / BOARD_SIZE) * 100}%`,
            }}
            transition={{
              type: "spring",
              stiffness: 420,
              damping: 28,
            }}
            style={{
              width: `${100 / BOARD_SIZE}%`,
              height: `${100 / BOARD_SIZE}%`,
            }}
            className="absolute z-20 p-0.5 flex items-center justify-center pointer-events-none"
          >
            <div className="w-full h-full rounded-xl bg-gradient-to-br from-amber-500 via-orange-600 to-amber-700 text-white flex items-center justify-center text-2xl sm:text-3xl shadow-[0_6px_14px_rgba(217,119,6,0.55)] border-b-4 border-amber-950 ring-2 ring-amber-200/75">
              🧗
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Bar Kontrol Arah (D-Pad), Legenda & Tombol Ulang Jembatan */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-2.5 text-[11px] font-bold text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="w-3.5 h-3.5 rounded bg-[#FAF5EE] border border-amber-400 inline-flex items-center justify-center gap-0.5">
              <span className="w-1 h-1 rounded-full bg-stone-500" />
              <span className="w-1 h-1 rounded-full bg-stone-500" />
            </span>
            {lang === "EN" ? "2x" : "2x"}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3.5 h-3.5 rounded bg-orange-100 border border-dashed border-orange-500 inline-flex items-center justify-center">
              <span className="w-1 h-1 rounded-full bg-orange-600" />
            </span>
            {lang === "EN" ? "1x" : "1x"}
          </span>
        </div>

        {/* D-Pad Ringkas untuk Mobile & Mouse */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!canStepDir(0, -1)}
            onClick={() => handleStepTo(playerPos.r, playerPos.c - 1)}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-amber-100 active:scale-95 disabled:opacity-35 text-slate-700 flex items-center justify-center border-b-2 border-slate-300 transition cursor-pointer disabled:cursor-default"
            title="Left"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={!canStepDir(-1, 0)}
            onClick={() => handleStepTo(playerPos.r - 1, playerPos.c)}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-amber-100 active:scale-95 disabled:opacity-35 text-slate-700 flex items-center justify-center border-b-2 border-slate-300 transition cursor-pointer disabled:cursor-default"
            title="Up"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={!canStepDir(1, 0)}
            onClick={() => handleStepTo(playerPos.r + 1, playerPos.c)}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-amber-100 active:scale-95 disabled:opacity-35 text-slate-700 flex items-center justify-center border-b-2 border-slate-300 transition cursor-pointer disabled:cursor-default"
            title="Down"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={!canStepDir(0, 1)}
            onClick={() => handleStepTo(playerPos.r, playerPos.c + 1)}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-amber-100 active:scale-95 disabled:opacity-35 text-slate-700 flex items-center justify-center border-b-2 border-slate-300 transition cursor-pointer disabled:cursor-default"
            title="Right"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          disabled={isInteractionDisabled || movesUsed === 0}
          onClick={handleResetBridge}
          className={`px-3 py-1.5 rounded-xl text-xs font-black inline-flex items-center gap-1.5 border-b-2 transition ${
            isStranded
              ? "bg-rose-600 hover:bg-rose-700 text-white border-rose-800 animate-pulse cursor-pointer"
              : "bg-slate-100 hover:bg-amber-100 disabled:opacity-40 text-slate-700 border-slate-300 cursor-pointer disabled:cursor-default"
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{lang === "EN" ? "Reset" : "Ulang"}</span>
        </button>
      </div>
    </div>
  );
}
