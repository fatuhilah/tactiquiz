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
  Lock,
  Unlock,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  ShieldCheck,
} from "lucide-react";
import {
  OptionKey,
  OPTION_STYLES,
  QuestionData,
} from "@/components/ChessQuizBoard";
import { useLanguage } from "@/components/LanguageProvider";
import { sound } from "@/lib/sound";

export type GateColor = "RED" | "BLUE";

interface Coord {
  r: number;
  c: number;
}

interface TactiSwitchBoardProps {
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
const INITIAL_OPEN_COLOR: GateColor = "RED";

const ORTHO_DIRS: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

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

function canReachSwitchTarget(
  origin: Coord,
  startColor: GateColor,
  targetCoord: Coord,
  otherTokenCoords: Set<string>,
  obstacles: Set<string>,
  gates: Map<string, GateColor>,
  switches: Map<string, GateColor>,
): boolean {
  const targetKey = coordKey(targetCoord.r, targetCoord.c);
  const startKey = coordKey(origin.r, origin.c);

  if (obstacles.has(startKey) || obstacles.has(targetKey)) return false;

  const visited = new Set<string>([`${origin.r},${origin.c},${startColor}`]);
  const queue: { r: number; c: number; color: GateColor }[] = [
    { r: origin.r, c: origin.c, color: startColor },
  ];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr.r === targetCoord.r && curr.c === targetCoord.c) {
      return true;
    }

    for (const [dr, dc] of ORTHO_DIRS) {
      const nr = curr.r + dr;
      const nc = curr.c + dc;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;

      const nk = coordKey(nr, nc);
      if (obstacles.has(nk) || otherTokenCoords.has(nk)) continue;

      // Cek apakah terhalang gerbang yang sedang terkunci
      const gateHere = gates.get(nk);
      if (gateHere && gateHere !== curr.color) continue;

      // Jika menginjak saklar, warna gerbang aktif berubah
      const switchHere = switches.get(nk);
      const nextColor = switchHere ?? curr.color;

      const stateSig = `${nr},${nc},${nextColor}`;
      if (!visited.has(stateSig)) {
        visited.add(stateSig);
        queue.push({ r: nr, c: nc, color: nextColor });
      }
    }
  }

  return false;
}

function isSwitchLayoutPlayable(
  tokens: Record<OptionKey, Coord>,
  obstacles: Set<string>,
  gates: Map<string, GateColor>,
  switches: Map<string, GateColor>,
): boolean {
  const keys: OptionKey[] = ["A", "B", "C", "D"];

  // 1. Pastikan keempat opsi bisa dicapai dari titik awal
  for (const targetOpt of keys) {
    const others = new Set<string>();
    keys.forEach((k) => {
      if (k !== targetOpt) {
        others.add(coordKey(tokens[k].r, tokens[k].c));
      }
    });
    if (
      !canReachSwitchTarget(
        START_POS,
        INITIAL_OPEN_COLOR,
        tokens[targetOpt],
        others,
        obstacles,
        gates,
        switches,
      )
    ) {
      return false;
    }
  }

  // 2. Pastikan antar opsi saling terhubung pada kedua kondisi warna gerbang (untuk Multiple Answers)
  for (const fromOpt of keys) {
    for (const toOpt of keys) {
      if (fromOpt === toOpt) continue;
      const others = new Set<string>();
      keys.forEach((k) => {
        if (k !== fromOpt && k !== toOpt) {
          others.add(coordKey(tokens[k].r, tokens[k].c));
        }
      });

      const okFromRed = canReachSwitchTarget(
        tokens[fromOpt],
        "RED",
        tokens[toOpt],
        others,
        obstacles,
        gates,
        switches,
      );
      const okFromBlue = canReachSwitchTarget(
        tokens[fromOpt],
        "BLUE",
        tokens[toOpt],
        others,
        obstacles,
        gates,
        switches,
      );

      if (!okFromRed || !okFromBlue) return false;
    }
  }

  return true;
}

function generateSwitchLayout(obstacleCount: number): {
  tokens: Record<OptionKey, Coord>;
  obstacles: Set<string>;
  gates: Map<string, GateColor>;
  switches: Map<string, GateColor>;
} {
  const optionKeys: OptionKey[] = ["A", "B", "C", "D"];
  const clampedObstacles = Math.max(2, Math.min(4, obstacleCount || 3));
  const startKey = coordKey(START_POS.r, START_POS.c);

  for (let attempt = 0; attempt < 160; attempt++) {
    const occupied = new Set<string>([startKey]);
    const allCells: Coord[] = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (coordKey(r, c) === startKey) continue;
        allCells.push({ r, c });
      }
    }

    const shuffled = [...allCells].sort(() => Math.random() - 0.5);

    // 1. Tempatkan 4 opsi jawaban (hindari petak tepat di sebelah start)
    const tokenCandidates = shuffled.filter(
      (cell) =>
        Math.abs(cell.r - START_POS.r) + Math.abs(cell.c - START_POS.c) > 1,
    );
    if (tokenCandidates.length < 4) continue;

    const tokens = {} as Record<OptionKey, Coord>;
    optionKeys.forEach((opt, idx) => {
      tokens[opt] = tokenCandidates[idx];
      occupied.add(coordKey(tokenCandidates[idx].r, tokenCandidates[idx].c));
    });

    // 2. Tempatkan 2 Saklar Merah & 2 Saklar Biru
    const switchCandidates = shuffled.filter(
      (cell) => !occupied.has(coordKey(cell.r, cell.c)),
    );
    if (switchCandidates.length < 4) continue;

    const switches = new Map<string, GateColor>();
    (["RED", "BLUE", "RED", "BLUE"] as GateColor[]).forEach((color, idx) => {
      const cell = switchCandidates[idx];
      const k = coordKey(cell.r, cell.c);
      switches.set(k, color);
      occupied.add(k);
    });

    // 3. Tempatkan 4 Gerbang Energi (2 Biru, 2 Merah)
    const gateCandidates = shuffled.filter((cell) => {
      const k = coordKey(cell.r, cell.c);
      if (occupied.has(k)) return false;
      if (Math.abs(cell.r - START_POS.r) + Math.abs(cell.c - START_POS.c) <= 1)
        return false;
      return true;
    });
    if (gateCandidates.length < 4) continue;

    const gates = new Map<string, GateColor>();
    (["BLUE", "BLUE", "RED", "RED"] as GateColor[]).forEach((color, idx) => {
      const cell = gateCandidates[idx];
      const k = coordKey(cell.r, cell.c);
      gates.set(k, color);
      occupied.add(k);
    });

    // 4. Tempatkan tembok bata yang lolos uji state-space BFS
    const obsCandidates = shuffled.filter((cell) => {
      const k = coordKey(cell.r, cell.c);
      if (occupied.has(k)) return false;
      if (Math.abs(cell.r - START_POS.r) + Math.abs(cell.c - START_POS.c) <= 1)
        return false;
      return true;
    });

    const obstacles = new Set<string>();
    for (const cand of obsCandidates) {
      if (obstacles.size >= clampedObstacles) break;
      const k = coordKey(cand.r, cand.c);
      obstacles.add(k);
      if (!isSwitchLayoutPlayable(tokens, obstacles, gates, switches)) {
        obstacles.delete(k);
      }
    }

    if (isSwitchLayoutPlayable(tokens, obstacles, gates, switches)) {
      return { tokens, obstacles, gates, switches };
    }
  }

  // Fallback terverifikasi 100% bebas buntu
  return {
    tokens: {
      A: { r: 0, c: 0 },
      B: { r: 0, c: 5 },
      C: { r: 4, c: 5 },
      D: { r: 3, c: 1 },
    },
    obstacles: new Set<string>(["2,0", "0,2", "0,3", "2,5", "3,3", "5,3"]),
    gates: new Map<string, GateColor>([
      ["2,1", "BLUE"],
      ["2,4", "RED"],
      ["4,3", "BLUE"],
    ]),
    switches: new Map<string, GateColor>([
      ["4,1", "BLUE"],
      ["1,3", "BLUE"],
      ["2,2", "RED"],
      ["5,2", "RED"],
    ]),
  };
}

export default function TactiSwitchBoard({
  question,
  eliminatedOptions = [],
  disabled = false,
  onAnswer,
}: TactiSwitchBoardProps) {
  const { lang } = useLanguage();

  const validCorrectKeys: OptionKey[] = useMemo(
    () =>
      parseBoardOptionKeys(question.correct_options, question.correct_option),
    [question.correct_options, question.correct_option],
  );

  const isMultiple =
    Boolean(question.allow_multiple) || validCorrectKeys.length > 1;

  const { tokens, obstacles, gates, switches } = useMemo(
    () => generateSwitchLayout(question.obstacles),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [question.id],
  );

  const [playerPos, setPlayerPos] = useState<Coord>(START_POS);
  const playerPosRef = useRef<Coord>(START_POS);
  const [openColor, setOpenColor] = useState<GateColor>(INITIAL_OPEN_COLOR);
  const openColorRef = useRef<GateColor>(INITIAL_OPEN_COLOR);
  const [movesUsed, setMovesUsed] = useState<number>(0);
  const movesUsedRef = useRef<number>(0);
  const [selectedOptions, setSelectedOptions] = useState<OptionKey[]>([]);
  const selectedOptionsRef = useRef<OptionKey[]>([]);
  const [boardLocked, setBoardLocked] = useState<boolean>(false);
  const [hasWrongResult, setHasWrongResult] = useState<boolean>(false);

  useEffect(() => {
    setPlayerPos(START_POS);
    playerPosRef.current = START_POS;
    setOpenColor(INITIAL_OPEN_COLOR);
    openColorRef.current = INITIAL_OPEN_COLOR;
    setMovesUsed(0);
    movesUsedRef.current = 0;
    setSelectedOptions([]);
    selectedOptionsRef.current = [];
    setBoardLocked(false);
    setHasWrongResult(false);
  }, [question.id]);

  const isInteractionDisabled = disabled || boardLocked;

  const validNeighbors = useMemo(() => {
    const set = new Set<string>();
    if (isInteractionDisabled) return set;

    for (const [dr, dc] of ORTHO_DIRS) {
      const nr = playerPos.r + dr;
      const nc = playerPos.c + dc;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;

      const k = coordKey(nr, nc);
      if (obstacles.has(k)) continue;

      const gateHere = gates.get(k);
      if (gateHere && gateHere !== openColor) continue;

      set.add(k);
    }
    return set;
  }, [playerPos, obstacles, gates, openColor, isInteractionDisabled]);

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
      if (obstacles.has(targetKey)) return;

      const currColor = openColorRef.current;
      const gateHere = gates.get(targetKey);
      if (gateHere && gateHere !== currColor) return;

      const nextMoves = movesUsedRef.current + 1;
      movesUsedRef.current = nextMoves;
      setMovesUsed(nextMoves);

      const nextPos = { r, c };
      playerPosRef.current = nextPos;
      setPlayerPos(nextPos);

      // Cek apakah menginjak saklar lantai
      const switchHere = switches.get(targetKey);
      if (switchHere && switchHere !== currColor) {
        openColorRef.current = switchHere;
        setOpenColor(switchHere);
        sound.playPowerUp();
      }

      // Cek apakah menginjak opsi jawaban aktif
      const currSelected = selectedOptionsRef.current;
      const hitOption = (["A", "B", "C", "D"] as OptionKey[]).find((opt) => {
        if (eliminatedOptions.includes(opt)) return false;
        if (currSelected.includes(opt)) return false;
        const tPos = tokens[opt];
        return tPos && tPos.r === r && tPos.c === c;
      });

      if (!hitOption) {
        if (!switchHere || switchHere === currColor) {
          sound.playMove();
        }
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
      gates,
      switches,
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

  const handleResetPosition = () => {
    if (isInteractionDisabled) return;
    const curr = playerPosRef.current;
    if (
      curr.r === START_POS.r &&
      curr.c === START_POS.c &&
      openColorRef.current === INITIAL_OPEN_COLOR
    ) {
      return;
    }
    sound.playMove();
    playerPosRef.current = START_POS;
    setPlayerPos(START_POS);
    openColorRef.current = INITIAL_OPEN_COLOR;
    setOpenColor(INITIAL_OPEN_COLOR);
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
      {/* Quantum Gate HUD Header */}
      <div
        className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r border text-white shadow-sm transition-colors duration-300 ${
          openColor === "RED"
            ? "from-slate-900 via-[#2B101A] to-slate-900 border-rose-500/40"
            : "from-slate-900 via-[#0D213A] to-slate-900 border-sky-500/40"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`relative w-10 h-10 rounded-xl border flex items-center justify-center text-xl shrink-0 transition-colors ${
              openColor === "RED"
                ? "bg-rose-500/20 border-rose-400/50"
                : "bg-sky-500/20 border-sky-400/50"
            }`}
          >
            <span>🎛️</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-black text-xs sm:text-sm text-white tracking-tight truncate">
                TactiSwitch
              </p>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                  openColor === "RED"
                    ? "bg-rose-500/25 text-rose-200"
                    : "bg-sky-500/25 text-sky-200"
                }`}
              >
                Gate Sync
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-300 truncate">
              {lang === "EN"
                ? "Step on 🔴 or 🔵 pads to toggle matching color gates"
                : "Injak saklar 🔴 atau 🔵 untuk membuka gerbang warna senama"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`px-2.5 py-1 rounded-xl text-white text-[11px] font-black inline-flex items-center gap-1 shadow-xs transition-colors ${
              openColor === "RED" ? "bg-rose-600" : "bg-sky-600"
            }`}
          >
            <Unlock className="w-3 h-3" />
            <span>
              {openColor === "RED"
                ? lang === "EN"
                  ? "RED"
                  : "MERAH"
                : lang === "EN"
                  ? "BLUE"
                  : "BIRU"}
            </span>
          </span>
          <span className="px-2 py-1 rounded-xl bg-white/10 border border-white/15 text-[11px] font-black text-slate-200">
            {movesUsed}
          </span>
        </div>
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

      {/* Arena Quantum Gate 6x6 dengan 60fps Smooth Glide Overlay */}
      <motion.div
        animate={hasWrongResult ? { x: [0, -7, 7, -5, 5, 0] } : { x: 0 }}
        transition={{ duration: 0.35 }}
        className={`relative aspect-square w-full max-w-[385px] mx-auto rounded-2xl overflow-hidden border-4 shadow-xl bg-[#090E1A] select-none transition-colors ${
          hasWrongResult
            ? "border-rose-500"
            : openColor === "RED"
              ? "border-rose-950"
              : "border-sky-950"
        }`}
      >
        {/* Grid Sel 6x6 */}
        <div className="w-full h-full grid grid-cols-6 grid-rows-6">
          {Array.from({ length: BOARD_SIZE }).map((_, r) =>
            Array.from({ length: BOARD_SIZE }).map((__, c) => {
              const key = coordKey(r, c);
              const isDark = (r + c) % 2 === 1;
              const isStartSafe = r === START_POS.r && c === START_POS.c;
              const isObstacle = obstacles.has(key);
              const gateHere = gates.get(key);
              const switchHere = switches.get(key);
              const isNeighbor = validNeighbors.has(key);

              const isGateClosed = Boolean(gateHere && gateHere !== openColor);
              const isGateOpen = Boolean(gateHere && gateHere === openColor);

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

              let cellBg = isDark ? "bg-[#0D1426]" : "bg-[#121B33]";
              if (isStartSafe) {
                cellBg = "bg-slate-800/85 ring-1 ring-inset ring-slate-600/50";
              } else if (isGateClosed) {
                cellBg =
                  gateHere === "RED"
                    ? "bg-gradient-to-br from-rose-600 to-red-800 ring-2 ring-inset ring-rose-400"
                    : "bg-gradient-to-br from-sky-600 to-blue-800 ring-2 ring-inset ring-sky-400";
              } else if (isGateOpen) {
                cellBg =
                  gateHere === "RED"
                    ? "bg-rose-950/55 ring-1 ring-inset ring-dashed ring-rose-500/60"
                    : "bg-sky-950/60 ring-1 ring-inset ring-dashed ring-sky-500/60";
              } else if (isNeighbor && !isInteractionDisabled) {
                cellBg = "bg-emerald-950/65 hover:bg-emerald-900/75";
              }

              return (
                <button
                  key={key}
                  type="button"
                  disabled={!isNeighbor || isInteractionDisabled}
                  onClick={() => handleStepTo(r, c)}
                  className={`relative flex items-center justify-center border border-slate-800/70 transition-colors duration-200 ${cellBg} ${
                    isNeighbor && !isInteractionDisabled
                      ? "cursor-pointer"
                      : isGateClosed
                        ? "cursor-not-allowed"
                        : "cursor-default"
                  }`}
                >
                  {/* Penanda Zona Spawn */}
                  {isStartSafe && !(playerPos.r === r && playerPos.c === c) && (
                    <div className="flex flex-col items-center justify-center opacity-55 pointer-events-none">
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[7px] font-black text-slate-400 tracking-wider mt-0.5">
                        START
                      </span>
                    </div>
                  )}

                  {/* Titik Hijau Langkah Valid */}
                  {isNeighbor &&
                    !showActiveToken &&
                    !switchHere &&
                    !isGateOpen &&
                    !(playerPos.r === r && playerPos.c === c) && (
                      <span className="w-3 h-3 rounded-full bg-emerald-400/80 ring-4 ring-emerald-400/20 pointer-events-none" />
                    )}

                  {/* Tembok Bunker */}
                  {isObstacle && (
                    <div className="w-[82%] h-[82%] rounded-xl bg-gradient-to-b from-slate-700 to-slate-800 border border-slate-500/60 shadow-inner flex items-center justify-center pointer-events-none">
                      <span className="text-base sm:text-lg drop-shadow-xs">
                        🧱
                      </span>
                    </div>
                  )}

                  {/* Gerbang Energi Terkunci vs Terbuka */}
                  {isGateClosed && (
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0.8 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex flex-col items-center justify-center text-white pointer-events-none"
                    >
                      <Lock className="w-4 h-4 drop-shadow-xs" />
                      <span className="text-[8px] font-black uppercase tracking-wider leading-none mt-0.5">
                        {gateHere === "RED" ? "RED" : "BLUE"}
                      </span>
                    </motion.div>
                  )}

                  {isGateOpen && !(playerPos.r === r && playerPos.c === c) && (
                    <div className="flex flex-col items-center justify-center pointer-events-none">
                      <Unlock
                        className={`w-3.5 h-3.5 opacity-70 ${
                          gateHere === "RED" ? "text-rose-400" : "text-sky-400"
                        }`}
                      />
                      {isNeighbor && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-0.5" />
                      )}
                    </div>
                  )}

                  {/* Saklar Lantai Merah / Biru */}
                  {switchHere && (
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all pointer-events-none ${
                        switchHere === "RED"
                          ? "bg-rose-500/20 border-rose-400 shadow-[0_0_14px_rgba(244,63,94,0.45)]"
                          : "bg-sky-500/20 border-sky-400 shadow-[0_0_14px_rgba(14,165,233,0.45)]"
                      } ${switchHere !== openColor ? "animate-pulse scale-105" : "opacity-60"}`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full ${
                          switchHere === "RED"
                            ? "bg-gradient-to-br from-rose-400 to-red-600"
                            : "bg-gradient-to-br from-sky-400 to-blue-600"
                        } ring-2 ring-white/80`}
                      />
                    </div>
                  )}

                  {/* Badge Opsi Sudah Dipilih (Netral saat berlangsung, Hijau/Merah saat selesai) */}
                  {tokenHere && isAlreadySelected && (
                    <span
                      className={`z-10 w-7 h-7 rounded-lg border-2 font-black text-xs flex items-center justify-center pointer-events-none ${
                        !boardLocked
                          ? "bg-indigo-500/30 border-indigo-400 text-indigo-200"
                          : validCorrectKeys.includes(tokenHere)
                            ? "bg-emerald-500/30 border-emerald-400 text-emerald-300"
                            : "bg-rose-500/35 border-rose-400 text-rose-200"
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
                        <span className="absolute -inset-1.5 rounded-xl border-2 border-amber-300/85 animate-ping" />
                      )}
                      <span
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${OPTION_STYLES[tokenHere].badgeBg} text-white font-black text-sm sm:text-base flex items-center justify-center shadow-lg border-b-2 border-black/30`}
                      >
                        {tokenHere}
                      </span>
                    </div>
                  )}
                </button>
              );
            }),
          )}
        </div>

        {/* Layer Karakter Astronot Pemain (60fps GPU-Accelerated Glide) */}
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
          className="absolute z-20 p-1 flex items-center justify-center pointer-events-none"
        >
          <div
            className={`w-full h-full rounded-xl text-white flex items-center justify-center text-2xl sm:text-3xl shadow-lg border-b-4 ring-2 ring-white/80 transition-colors duration-300 ${
              openColor === "RED"
                ? "bg-gradient-to-br from-rose-500 to-red-700 border-rose-950 shadow-[0_0_16px_rgba(244,63,94,0.65)]"
                : "bg-gradient-to-br from-sky-500 to-blue-700 border-sky-950 shadow-[0_0_16px_rgba(14,165,233,0.65)]"
            }`}
          >
            🧑‍🚀
          </div>
        </motion.div>
      </motion.div>

      {/* Bar Kontrol D-Pad Taktis & Reset Posisi */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1">
          <button
            type="button"
            disabled={!canStepDir(0, -1)}
            onClick={() => handleStepTo(playerPos.r, playerPos.c - 1)}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 disabled:opacity-35 text-slate-700 font-black flex items-center justify-center border-b-2 border-slate-300 transition cursor-pointer disabled:cursor-default"
            title="Move Left"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canStepDir(-1, 0)}
            onClick={() => handleStepTo(playerPos.r - 1, playerPos.c)}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 disabled:opacity-35 text-slate-700 font-black flex items-center justify-center border-b-2 border-slate-300 transition cursor-pointer disabled:cursor-default"
            title="Move Up"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canStepDir(1, 0)}
            onClick={() => handleStepTo(playerPos.r + 1, playerPos.c)}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 disabled:opacity-35 text-slate-700 font-black flex items-center justify-center border-b-2 border-slate-300 transition cursor-pointer disabled:cursor-default"
            title="Move Down"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canStepDir(0, 1)}
            onClick={() => handleStepTo(playerPos.r, playerPos.c + 1)}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 disabled:opacity-35 text-slate-700 font-black flex items-center justify-center border-b-2 border-slate-300 transition cursor-pointer disabled:cursor-default"
            title="Move Right"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          disabled={
            isInteractionDisabled ||
            (playerPos.r === START_POS.r &&
              playerPos.c === START_POS.c &&
              openColor === INITIAL_OPEN_COLOR)
          }
          onClick={handleResetPosition}
          title={
            lang === "EN"
              ? "Return to start & reset gates"
              : "Kembali ke awal & reset gerbang"
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
