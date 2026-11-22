"use client";

import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Sparkles,
  Send,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Check,
  Compass,
  ShieldCheck,
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

interface ObstacleNode {
  id: string;
  r: number;
  c: number;
}

type HoveredAxis = { type: "ROW" | "COL"; index: number } | null;

interface TactiShiftBoardProps {
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

const ORTHO_DIRS: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

function coordKey(r: number, c: number): string {
  return `${r},${c}`;
}

function wrapIndex(idx: number): number {
  return ((idx % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
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

function generateShiftLayout(obstacleCount: number): {
  initialTokens: Record<OptionKey, Coord>;
  initialObstacles: ObstacleNode[];
} {
  const optionKeys: OptionKey[] = ["A", "B", "C", "D"];
  const clampedObstacles = Math.max(4, Math.min(7, (obstacleCount || 3) + 2));
  const startKey = coordKey(START_POS.r, START_POS.c);

  const candidateCells: Coord[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (coordKey(r, c) === startKey) continue;
      candidateCells.push({ r, c });
    }
  }

  const shuffled = [...candidateCells].sort(() => Math.random() - 0.5);

  // Tempatkan 4 token opsi jawaban (hindari petak tepat bersebelahan dengan posisi start)
  const tokenPool = shuffled.filter(
    (cell) =>
      Math.abs(cell.r - START_POS.r) + Math.abs(cell.c - START_POS.c) > 1,
  );

  const initialTokens = {} as Record<OptionKey, Coord>;
  const used = new Set<string>([startKey]);

  optionKeys.forEach((opt, idx) => {
    const picked = tokenPool[idx] || shuffled[idx];
    initialTokens[opt] = picked;
    used.add(coordKey(picked.r, picked.c));
  });

  // Tempatkan rintangan batu di petak sisa (sisakan pintu keluar dari START_POS)
  const obstaclePool = shuffled.filter((cell) => {
    const k = coordKey(cell.r, cell.c);
    if (used.has(k)) return false;
    if ((cell.r === 5 && cell.c === 1) || (cell.r === 4 && cell.c === 0)) {
      return false;
    }
    return true;
  });

  const initialObstacles: ObstacleNode[] = obstaclePool
    .slice(0, clampedObstacles)
    .map((cell, idx) => ({
      id: `obs-${idx}`,
      r: cell.r,
      c: cell.c,
    }));

  return { initialTokens, initialObstacles };
}

export default function TactiShiftBoard({
  question,
  eliminatedOptions = [],
  disabled = false,
  onAnswer,
}: TactiShiftBoardProps) {
  const { lang } = useLanguage();

  const validCorrectKeys: OptionKey[] = useMemo(
    () =>
      parseBoardOptionKeys(question.correct_options, question.correct_option),
    [question.correct_options, question.correct_option],
  );

  const isMultiple =
    Boolean(question.allow_multiple) || validCorrectKeys.length > 1;

  const { initialTokens, initialObstacles } = useMemo(
    () => generateShiftLayout(question.obstacles),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [question.id],
  );

  const [playerPos, setPlayerPos] = useState<Coord>(START_POS);
  const playerPosRef = useRef<Coord>(START_POS);

  const [tokens, setTokens] = useState<Record<OptionKey, Coord>>(initialTokens);
  const tokensRef = useRef<Record<OptionKey, Coord>>(initialTokens);

  const [obstaclesList, setObstaclesList] =
    useState<ObstacleNode[]>(initialObstacles);
  const obstaclesRef = useRef<ObstacleNode[]>(initialObstacles);

  const [movesUsed, setMovesUsed] = useState<number>(0);
  const movesUsedRef = useRef<number>(0);

  const [selectedOptions, setSelectedOptions] = useState<OptionKey[]>([]);
  const selectedOptionsRef = useRef<OptionKey[]>([]);

  const [boardLocked, setBoardLocked] = useState<boolean>(false);
  const [hasWrongResult, setHasWrongResult] = useState<boolean>(false);
  const [hoveredAxis, setHoveredAxis] = useState<HoveredAxis>(null);

  useEffect(() => {
    setPlayerPos(START_POS);
    playerPosRef.current = START_POS;
    setTokens(initialTokens);
    tokensRef.current = initialTokens;
    setObstaclesList(initialObstacles);
    obstaclesRef.current = initialObstacles;
    setMovesUsed(0);
    movesUsedRef.current = 0;
    setSelectedOptions([]);
    selectedOptionsRef.current = [];
    setBoardLocked(false);
    setHasWrongResult(false);
    setHoveredAxis(null);
  }, [question.id, initialTokens, initialObstacles]);

  const isInteractionDisabled = disabled || boardLocked;

  const obstacleSet = useMemo(() => {
    const set = new Set<string>();
    obstaclesList.forEach((o) => set.add(coordKey(o.r, o.c)));
    return set;
  }, [obstaclesList]);

  const validNeighbors = useMemo(() => {
    const set = new Set<string>();
    if (isInteractionDisabled) return set;

    for (const [dr, dc] of ORTHO_DIRS) {
      const nr = playerPos.r + dr;
      const nc = playerPos.c + dc;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
      const k = coordKey(nr, nc);
      if (!obstacleSet.has(k)) {
        set.add(k);
      }
    }
    return set;
  }, [playerPos, obstacleSet, isInteractionDisabled]);

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

  const evaluateLandingOnOption = useCallback(
    (
      posToCheck: Coord,
      currentTokens: Record<OptionKey, Coord>,
      nextMoveCount: number,
    ): boolean => {
      const currSelected = selectedOptionsRef.current;
      const hitOption = (["A", "B", "C", "D"] as OptionKey[]).find((opt) => {
        if (eliminatedOptions.includes(opt)) return false;
        if (currSelected.includes(opt)) return false;
        const tPos = currentTokens[opt];
        return tPos && tPos.r === posToCheck.r && tPos.c === posToCheck.c;
      });

      if (!hitOption) return false;

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
        onAnswer(hitOption, isCorrect, nextMoveCount);
        return true;
      }

      // Mode Multiple Answers: biarkan lanjut meski pilihan pertama salah
      const nextSelected = [...currSelected, hitOption];
      selectedOptionsRef.current = nextSelected;
      setSelectedOptions(nextSelected);

      if (nextSelected.length >= validCorrectKeys.length) {
        finalizeMultipleSelection(nextSelected, nextMoveCount);
      } else {
        sound.playPowerUp();
      }
      return true;
    },
    [
      eliminatedOptions,
      isMultiple,
      validCorrectKeys,
      onAnswer,
      finalizeMultipleSelection,
    ],
  );

  // Geser 1 baris secara memutar (delta = -1 ke kiri, +1 ke kanan)
  const handleShiftRow = useCallback(
    (rowIndex: number, delta: -1 | 1) => {
      if (isInteractionDisabled) return;

      const nextMoves = movesUsedRef.current + 1;
      movesUsedRef.current = nextMoves;
      setMovesUsed(nextMoves);

      const currPlayer = playerPosRef.current;
      const nextPlayerPos: Coord =
        currPlayer.r === rowIndex
          ? { r: currPlayer.r, c: wrapIndex(currPlayer.c + delta) }
          : currPlayer;

      const currTokens = tokensRef.current;
      const nextTokens = { ...currTokens };
      (["A", "B", "C", "D"] as OptionKey[]).forEach((opt) => {
        if (nextTokens[opt].r === rowIndex) {
          nextTokens[opt] = {
            r: rowIndex,
            c: wrapIndex(nextTokens[opt].c + delta),
          };
        }
      });

      const nextObstacles = obstaclesRef.current.map((obs) =>
        obs.r === rowIndex ? { ...obs, c: wrapIndex(obs.c + delta) } : obs,
      );

      playerPosRef.current = nextPlayerPos;
      setPlayerPos(nextPlayerPos);
      tokensRef.current = nextTokens;
      setTokens(nextTokens);
      obstaclesRef.current = nextObstacles;
      setObstaclesList(nextObstacles);

      const hitSomething = evaluateLandingOnOption(
        nextPlayerPos,
        nextTokens,
        nextMoves,
      );
      if (!hitSomething) {
        sound.playMove();
      }
    },
    [isInteractionDisabled, evaluateLandingOnOption],
  );

  // Geser 1 kolom secara memutar (delta = -1 ke atas, +1 ke bawah)
  const handleShiftCol = useCallback(
    (colIndex: number, delta: -1 | 1) => {
      if (isInteractionDisabled) return;

      const nextMoves = movesUsedRef.current + 1;
      movesUsedRef.current = nextMoves;
      setMovesUsed(nextMoves);

      const currPlayer = playerPosRef.current;
      const nextPlayerPos: Coord =
        currPlayer.c === colIndex
          ? { r: wrapIndex(currPlayer.r + delta), c: currPlayer.c }
          : currPlayer;

      const currTokens = tokensRef.current;
      const nextTokens = { ...currTokens };
      (["A", "B", "C", "D"] as OptionKey[]).forEach((opt) => {
        if (nextTokens[opt].c === colIndex) {
          nextTokens[opt] = {
            r: wrapIndex(nextTokens[opt].r + delta),
            c: colIndex,
          };
        }
      });

      const nextObstacles = obstaclesRef.current.map((obs) =>
        obs.c === colIndex ? { ...obs, r: wrapIndex(obs.r + delta) } : obs,
      );

      playerPosRef.current = nextPlayerPos;
      setPlayerPos(nextPlayerPos);
      tokensRef.current = nextTokens;
      setTokens(nextTokens);
      obstaclesRef.current = nextObstacles;
      setObstaclesList(nextObstacles);

      const hitSomething = evaluateLandingOnOption(
        nextPlayerPos,
        nextTokens,
        nextMoves,
      );
      if (!hitSomething) {
        sound.playMove();
      }
    },
    [isInteractionDisabled, evaluateLandingOnOption],
  );

  // Langkah pemain 1 petak ke tetangga ortogonal
  const handleStepTo = useCallback(
    (r: number, c: number) => {
      if (isInteractionDisabled) return;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return;

      const currPos = playerPosRef.current;
      const dist = Math.abs(r - currPos.r) + Math.abs(c - currPos.c);
      if (dist !== 1) return;

      const targetKey = coordKey(r, c);
      const isBlocked = obstaclesRef.current.some(
        (o) => coordKey(o.r, o.c) === targetKey,
      );
      if (isBlocked) return;

      const nextMoves = movesUsedRef.current + 1;
      movesUsedRef.current = nextMoves;
      setMovesUsed(nextMoves);

      const nextPos = { r, c };
      playerPosRef.current = nextPos;
      setPlayerPos(nextPos);

      const hitSomething = evaluateLandingOnOption(
        nextPos,
        tokensRef.current,
        nextMoves,
      );
      if (!hitSomething) {
        sound.playMove();
      }
    },
    [isInteractionDisabled, evaluateLandingOnOption],
  );

  // Dukungan kontrol keyboard (Arrow Keys & WASD untuk melangkah)
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

  const handleResetMatrix = () => {
    if (isInteractionDisabled || movesUsedRef.current === 0) return;
    sound.playMove();
    playerPosRef.current = START_POS;
    setPlayerPos(START_POS);
    tokensRef.current = initialTokens;
    setTokens(initialTokens);
    obstaclesRef.current = initialObstacles;
    setObstaclesList(initialObstacles);
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
      {/* Quantum Matrix HUD Header */}
      <div className="flex items-start sm:items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-slate-900 via-[#0E292D] to-slate-900 border border-teal-500/40 text-white shadow-sm">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
          <div className="relative w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/45 flex items-center justify-center text-teal-300 shrink-0 mt-0.5 sm:mt-0">
            <Compass className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="font-black text-xs sm:text-sm text-white tracking-tight">
                TactiShift
              </p>
              <span className="px-1.5 py-0.5 rounded-md bg-teal-500/20 text-teal-200 text-[9px] font-black uppercase tracking-wider">
                Matrix Shift
              </span>
            </div>
            <p className="text-[11px] font-medium text-teal-100/85 leading-snug mt-0.5">
              {lang === "EN"
                ? "Step onto green tiles or push edge arrows to wrap rows & columns!"
                : "Langkahkan bidak atau tekan panah tepi untuk menggeser baris & kolom!"}
            </p>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-xl bg-white/10 border border-white/15 text-[11px] font-black text-teal-100 shrink-0">
          {lang === "EN" ? `Actions: ${movesUsed}` : `Aksi: ${movesUsed}`}
        </span>
      </div>

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

      {/* Bingkai Kontrol Matrix 8x8 + Papan Utama 6x6 60fps */}
      <motion.div
        animate={hasWrongResult ? { x: [0, -7, 7, -5, 5, 0] } : { x: 0 }}
        transition={{ duration: 0.35 }}
        onMouseLeave={() => setHoveredAxis(null)}
        className={`relative aspect-square w-full max-w-[395px] mx-auto p-1.5 rounded-2xl bg-[#070D19] border-4 shadow-xl select-none transition-colors ${
          hasWrongResult ? "border-rose-500" : "border-slate-900"
        }`}
      >
        {/* Grid Tombol Tepi 8x8 */}
        <div className="w-full h-full grid grid-cols-8 grid-rows-8 gap-1">
          {Array.from({ length: 8 }).map((_, gridR) =>
            Array.from({ length: 8 }).map((__, gridC) => {
              const isTopEdge = gridR === 0;
              const isBottomEdge = gridR === 7;
              const isLeftEdge = gridC === 0;
              const isRightEdge = gridC === 7;

              // 1. Empat sudut dekoratif
              if ((isTopEdge || isBottomEdge) && (isLeftEdge || isRightEdge)) {
                return (
                  <div
                    key={`corner-${gridR}-${gridC}`}
                    className="rounded-lg bg-slate-900/70 border border-slate-800/60 flex items-center justify-center"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500/40" />
                  </div>
                );
              }

              // 2. Tombol Geser Kolom ke Atas (Baris 0, Kolom 1..6)
              if (isTopEdge) {
                const colIdx = gridC - 1;
                const isAxisActive =
                  hoveredAxis?.type === "COL" && hoveredAxis.index === colIdx;
                return (
                  <button
                    key={`shift-up-${colIdx}`}
                    type="button"
                    disabled={isInteractionDisabled}
                    onMouseEnter={() =>
                      setHoveredAxis({ type: "COL", index: colIdx })
                    }
                    onClick={() => handleShiftCol(colIdx, -1)}
                    title={
                      lang === "EN"
                        ? `Shift column ${colIdx + 1} up`
                        : `Geser kolom ${colIdx + 1} ke atas`
                    }
                    className={`rounded-lg border flex items-center justify-center transition cursor-pointer disabled:cursor-default disabled:opacity-35 active:scale-90 ${
                      isAxisActive && !isInteractionDisabled
                        ? "bg-teal-500 border-teal-300 text-slate-950 shadow-[0_0_12px_rgba(20,184,166,0.6)]"
                        : "bg-slate-800/90 hover:bg-teal-600 border-slate-700 text-teal-300 hover:text-white"
                    }`}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                );
              }

              // 3. Tombol Geser Kolom ke Bawah (Baris 7, Kolom 1..6)
              if (isBottomEdge) {
                const colIdx = gridC - 1;
                const isAxisActive =
                  hoveredAxis?.type === "COL" && hoveredAxis.index === colIdx;
                return (
                  <button
                    key={`shift-down-${colIdx}`}
                    type="button"
                    disabled={isInteractionDisabled}
                    onMouseEnter={() =>
                      setHoveredAxis({ type: "COL", index: colIdx })
                    }
                    onClick={() => handleShiftCol(colIdx, 1)}
                    title={
                      lang === "EN"
                        ? `Shift column ${colIdx + 1} down`
                        : `Geser kolom ${colIdx + 1} ke bawah`
                    }
                    className={`rounded-lg border flex items-center justify-center transition cursor-pointer disabled:cursor-default disabled:opacity-35 active:scale-90 ${
                      isAxisActive && !isInteractionDisabled
                        ? "bg-teal-500 border-teal-300 text-slate-950 shadow-[0_0_12px_rgba(20,184,166,0.6)]"
                        : "bg-slate-800/90 hover:bg-teal-600 border-slate-700 text-teal-300 hover:text-white"
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                );
              }

              // 4. Tombol Geser Baris ke Kiri (Kolom 0, Baris 1..6)
              if (isLeftEdge) {
                const rowIdx = gridR - 1;
                const isAxisActive =
                  hoveredAxis?.type === "ROW" && hoveredAxis.index === rowIdx;
                return (
                  <button
                    key={`shift-left-${rowIdx}`}
                    type="button"
                    disabled={isInteractionDisabled}
                    onMouseEnter={() =>
                      setHoveredAxis({ type: "ROW", index: rowIdx })
                    }
                    onClick={() => handleShiftRow(rowIdx, -1)}
                    title={
                      lang === "EN"
                        ? `Shift row ${rowIdx + 1} left`
                        : `Geser baris ${rowIdx + 1} ke kiri`
                    }
                    className={`rounded-lg border flex items-center justify-center transition cursor-pointer disabled:cursor-default disabled:opacity-35 active:scale-90 ${
                      isAxisActive && !isInteractionDisabled
                        ? "bg-teal-500 border-teal-300 text-slate-950 shadow-[0_0_12px_rgba(20,184,166,0.6)]"
                        : "bg-slate-800/90 hover:bg-teal-600 border-slate-700 text-teal-300 hover:text-white"
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                );
              }

              // 5. Tombol Geser Baris ke Kanan (Kolom 7, Baris 1..6)
              if (isRightEdge) {
                const rowIdx = gridR - 1;
                const isAxisActive =
                  hoveredAxis?.type === "ROW" && hoveredAxis.index === rowIdx;
                return (
                  <button
                    key={`shift-right-${rowIdx}`}
                    type="button"
                    disabled={isInteractionDisabled}
                    onMouseEnter={() =>
                      setHoveredAxis({ type: "ROW", index: rowIdx })
                    }
                    onClick={() => handleShiftRow(rowIdx, 1)}
                    title={
                      lang === "EN"
                        ? `Shift row ${rowIdx + 1} right`
                        : `Geser baris ${rowIdx + 1} ke kanan`
                    }
                    className={`rounded-lg border flex items-center justify-center transition cursor-pointer disabled:cursor-default disabled:opacity-35 active:scale-90 ${
                      isAxisActive && !isInteractionDisabled
                        ? "bg-teal-500 border-teal-300 text-slate-950 shadow-[0_0_12px_rgba(20,184,166,0.6)]"
                        : "bg-slate-800/90 hover:bg-teal-600 border-slate-700 text-teal-300 hover:text-white"
                    }`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                );
              }

              // 6. Petak Papan Inti 6x6
              const r = gridR - 1;
              const c = gridC - 1;
              const key = coordKey(r, c);
              const isDark = (r + c) % 2 === 1;
              const isStartSafe = r === START_POS.r && c === START_POS.c;
              const isNeighbor = validNeighbors.has(key);

              const isAxisHighlighted =
                !isInteractionDisabled &&
                hoveredAxis !== null &&
                ((hoveredAxis.type === "ROW" && hoveredAxis.index === r) ||
                  (hoveredAxis.type === "COL" && hoveredAxis.index === c));

              const tokenHere = (["A", "B", "C", "D"] as OptionKey[]).find(
                (opt) => {
                  const tPos = tokens[opt];
                  return tPos && tPos.r === r && tPos.c === c;
                },
              );
              const showActiveToken =
                tokenHere &&
                !eliminatedOptions.includes(tokenHere) &&
                !selectedOptions.includes(tokenHere);

              let cellBg = isDark ? "bg-[#0C1426]" : "bg-[#111B33]";
              if (isAxisHighlighted) {
                cellBg = "bg-teal-950/85 ring-1 ring-inset ring-teal-400/55";
              } else if (isNeighbor && showActiveToken) {
                cellBg = "bg-amber-950/75 ring-1 ring-inset ring-amber-400/75";
              } else if (isNeighbor && !isInteractionDisabled) {
                cellBg = "bg-emerald-950/70 hover:bg-emerald-900/80";
              }

              return (
                <button
                  key={key}
                  type="button"
                  disabled={!isNeighbor || isInteractionDisabled}
                  onClick={() => handleStepTo(r, c)}
                  className={`relative rounded-lg border border-slate-800/75 flex items-center justify-center transition-colors duration-150 ${cellBg} ${
                    isNeighbor && !isInteractionDisabled
                      ? "cursor-pointer"
                      : "cursor-default"
                  }`}
                >
                  {/* Penanda Zona Spawn */}
                  {isStartSafe &&
                    !(playerPos.r === r && playerPos.c === c) &&
                    !obstacleSet.has(key) &&
                    !tokenHere && (
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-500/55 pointer-events-none" />
                    )}

                  {/* Titik Hijau Langkah Valid */}
                  {isNeighbor &&
                    !showActiveToken &&
                    !(playerPos.r === r && playerPos.c === c) && (
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/85 ring-4 ring-emerald-400/20 pointer-events-none" />
                    )}
                </button>
              );
            }),
          )}
        </div>

        {/* Layer Overlay 60fps untuk Papan Inti 6x6 (Mengikuti area dalam grid 8x8) */}
        <div
          style={{
            left: "calc(12.5% + 0.1875rem)",
            top: "calc(12.5% + 0.1875rem)",
            width: "calc(75% - 0.375rem)",
            height: "calc(75% - 0.375rem)",
          }}
          className="absolute pointer-events-none z-10"
        >
          {/* 1. Rintangan Batu Bergerak */}
          {obstaclesList.map((obs) => (
            <motion.div
              key={obs.id}
              initial={false}
              animate={{
                left: `${(obs.c / BOARD_SIZE) * 100}%`,
                top: `${(obs.r / BOARD_SIZE) * 100}%`,
              }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              style={{
                width: `${100 / BOARD_SIZE}%`,
                height: `${100 / BOARD_SIZE}%`,
              }}
              className="absolute p-0.5 flex items-center justify-center"
            >
              <div className="w-full h-full rounded-lg bg-gradient-to-b from-slate-700 to-slate-800 border border-slate-500/60 shadow-inner flex items-center justify-center">
                <span className="text-sm sm:text-base drop-shadow-xs">🧱</span>
              </div>
            </motion.div>
          ))}

          {/* 2. Token Pilihan Jawaban (A, B, C, D) */}
          {(["A", "B", "C", "D"] as OptionKey[]).map((opt) => {
            if (eliminatedOptions.includes(opt)) return null;
            const tPos = tokens[opt];
            if (!tPos) return null;

            const isAlreadySelected = selectedOptions.includes(opt);
            const isNeighborCell = validNeighbors.has(coordKey(tPos.r, tPos.c));

            return (
              <motion.div
                key={`shift-token-${opt}`}
                initial={false}
                animate={{
                  left: `${(tPos.c / BOARD_SIZE) * 100}%`,
                  top: `${(tPos.r / BOARD_SIZE) * 100}%`,
                }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                style={{
                  width: `${100 / BOARD_SIZE}%`,
                  height: `${100 / BOARD_SIZE}%`,
                }}
                className="absolute p-0.5 flex items-center justify-center z-10"
              >
                {isAlreadySelected ? (
                  <span
                    className={`w-7 h-7 rounded-lg border-2 font-black text-[11px] flex items-center justify-center ${
                      !boardLocked
                        ? "bg-indigo-500/35 border-indigo-400 text-indigo-100"
                        : validCorrectKeys.includes(opt)
                          ? "bg-emerald-500/35 border-emerald-400 text-emerald-200"
                          : "bg-rose-500/40 border-rose-400 text-rose-200"
                    }`}
                  >
                    {!boardLocked
                      ? `●${opt}`
                      : validCorrectKeys.includes(opt)
                        ? `✓${opt}`
                        : `✗${opt}`}
                  </span>
                ) : (
                  <div className="relative flex items-center justify-center">
                    {isNeighborCell && !isInteractionDisabled && (
                      <span className="absolute -inset-1 rounded-lg border-2 border-amber-300/85 animate-ping" />
                    )}
                    <span
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${OPTION_STYLES[opt].badgeBg} text-white font-black text-xs sm:text-sm flex items-center justify-center shadow-md border-b-2 border-black/30`}
                    >
                      {opt}
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}

          {/* 3. Karakter Navigator Pemain */}
          <motion.div
            initial={false}
            animate={{
              left: `${(playerPos.c / BOARD_SIZE) * 100}%`,
              top: `${(playerPos.r / BOARD_SIZE) * 100}%`,
            }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            style={{
              width: `${100 / BOARD_SIZE}%`,
              height: `${100 / BOARD_SIZE}%`,
            }}
            className="absolute p-0.5 flex items-center justify-center z-20"
          >
            <div className="w-full h-full rounded-lg bg-gradient-to-br from-teal-400 via-teal-600 to-emerald-700 text-white flex items-center justify-center text-lg sm:text-xl shadow-[0_0_16px_rgba(20,184,166,0.65)] border-b-2 border-teal-950 ring-2 ring-white/80">
              🧭
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Bar Kontrol D-Pad Taktis & Reset Susunan */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1">
          <button
            type="button"
            disabled={!canStepDir(0, -1)}
            onClick={() => handleStepTo(playerPos.r, playerPos.c - 1)}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-teal-100 active:scale-95 disabled:opacity-35 text-slate-700 font-black flex items-center justify-center border-b-2 border-slate-300 transition cursor-pointer disabled:cursor-default"
            title="Move Left"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canStepDir(-1, 0)}
            onClick={() => handleStepTo(playerPos.r - 1, playerPos.c)}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-teal-100 active:scale-95 disabled:opacity-35 text-slate-700 font-black flex items-center justify-center border-b-2 border-slate-300 transition cursor-pointer disabled:cursor-default"
            title="Move Up"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canStepDir(1, 0)}
            onClick={() => handleStepTo(playerPos.r + 1, playerPos.c)}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-teal-100 active:scale-95 disabled:opacity-35 text-slate-700 font-black flex items-center justify-center border-b-2 border-slate-300 transition cursor-pointer disabled:cursor-default"
            title="Move Down"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canStepDir(0, 1)}
            onClick={() => handleStepTo(playerPos.r, playerPos.c + 1)}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-teal-100 active:scale-95 disabled:opacity-35 text-slate-700 font-black flex items-center justify-center border-b-2 border-slate-300 transition cursor-pointer disabled:cursor-default"
            title="Move Right"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          disabled={isInteractionDisabled || movesUsed === 0}
          onClick={handleResetMatrix}
          title={
            lang === "EN"
              ? "Reset board positions to start"
              : "Reset susunan papan ke posisi awal"
          }
          className="px-3.5 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 disabled:opacity-40 text-amber-800 border border-amber-200 border-b-2 font-black text-xs inline-flex items-center gap-1 transition cursor-pointer disabled:cursor-default shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{lang === "EN" ? "Reset" : "Awal"}</span>
        </button>
      </div>
    </div>
  );
}
