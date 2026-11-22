"use client";

import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Sparkles,
  Send,
  AlertTriangle,
  Shield,
  Radio,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
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

interface GuardPath {
  id: number;
  cells: Coord[];
}

interface ActiveGuardState {
  id: number;
  pos: Coord;
  dr: number;
  dc: number;
  radarCells: Coord[];
}

interface TactiStealthBoardProps {
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
const PATROL_INTERVAL_MS = 1000;

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

function computeGuardAtTick(
  guard: GuardPath,
  tick: number,
  obstacles: Set<string>,
): ActiveGuardState {
  const L = guard.cells.length;
  if (L <= 1) {
    return {
      id: guard.id,
      pos: guard.cells[0] || { r: 0, c: 0 },
      dr: 0,
      dc: 1,
      radarCells: [],
    };
  }

  const cycleLen = 2 * L - 2;
  const phase = tick % cycleLen;

  let currIdx = 0;
  let nextIdx = 1;

  if (phase < L) {
    currIdx = phase;
    nextIdx = phase + 1 < L ? phase + 1 : phase - 1;
  } else {
    currIdx = cycleLen - phase;
    nextIdx = currIdx - 1 >= 0 ? currIdx - 1 : currIdx + 1;
  }

  const pos = guard.cells[currIdx];
  const nextPos = guard.cells[nextIdx];
  const dr = Math.sign(nextPos.r - pos.r);
  const dc = Math.sign(nextPos.c - pos.c);

  const radarCells: Coord[] = [];
  for (let dist = 1; dist <= 2; dist++) {
    const rr = pos.r + dr * dist;
    const rc = pos.c + dc * dist;
    if (rr < 0 || rr >= BOARD_SIZE || rc < 0 || rc >= BOARD_SIZE) break;
    if (obstacles.has(coordKey(rr, rc))) break;
    radarCells.push({ r: rr, c: rc });
  }

  return {
    id: guard.id,
    pos,
    dr,
    dc,
    radarCells,
  };
}

function canReachStealthTarget(
  targetCoord: Coord,
  otherTokenCoords: Set<string>,
  obstacles: Set<string>,
): boolean {
  const startKey = coordKey(START_POS.r, START_POS.c);
  const targetKey = coordKey(targetCoord.r, targetCoord.c);
  const blockers = new Set<string>(obstacles);
  otherTokenCoords.forEach((k) => blockers.add(k));

  if (blockers.has(startKey) || blockers.has(targetKey)) return false;

  const visited = new Set<string>([startKey]);
  const queue: Coord[] = [START_POS];
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

function isStealthLayoutPlayable(
  tokens: Record<OptionKey, Coord>,
  obstacles: Set<string>,
): boolean {
  const keys: OptionKey[] = ["A", "B", "C", "D"];
  return keys.every((targetOpt) => {
    const others = new Set<string>();
    keys.forEach((k) => {
      if (k !== targetOpt) {
        others.add(coordKey(tokens[k].r, tokens[k].c));
      }
    });
    return canReachStealthTarget(tokens[targetOpt], others, obstacles);
  });
}

function generateStealthLayout(obstacleCount: number): {
  tokens: Record<OptionKey, Coord>;
  obstacles: Set<string>;
  guards: GuardPath[];
} {
  const optionKeys: OptionKey[] = ["A", "B", "C", "D"];
  const clampedObstacles = Math.max(0, Math.min(4, obstacleCount || 0));
  const startKey = coordKey(START_POS.r, START_POS.c);

  for (let attempt = 0; attempt < 100; attempt++) {
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

    if (!isStealthLayoutPlayable(tokens, new Set())) continue;

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
      if (!isStealthLayoutPlayable(tokens, obstacles)) {
        obstacles.delete(k);
      } else {
        occupied.add(k);
      }
    }

    const candidateTracks: Coord[][] = [];

    for (let r = 0; r < 5; r++) {
      for (let startC = 0; startC <= 2; startC++) {
        const track: Coord[] = [];
        for (let c = startC; c < startC + 4 && c < BOARD_SIZE; c++) {
          if (occupied.has(coordKey(r, c))) break;
          track.push({ r, c });
        }
        if (track.length >= 3) {
          candidateTracks.push(track);
        }
      }
    }

    for (let c = 1; c < BOARD_SIZE; c++) {
      for (let startR = 0; startR <= 2; startR++) {
        const track: Coord[] = [];
        for (let r = startR; r < startR + 4 && r < BOARD_SIZE; r++) {
          if (occupied.has(coordKey(r, c))) break;
          track.push({ r, c });
        }
        if (track.length >= 3) {
          candidateTracks.push(track);
        }
      }
    }

    const safeTracks = candidateTracks.filter((track) => {
      const dummyGuard: GuardPath = { id: 0, cells: track };
      const cycle = 2 * track.length - 2;
      for (let t = 0; t < cycle; t++) {
        const state = computeGuardAtTick(dummyGuard, t, obstacles);
        if (coordKey(state.pos.r, state.pos.c) === startKey) return false;
        if (state.radarCells.some((rc) => coordKey(rc.r, rc.c) === startKey)) {
          return false;
        }
      }
      return true;
    });

    const shuffledTracks = [...safeTracks].sort(() => Math.random() - 0.5);
    const guards: GuardPath[] = [];
    const usedGuardCells = new Set<string>();

    for (const track of shuffledTracks) {
      if (guards.length >= 3) break;
      const overlaps = track.some((cell) =>
        usedGuardCells.has(coordKey(cell.r, cell.c)),
      );
      if (!overlaps) {
        track.forEach((cell) => usedGuardCells.add(coordKey(cell.r, cell.c)));
        guards.push({ id: guards.length, cells: track });
      }
    }

    if (guards.length >= 2) {
      return { tokens, obstacles, guards };
    }
  }

  return {
    tokens: {
      A: { r: 0, c: 1 },
      B: { r: 0, c: 5 },
      C: { r: 3, c: 4 },
      D: { r: 5, c: 5 },
    },
    obstacles: new Set(["2,1", "4,3"]),
    guards: [
      {
        id: 0,
        cells: [
          { r: 1, c: 1 },
          { r: 1, c: 2 },
          { r: 1, c: 3 },
          { r: 1, c: 4 },
        ],
      },
      {
        id: 1,
        cells: [
          { r: 2, c: 3 },
          { r: 3, c: 3 },
          { r: 4, c: 3 },
        ],
      },
    ],
  };
}

function getFacingAngle(dr: number, dc: number): number {
  if (dc === 1) return 0;
  if (dr === 1) return 90;
  if (dc === -1) return 180;
  return -90;
}

export default function TactiStealthBoard({
  question,
  eliminatedOptions = [],
  disabled = false,
  onAnswer,
}: TactiStealthBoardProps) {
  const { lang } = useLanguage();

  const validCorrectKeys: OptionKey[] = useMemo(
    () =>
      parseBoardOptionKeys(question.correct_options, question.correct_option),
    [question.correct_options, question.correct_option],
  );

  const isMultiple =
    Boolean(question.allow_multiple) || validCorrectKeys.length > 1;

  const { tokens, obstacles, guards } = useMemo(
    () => generateStealthLayout(question.obstacles),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [question.id],
  );

  const [playerPos, setPlayerPos] = useState<Coord>(START_POS);
  const playerPosRef = useRef<Coord>(START_POS);
  const [patrolTick, setPatrolTick] = useState<number>(0);
  const [movesUsed, setMovesUsed] = useState<number>(0);
  const [caughtCount, setCaughtCount] = useState<number>(0);
  const [caughtBanner, setCaughtBanner] = useState<boolean>(false);
  const [selectedOptions, setSelectedOptions] = useState<OptionKey[]>([]);
  const [boardLocked, setBoardLocked] = useState<boolean>(false);

  const isInteractionDisabled = disabled || boardLocked;

  useEffect(() => {
    setPlayerPos(START_POS);
    playerPosRef.current = START_POS;
    setPatrolTick(0);
    setMovesUsed(0);
    setCaughtCount(0);
    setCaughtBanner(false);
    setSelectedOptions([]);
    setBoardLocked(false);
  }, [question.id]);

  const triggerSpottedReset = useCallback(() => {
    sound.playWrong();
    setCaughtCount((c) => c + 1);
    setMovesUsed((m) => m + 1);
    setCaughtBanner(true);
    setPlayerPos(START_POS);
    playerPosRef.current = START_POS;
  }, []);

  useEffect(() => {
    if (!caughtBanner) return;
    const t = setTimeout(() => setCaughtBanner(false), 1600);
    return () => clearTimeout(t);
  }, [caughtBanner]);

  useEffect(() => {
    if (isInteractionDisabled) return;

    const timer = setInterval(() => {
      setPatrolTick((prev) => {
        const nextTick = prev + 1;
        const currPos = playerPosRef.current;

        if (currPos.r !== START_POS.r || currPos.c !== START_POS.c) {
          const currKey = coordKey(currPos.r, currPos.c);
          const spotted = guards.some((g, idx) => {
            const state = computeGuardAtTick(g, nextTick + idx * 2, obstacles);
            if (coordKey(state.pos.r, state.pos.c) === currKey) return true;
            return state.radarCells.some(
              (rc) => coordKey(rc.r, rc.c) === currKey,
            );
          });

          if (spotted) {
            triggerSpottedReset();
          }
        }

        return nextTick;
      });
    }, PATROL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [isInteractionDisabled, guards, obstacles, triggerSpottedReset]);

  const activeGuards = useMemo(() => {
    return guards.map((g, idx) =>
      computeGuardAtTick(g, patrolTick + idx * 2, obstacles),
    );
  }, [guards, patrolTick, obstacles]);

  const radarCellSet = useMemo(() => {
    const set = new Set<string>();
    activeGuards.forEach((g) => {
      g.radarCells.forEach((rc) => set.add(coordKey(rc.r, rc.c)));
    });
    return set;
  }, [activeGuards]);

  const dangerCellSet = useMemo(() => {
    const set = new Set<string>(radarCellSet);
    activeGuards.forEach((g) => {
      set.add(coordKey(g.pos.r, g.pos.c));
    });
    return set;
  }, [activeGuards, radarCellSet]);

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
      if (!obstacles.has(k)) {
        set.add(k);
      }
    }
    return set;
  }, [playerPos, obstacles, isInteractionDisabled]);

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
      const targetKey = coordKey(r, c);
      if (!validNeighbors.has(targetKey)) return;

      if (dangerCellSet.has(targetKey)) {
        triggerSpottedReset();
        return;
      }

      const nextMoves = movesUsed + 1;
      setPlayerPos({ r, c });
      playerPosRef.current = { r, c };
      setMovesUsed(nextMoves);

      const hitOption = (["A", "B", "C", "D"] as OptionKey[]).find((opt) => {
        if (eliminatedOptions.includes(opt)) return false;
        if (selectedOptions.includes(opt)) return false;
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
        }
        setSelectedOptions([hitOption]);
        setBoardLocked(true);
        onAnswer(hitOption, isCorrect, nextMoves);
        return;
      }

      // Mode Multiple Answers: simpan pilihan tanpa menghentikan permainan bila pilihan pertama salah
      const nextSelected = [...selectedOptions, hitOption];
      setSelectedOptions(nextSelected);

      if (nextSelected.length >= validCorrectKeys.length) {
        finalizeMultipleSelection(nextSelected, nextMoves);
      } else {
        sound.playPowerUp();
      }
    },
    [
      isInteractionDisabled,
      validNeighbors,
      dangerCellSet,
      triggerSpottedReset,
      movesUsed,
      eliminatedOptions,
      selectedOptions,
      tokens,
      isMultiple,
      validCorrectKeys,
      onAnswer,
      finalizeMultipleSelection,
    ],
  );

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
      handleStepTo(playerPosRef.current.r + dr, playerPosRef.current.c + dc);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isInteractionDisabled, handleStepTo]);

  const handleManualSubmitMultiple = () => {
    if (isInteractionDisabled || !isMultiple || selectedOptions.length === 0)
      return;
    finalizeMultipleSelection(selectedOptions, Math.max(1, movesUsed));
  };

  const canStepDir = (dr: number, dc: number) => {
    if (isInteractionDisabled) return false;
    return validNeighbors.has(coordKey(playerPos.r + dr, playerPos.c + dc));
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Cyber-Tactical HUD Header */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 text-white shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-xl shrink-0">
            <span>🥷</span>
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-black text-xs sm:text-sm text-white tracking-tight truncate">
                TactiStealth
              </p>
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[9px] font-black uppercase tracking-wider">
                Live Radar
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-300 truncate">
              {lang === "EN"
                ? "Follow patrol rails & slip past red laser beams"
                : "Ikuti jalur patroli & menyelinap di sela sorotan laser"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {caughtCount > 0 && (
            <span className="px-2 py-1 rounded-xl bg-rose-500/25 border border-rose-400/50 text-rose-200 text-[11px] font-black">
              🚨 {caughtCount}x
            </span>
          )}
          <span className="px-2.5 py-1 rounded-xl bg-white/10 border border-white/15 text-[11px] font-black text-slate-100">
            {lang === "EN" ? `Steps: ${movesUsed}` : `Langkah: ${movesUsed}`}
          </span>
        </div>
      </div>

      {/* Alert Floating saat Tertangkap Radar */}
      <AnimatePresence>
        {caughtBanner && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 text-white text-xs font-black flex items-center justify-center gap-2 shadow-md border border-rose-400/40"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 animate-bounce" />
            <span>
              {lang === "EN"
                ? "Spotted by Laser Radar! Respawned at Safe Zone."
                : "Tersorot Radar Laser! Kembali ke Zona Aman."}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HUD Khusus Multiple Answers */}
      {isMultiple && (
        <div className="p-3 rounded-2xl bg-amber-50 border-2 border-amber-300 flex flex-wrap items-center justify-between gap-2">
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
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white text-[11px] font-black"
                    >
                      <Check className="w-3 h-3" /> {pickedOpt}
                    </span>
                  );
                }

                const isRight = validCorrectKeys.includes(pickedOpt);
                return (
                  <span
                    key={`slot-${slotIdx}`}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-white text-[11px] font-black ${
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

      {/* Arena Grid 6x6 Cyber-Stealth */}
      <motion.div
        animate={caughtBanner ? { x: [0, -7, 7, -5, 5, 0] } : { x: 0 }}
        transition={{ duration: 0.35 }}
        className={`relative aspect-square w-full max-w-[385px] mx-auto rounded-2xl overflow-hidden border-4 shadow-xl bg-[#090F1D] select-none transition-colors duration-300 ${
          caughtBanner ? "border-rose-500" : "border-slate-900"
        }`}
      >
        <svg
          viewBox="0 0 600 600"
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        >
          {guards.map((g) => {
            if (g.cells.length < 2) return null;
            const first = g.cells[0];
            const last = g.cells[g.cells.length - 1];
            const x1 = (first.c + 0.5) * 100;
            const y1 = (first.r + 0.5) * 100;
            const x2 = (last.c + 0.5) * 100;
            const y2 = (last.r + 0.5) * 100;

            return (
              <g key={`rail-${g.id}`}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#fb7185"
                  strokeWidth="3"
                  strokeDasharray="8 8"
                  strokeLinecap="round"
                  opacity="0.32"
                />
                {g.cells.map((cell, i) => (
                  <circle
                    key={`wp-${g.id}-${i}`}
                    cx={(cell.c + 0.5) * 100}
                    cy={(cell.r + 0.5) * 100}
                    r="4"
                    fill="#fda4af"
                    opacity="0.4"
                  />
                ))}
              </g>
            );
          })}
        </svg>

        <div className="w-full h-full grid grid-cols-6 grid-rows-6">
          {Array.from({ length: BOARD_SIZE }).map((_, r) =>
            Array.from({ length: BOARD_SIZE }).map((__, c) => {
              const key = coordKey(r, c);
              const isDark = (r + c) % 2 === 1;
              const isStartSafe = r === START_POS.r && c === START_POS.c;
              const isObstacle = obstacles.has(key);
              const isNeighbor = validNeighbors.has(key);
              const isRadarHere = radarCellSet.has(key);
              const isDangerNeighbor = isNeighbor && dangerCellSet.has(key);

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

              let cellBg = isDark ? "bg-[#0D1526]" : "bg-[#121C33]";
              if (isStartSafe) {
                cellBg =
                  "bg-emerald-950/75 ring-1 ring-inset ring-emerald-500/40";
              } else if (isRadarHere) {
                cellBg = "bg-rose-500/30 ring-1 ring-inset ring-rose-400/75";
              } else if (isNeighbor && !isInteractionDisabled) {
                cellBg = "bg-emerald-950/60 hover:bg-emerald-900/70";
              }

              return (
                <button
                  key={key}
                  type="button"
                  disabled={!isNeighbor || isInteractionDisabled}
                  onClick={() => handleStepTo(r, c)}
                  className={`relative flex items-center justify-center border border-slate-800/60 transition-colors duration-200 ${cellBg} ${
                    isNeighbor && !isInteractionDisabled
                      ? isDangerNeighbor
                        ? "cursor-not-allowed"
                        : "cursor-pointer"
                      : "cursor-default"
                  }`}
                >
                  {isStartSafe && (
                    <div className="flex flex-col items-center justify-center opacity-60 pointer-events-none">
                      <Shield className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[8px] font-black text-emerald-300 tracking-wider mt-0.5">
                        SAFE
                      </span>
                    </div>
                  )}

                  {isRadarHere && (
                    <div className="absolute inset-0 bg-gradient-to-br from-rose-500/20 to-red-600/35 animate-pulse pointer-events-none" />
                  )}

                  {isNeighbor &&
                    !isDangerNeighbor &&
                    !showActiveToken &&
                    !(playerPos.r === r && playerPos.c === c) && (
                      <span className="w-3 h-3 rounded-full bg-emerald-400/80 ring-4 ring-emerald-400/20 pointer-events-none transition-transform group-hover:scale-125" />
                    )}

                  {isObstacle && (
                    <div className="w-[82%] h-[82%] rounded-xl bg-gradient-to-b from-slate-700 to-slate-800 border border-slate-500/60 shadow-inner flex items-center justify-center pointer-events-none">
                      <span className="text-base sm:text-lg drop-shadow-xs">
                        🧱
                      </span>
                    </div>
                  )}

                  {tokenHere && isAlreadySelected && (
                    <span
                      className={`z-10 w-7 h-7 rounded-lg border font-black text-xs flex items-center justify-center pointer-events-none ${
                        !boardLocked
                          ? "bg-indigo-500/30 border-indigo-400 text-indigo-200"
                          : validCorrectKeys.includes(tokenHere)
                            ? "bg-emerald-500/25 border-emerald-400 text-emerald-300"
                            : "bg-rose-500/30 border-rose-400 text-rose-200"
                      }`}
                    >
                      {!boardLocked
                        ? `●${tokenHere}`
                        : validCorrectKeys.includes(tokenHere)
                          ? `✓${tokenHere}`
                          : `✗${tokenHere}`}
                    </span>
                  )}

                  {showActiveToken && tokenHere && (
                    <div className="relative z-10 flex items-center justify-center pointer-events-none">
                      {isNeighbor && !isDangerNeighbor && (
                        <span className="absolute -inset-1.5 rounded-xl border-2 border-amber-300/80 animate-ping" />
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

        {/* Penjaga Patroli */}
        {activeGuards.map((g) => {
          const beamLengthCells = g.radarCells.length;
          const facingAngle = getFacingAngle(g.dr, g.dc);

          return (
            <motion.div
              key={`guard-actor-${g.id}`}
              initial={false}
              animate={{
                left: `${(g.pos.c / BOARD_SIZE) * 100}%`,
                top: `${(g.pos.r / BOARD_SIZE) * 100}%`,
              }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 26,
              }}
              style={{
                width: `${100 / BOARD_SIZE}%`,
                height: `${100 / BOARD_SIZE}%`,
              }}
              className="absolute z-20 flex items-center justify-center pointer-events-none"
            >
              {beamLengthCells > 0 && (
                <div
                  style={{
                    transform: `rotate(${facingAngle}deg)`,
                    transformOrigin: "center center",
                  }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                  <div
                    style={{
                      width: `${beamLengthCells * 100}%`,
                      left: "50%",
                    }}
                    className="absolute h-[78%] bg-gradient-to-r from-rose-500/55 via-rose-500/30 to-transparent rounded-r-2xl border-y border-rose-400/40"
                  />
                </div>
              )}

              <div className="relative z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-700 text-white flex items-center justify-center shadow-[0_0_16px_rgba(244,63,94,0.65)] border border-rose-300/60">
                <span className="text-lg sm:text-xl leading-none">🤖</span>
                <Radio className="w-2.5 h-2.5 text-amber-200 absolute -top-1 -right-1 animate-pulse" />
              </div>
            </motion.div>
          );
        })}

        {/* Karakter Penyusup Pemain */}
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
          className="absolute z-30 p-1 flex items-center justify-center pointer-events-none"
        >
          <div className="w-full h-full rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white flex items-center justify-center text-2xl sm:text-3xl shadow-[0_0_18px_rgba(16,185,129,0.65)] border-b-4 border-emerald-900 ring-2 ring-emerald-200/60">
            🥷
          </div>
        </motion.div>
      </motion.div>

      {/* Kontrol D-Pad Taktis */}
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">
          {lang === "EN"
            ? "Tap green tiles, D-Pad, or WASD"
            : "Klik petak hijau, D-Pad, atau WASD"}
        </span>

        <div className="flex items-center gap-1.5 w-full sm:w-auto sm:flex-1 max-w-[260px] mx-auto sm:mx-0 sm:ml-auto">
          <button
            type="button"
            disabled={!canStepDir(0, -1)}
            onClick={() => handleStepTo(playerPos.r, playerPos.c - 1)}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-emerald-100 active:scale-95 disabled:opacity-35 text-slate-700 font-black flex items-center justify-center border-b-2 border-slate-300 transition cursor-pointer disabled:cursor-default"
            title="Move Left"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canStepDir(-1, 0)}
            onClick={() => handleStepTo(playerPos.r - 1, playerPos.c)}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-emerald-100 active:scale-95 disabled:opacity-35 text-slate-700 font-black flex items-center justify-center border-b-2 border-slate-300 transition cursor-pointer disabled:cursor-default"
            title="Move Up"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canStepDir(1, 0)}
            onClick={() => handleStepTo(playerPos.r + 1, playerPos.c)}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-emerald-100 active:scale-95 disabled:opacity-35 text-slate-700 font-black flex items-center justify-center border-b-2 border-slate-300 transition cursor-pointer disabled:cursor-default"
            title="Move Down"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canStepDir(0, 1)}
            onClick={() => handleStepTo(playerPos.r, playerPos.c + 1)}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-emerald-100 active:scale-95 disabled:opacity-35 text-slate-700 font-black flex items-center justify-center border-b-2 border-slate-300 transition cursor-pointer disabled:cursor-default"
            title="Move Right"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
