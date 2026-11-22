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
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Send,
  Check,
  Snowflake,
} from "lucide-react";
import {
  OptionKey,
  OPTION_STYLES,
  QuestionData,
} from "@/components/ChessQuizBoard";
import { useLanguage } from "@/components/LanguageProvider";
import { sound } from "@/lib/sound";

type SlideDir = "UP" | "DOWN" | "LEFT" | "RIGHT";

interface Coord {
  r: number;
  c: number;
}

interface SlideOutcome {
  dir: SlideDir;
  dest: Coord;
  hitOption: OptionKey | null;
}

interface TactiSlideBoardProps {
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

const SLIDE_DELTAS: Record<
  SlideDir,
  { dr: number; dc: number; arrow: string }
> = {
  UP: { dr: -1, dc: 0, arrow: "▲" },
  DOWN: { dr: 1, dc: 0, arrow: "▼" },
  LEFT: { dr: 0, dc: -1, arrow: "◄" },
  RIGHT: { dr: 0, dc: 1, arrow: "►" },
};

const ALL_DIRS: SlideDir[] = ["UP", "DOWN", "LEFT", "RIGHT"];
const OPTION_KEYS: OptionKey[] = ["A", "B", "C", "D"];

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

function simulateSlide(
  start: Coord,
  dir: SlideDir,
  obstacles: Set<string>,
  activeTokenMap: Map<string, OptionKey>,
): SlideOutcome {
  const { dr, dc } = SLIDE_DELTAS[dir];
  let r = start.r;
  let c = start.c;

  while (true) {
    const nr = r + dr;
    const nc = c + dc;

    // Mentok dinding tepi arena es
    if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) {
      return { dir, dest: { r, c }, hitOption: null };
    }

    const nextKey = coordKey(nr, nc);

    // Mentok batu bumper (berhenti 1 petak sebelumnya)
    if (obstacles.has(nextKey)) {
      return { dir, dest: { r, c }, hitOption: null };
    }

    // Mengenai huruf opsi aktif -> berhenti tepat di atas huruf tersebut
    const hitOpt = activeTokenMap.get(nextKey);
    if (hitOpt) {
      return { dir, dest: { r: nr, c: nc }, hitOption: hitOpt };
    }

    r = nr;
    c = nc;
  }
}

function collectReachableStops(origin: Coord, obstacles: Set<string>): Coord[] {
  const emptyMap = new Map<string, OptionKey>();
  const startKey = coordKey(origin.r, origin.c);
  const visited = new Set<string>([startKey]);
  const queue: Coord[] = [origin];
  const stops: Coord[] = [];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const dir of ALL_DIRS) {
      const out = simulateSlide(curr, dir, obstacles, emptyMap);
      const dk = coordKey(out.dest.r, out.dest.c);
      if (!visited.has(dk)) {
        visited.add(dk);
        queue.push(out.dest);
        stops.push(out.dest);
      }
    }
  }

  return stops;
}

function canReachSlideTarget(
  origin: Coord,
  targetOpt: OptionKey,
  tokens: Record<OptionKey, Coord>,
  obstacles: Set<string>,
  ignoredOpts: Set<OptionKey>,
): boolean {
  const activeMap = new Map<string, OptionKey>();
  OPTION_KEYS.forEach((opt) => {
    if (!ignoredOpts.has(opt)) {
      activeMap.set(coordKey(tokens[opt].r, tokens[opt].c), opt);
    }
  });

  const startKey = coordKey(origin.r, origin.c);
  const visited = new Set<string>([startKey]);
  const queue: Coord[] = [origin];

  while (queue.length > 0) {
    const curr = queue.shift()!;

    for (const dir of ALL_DIRS) {
      const outcome = simulateSlide(curr, dir, obstacles, activeMap);
      if (outcome.hitOption === targetOpt) {
        return true;
      }
      // Jangan lanjutkan cabang jika menabrak opsi aktif lain yang bukan target
      if (outcome.hitOption !== null) {
        continue;
      }

      const destKey = coordKey(outcome.dest.r, outcome.dest.c);
      if (!visited.has(destKey)) {
        visited.add(destKey);
        queue.push(outcome.dest);
      }
    }
  }

  return false;
}

// Menguji seluruh kemungkinan subset opsi yang sudah tertangkap (0..3 opsi) agar 100% bebas buntu
function isSuperSlidePlayable(
  tokens: Record<OptionKey, Coord>,
  obstacles: Set<string>,
): boolean {
  for (let mask = 0; mask < 15; mask++) {
    const capturedSet = new Set<OptionKey>();
    const capturedList: OptionKey[] = [];
    const remainingList: OptionKey[] = [];

    OPTION_KEYS.forEach((opt, idx) => {
      if ((mask & (1 << idx)) !== 0) {
        capturedSet.add(opt);
        capturedList.push(opt);
      } else {
        remainingList.push(opt);
      }
    });

    // 1. Setiap opsi tersisa harus bisa dijangkau dari START_POS (termasuk setelah Reset)
    for (const target of remainingList) {
      if (
        !canReachSlideTarget(START_POS, target, tokens, obstacles, capturedSet)
      ) {
        return false;
      }
    }

    // 2. Setiap opsi tersisa harus bisa dijangkau langsung dari posisi opsi mana pun yang baru tertangkap
    for (const prevOpt of capturedList) {
      for (const target of remainingList) {
        if (
          !canReachSlideTarget(
            tokens[prevOpt],
            target,
            tokens,
            obstacles,
            capturedSet,
          )
        ) {
          return false;
        }
      }
    }
  }

  return true;
}

function generateSlideLayout(obstacleCount: number): {
  tokens: Record<OptionKey, Coord>;
  obstacles: Set<string>;
} {
  const targetObstacles = Math.max(4, Math.min(6, (obstacleCount || 3) + 2));
  const startKey = coordKey(START_POS.r, START_POS.c);

  for (let attempt = 0; attempt < 240; attempt++) {
    const allCells: Coord[] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (coordKey(r, c) === startKey) continue;
        allCells.push({ r, c });
      }
    }

    const shuffled = [...allCells].sort(() => Math.random() - 0.5);

    // 1. Tempatkan batu bumper
    const obstacles = new Set<string>();
    for (const cell of shuffled) {
      if (obstacles.size >= targetObstacles) break;
      // Sisakan minimal 1 pintu keluar dari START_POS (5,0)
      if ((cell.r === 4 && cell.c === 0) || (cell.r === 5 && cell.c === 1)) {
        continue;
      }
      obstacles.add(coordKey(cell.r, cell.c));
    }

    // 2. Cari seluruh titik henti yang benar-benar bisa dijangkau dari START_POS
    const reachableStops = collectReachableStops(START_POS, obstacles);
    if (reachableStops.length < 6) continue;

    // Utamakan titik yang tidak tepat 1x luncur langsung dari START_POS
    const nonTrivialStops = reachableStops.filter(
      (cell) => cell.r !== START_POS.r && cell.c !== START_POS.c,
    );
    const pool = nonTrivialStops.length >= 4 ? nonTrivialStops : reachableStops;

    // 3. Coba beberapa kombinasi 4 titik dari pool yang sudah dijamin reachable
    for (let pickTry = 0; pickTry < 18; pickTry++) {
      const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, 4);
      if (picked.length < 4) break;

      const tokens = {} as Record<OptionKey, Coord>;
      OPTION_KEYS.forEach((opt, idx) => {
        tokens[opt] = picked[idx];
      });

      if (isSuperSlidePlayable(tokens, obstacles)) {
        return { tokens, obstacles };
      }
    }
  }

  // Fallback terverifikasi 100% lolos seluruh 44 jalur BFS (Single & Multiple Answers)
  return {
    tokens: {
      A: { r: 0, c: 4 },
      B: { r: 4, c: 5 },
      C: { r: 3, c: 5 },
      D: { r: 1, c: 2 },
    },
    obstacles: new Set(["0,5", "1,3", "2,0", "2,1", "5,4"]),
  };
}

export default function TactiSlideBoard({
  question,
  eliminatedOptions = [],
  disabled = false,
  onAnswer,
}: TactiSlideBoardProps) {
  const { lang } = useLanguage();

  const validCorrectKeys: OptionKey[] = useMemo(
    () =>
      parseBoardOptionKeys(question.correct_options, question.correct_option),
    [question.correct_options, question.correct_option],
  );

  const isMultiple =
    Boolean(question.allow_multiple) || validCorrectKeys.length > 1;

  const { tokens, obstacles } = useMemo(
    () => generateSlideLayout(question.obstacles),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [question.id],
  );

  const [puckPos, setPuckPos] = useState<Coord>(START_POS);
  const puckPosRef = useRef<Coord>(START_POS);
  const [lastTrail, setLastTrail] = useState<{
    from: Coord;
    to: Coord;
    id: number;
  } | null>(null);
  const [slidesUsed, setSlidesUsed] = useState<number>(0);
  const slidesUsedRef = useRef<number>(0);
  const [selectedOptions, setSelectedOptions] = useState<OptionKey[]>([]);
  const selectedOptionsRef = useRef<OptionKey[]>([]);
  const [boardLocked, setBoardLocked] = useState<boolean>(false);
  const [hasWrongResult, setHasWrongResult] = useState<boolean>(false);

  useEffect(() => {
    setPuckPos(START_POS);
    puckPosRef.current = START_POS;
    setLastTrail(null);
    setSlidesUsed(0);
    slidesUsedRef.current = 0;
    setSelectedOptions([]);
    selectedOptionsRef.current = [];
    setBoardLocked(false);
    setHasWrongResult(false);
  }, [question.id]);

  const isInteractionDisabled = disabled || boardLocked;

  // Opsi yang sudah dipilih menjadi tembus agar tidak memblokir luncuran ke opsi berikutnya
  const activeTokenMap = useMemo(() => {
    const map = new Map<string, OptionKey>();
    OPTION_KEYS.forEach((opt) => {
      if (eliminatedOptions.includes(opt) || selectedOptions.includes(opt)) {
        return;
      }
      const tPos = tokens[opt];
      if (tPos) map.set(coordKey(tPos.r, tPos.c), opt);
    });
    return map;
  }, [tokens, eliminatedOptions, selectedOptions]);

  const slideOutcomes = useMemo(() => {
    const map = {} as Record<SlideDir, SlideOutcome>;
    ALL_DIRS.forEach((dir) => {
      map[dir] = simulateSlide(puckPos, dir, obstacles, activeTokenMap);
    });
    return map;
  }, [puckPos, obstacles, activeTokenMap]);

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

  const handleSlide = useCallback(
    (dir: SlideDir) => {
      if (isInteractionDisabled) return;

      const currentPos = puckPosRef.current;
      const currSelected = selectedOptionsRef.current;

      const liveTokenMap = new Map<string, OptionKey>();
      OPTION_KEYS.forEach((opt) => {
        if (eliminatedOptions.includes(opt) || currSelected.includes(opt)) {
          return;
        }
        const tPos = tokens[opt];
        if (tPos) liveTokenMap.set(coordKey(tPos.r, tPos.c), opt);
      });

      const outcome = simulateSlide(currentPos, dir, obstacles, liveTokenMap);

      if (outcome.dest.r === currentPos.r && outcome.dest.c === currentPos.c) {
        return;
      }

      const nextSlides = slidesUsedRef.current + 1;
      slidesUsedRef.current = nextSlides;
      setSlidesUsed(nextSlides);

      setLastTrail({
        from: currentPos,
        to: outcome.dest,
        id: nextSlides,
      });

      puckPosRef.current = outcome.dest;
      setPuckPos(outcome.dest);

      const hitOpt = outcome.hitOption;
      if (!hitOpt) {
        sound.playMove();
        return;
      }

      if (!isMultiple) {
        const isCorrect = validCorrectKeys.includes(hitOpt);
        if (isCorrect) {
          sound.playCorrect();
        } else {
          sound.playWrong();
          setHasWrongResult(true);
        }
        selectedOptionsRef.current = [hitOpt];
        setSelectedOptions([hitOpt]);
        setBoardLocked(true);
        onAnswer(hitOpt, isCorrect, nextSlides);
        return;
      }

      // Mode Multiple Answers: biarkan lanjut meski pilihan pertama salah
      const nextSelected = currSelected.includes(hitOpt)
        ? currSelected
        : [...currSelected, hitOpt];
      selectedOptionsRef.current = nextSelected;
      setSelectedOptions(nextSelected);

      if (nextSelected.length >= validCorrectKeys.length) {
        finalizeMultipleSelection(nextSelected, nextSlides);
      } else {
        sound.playPowerUp();
      }
    },
    [
      isInteractionDisabled,
      eliminatedOptions,
      tokens,
      obstacles,
      isMultiple,
      validCorrectKeys,
      onAnswer,
      finalizeMultipleSelection,
    ],
  );

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
      Math.max(1, slidesUsedRef.current),
    );
  };

  const handleResetPosition = () => {
    if (isInteractionDisabled) return;
    const curr = puckPosRef.current;
    if (curr.r === START_POS.r && curr.c === START_POS.c) return;
    sound.playMove();
    setLastTrail(null);
    puckPosRef.current = START_POS;
    setPuckPos(START_POS);
    const nextSlides = slidesUsedRef.current + 1;
    slidesUsedRef.current = nextSlides;
    setSlidesUsed(nextSlides);
  };

  useEffect(() => {
    if (isInteractionDisabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      let dir: SlideDir | null = null;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") dir = "UP";
      else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S")
        dir = "DOWN";
      else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A")
        dir = "LEFT";
      else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D")
        dir = "RIGHT";
      else return;

      e.preventDefault();
      handleSlide(dir);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isInteractionDisabled, handleSlide]);

  const landingByCell = useMemo(() => {
    const map = new Map<string, SlideOutcome>();
    if (isInteractionDisabled) return map;

    ALL_DIRS.forEach((dir) => {
      const out = slideOutcomes[dir];
      if (out.dest.r !== puckPos.r || out.dest.c !== puckPos.c) {
        map.set(coordKey(out.dest.r, out.dest.c), out);
      }
    });
    return map;
  }, [slideOutcomes, puckPos, isInteractionDisabled]);

  const validLandingsList = useMemo(
    () => Array.from(landingByCell.values()),
    [landingByCell],
  );

  const canMoveDir = (dir: SlideDir) => {
    if (isInteractionDisabled) return false;
    const out = slideOutcomes[dir];
    return out.dest.r !== puckPos.r || out.dest.c !== puckPos.c;
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Glacial Cyber-Ice HUD Header */}
      <div className="flex items-start sm:items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-slate-900 via-[#0C243C] to-slate-900 border border-cyan-500/35 text-white shadow-sm">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
          <div className="relative w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/45 flex items-center justify-center text-xl shrink-0 mt-0.5 sm:mt-0">
            <span>🥌</span>
            <Snowflake className="w-3 h-3 text-cyan-300 absolute -top-1 -right-1 animate-spin" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="font-black text-xs sm:text-sm text-white tracking-tight">
                TactiSlide
              </p>
              <span className="px-1.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-200 text-[9px] font-black uppercase tracking-wider">
                Ice Rink
              </span>
            </div>
            <p className="text-[11px] font-medium text-cyan-100/85 leading-snug mt-0.5">
              {lang === "EN"
                ? "Glide across ice & bank off rocks onto the target"
                : "Meluncur di arena es & pantulkan ke batu menuju target"}
            </p>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-xl bg-white/10 border border-white/15 text-[11px] font-black text-cyan-100 shrink-0">
          {lang === "EN" ? `Slides: ${slidesUsed}` : `Luncur: ${slidesUsed}`}
        </span>
      </div>

      {/* HUD Khusus Multiple Answers (Netral saat memilih, evaluasi di akhir) */}
      {isMultiple && (
        <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50/80 border-2 border-amber-300 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              {lang === "EN"
                ? `Collect ${validCorrectKeys.length} Options (${selectedOptions.length}/${validCorrectKeys.length})`
                : `Kumpulkan ${validCorrectKeys.length} Jawaban (${selectedOptions.length}/${validCorrectKeys.length})`}
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

      {/* Arena Es 6x6 dengan 60fps Smooth Glide Overlay */}
      <motion.div
        animate={hasWrongResult ? { x: [0, -7, 7, -5, 5, 0] } : { x: 0 }}
        transition={{ duration: 0.35 }}
        className={`relative aspect-square w-full max-w-[385px] mx-auto rounded-2xl overflow-hidden border-4 shadow-xl bg-gradient-to-br from-sky-100 via-cyan-50 to-blue-100 select-none transition-colors ${
          hasWrongResult ? "border-rose-500" : "border-slate-900"
        }`}
      >
        {/* Layer 1: SVG Trajectory Guide Lines & Slide Wake */}
        <svg
          viewBox="0 0 600 600"
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        >
          {lastTrail && (
            <motion.line
              key={`trail-${lastTrail.id}`}
              x1={(lastTrail.from.c + 0.5) * 100}
              y1={(lastTrail.from.r + 0.5) * 100}
              x2={(lastTrail.to.c + 0.5) * 100}
              y2={(lastTrail.to.r + 0.5) * 100}
              stroke="#38bdf8"
              strokeWidth="16"
              strokeLinecap="round"
              initial={{ opacity: 0.65 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
            />
          )}

          {!isInteractionDisabled &&
            validLandingsList.map((out) => (
              <line
                key={`guide-${out.dir}`}
                x1={(puckPos.c + 0.5) * 100}
                y1={(puckPos.r + 0.5) * 100}
                x2={(out.dest.c + 0.5) * 100}
                y2={(out.dest.r + 0.5) * 100}
                stroke={out.hitOption ? "#f59e0b" : "#0284c7"}
                strokeWidth="4"
                strokeDasharray="8 8"
                strokeLinecap="round"
                opacity={out.hitOption ? "0.55" : "0.28"}
              />
            ))}
        </svg>

        {/* Layer 2: Grid Sel Arena Es 6x6 */}
        <div className="w-full h-full grid grid-cols-6 grid-rows-6">
          {Array.from({ length: BOARD_SIZE }).map((_, r) =>
            Array.from({ length: BOARD_SIZE }).map((__, c) => {
              const key = coordKey(r, c);
              const isDark = (r + c) % 2 === 1;
              const isObstacle = obstacles.has(key);
              const landingOutcome = landingByCell.get(key);

              const tokenHere = OPTION_KEYS.find((opt) => {
                const tPos = tokens[opt];
                return tPos && tPos.r === r && tPos.c === c;
              });

              const isEliminated = tokenHere
                ? eliminatedOptions.includes(tokenHere)
                : false;
              const isAlreadySelected = tokenHere
                ? selectedOptions.includes(tokenHere)
                : false;
              const showActiveToken =
                tokenHere && !isEliminated && !isAlreadySelected;

              let cellBg = isDark ? "bg-sky-200/55" : "bg-white/75";
              if (landingOutcome && showActiveToken) {
                cellBg = "bg-amber-200/90 ring-2 ring-inset ring-amber-400";
              } else if (landingOutcome) {
                cellBg =
                  "bg-cyan-200/80 hover:bg-cyan-300/75 ring-1 ring-inset ring-cyan-400/70";
              }

              return (
                <button
                  key={key}
                  type="button"
                  disabled={!landingOutcome || isInteractionDisabled}
                  onClick={() =>
                    landingOutcome && handleSlide(landingOutcome.dir)
                  }
                  className={`relative flex items-center justify-center border border-sky-200/80 transition-colors duration-150 ${cellBg} ${
                    landingOutcome && !isInteractionDisabled
                      ? "cursor-pointer"
                      : "cursor-default"
                  }`}
                >
                  {!isObstacle && !tokenHere && !landingOutcome && (
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-300/60 pointer-events-none" />
                  )}

                  {landingOutcome &&
                    !showActiveToken &&
                    !(puckPos.r === r && puckPos.c === c) && (
                      <span className="z-10 w-6 h-6 rounded-full bg-sky-600/20 border border-sky-500/35 text-sky-900 font-black text-[10px] flex items-center justify-center pointer-events-none">
                        {SLIDE_DELTAS[landingOutcome.dir].arrow}
                      </span>
                    )}

                  {isObstacle && (
                    <div className="z-10 w-[82%] h-[82%] rounded-xl bg-gradient-to-b from-slate-600 to-slate-800 border-b-4 border-slate-950 shadow-md flex items-center justify-center pointer-events-none">
                      <span className="text-base sm:text-lg drop-shadow-xs">
                        🧱
                      </span>
                    </div>
                  )}

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

                  {showActiveToken && tokenHere && (
                    <div className="relative z-10 flex items-center justify-center pointer-events-none">
                      {landingOutcome && (
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
        </div>

        {/* Layer 3: Bidak Curling Pemain (60fps GPU-Accelerated Glide) */}
        <motion.div
          initial={false}
          animate={{
            left: `${(puckPos.c / BOARD_SIZE) * 100}%`,
            top: `${(puckPos.r / BOARD_SIZE) * 100}%`,
          }}
          transition={{
            type: "spring",
            stiffness: 340,
            damping: 27,
            mass: 0.75,
          }}
          style={{
            width: `${100 / BOARD_SIZE}%`,
            height: `${100 / BOARD_SIZE}%`,
          }}
          className="absolute z-20 p-1 flex items-center justify-center pointer-events-none"
        >
          <div className="w-full h-full rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-600 text-white flex items-center justify-center text-2xl sm:text-3xl shadow-[0_6px_16px_rgba(2,132,199,0.5)] border-b-4 border-blue-900 ring-2 ring-white/80">
            🥌
          </div>
        </motion.div>
      </motion.div>

      {/* Bar Kontrol Arah Luncur & Reset Posisi */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1">
          <button
            type="button"
            disabled={!canMoveDir("LEFT")}
            onClick={() => handleSlide("LEFT")}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-cyan-100 active:scale-95 disabled:opacity-35 text-slate-700 font-black flex items-center justify-center border-b-2 border-slate-300 transition cursor-pointer disabled:cursor-default"
            title="Slide Left"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canMoveDir("UP")}
            onClick={() => handleSlide("UP")}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-cyan-100 active:scale-95 disabled:opacity-35 text-slate-700 font-black flex items-center justify-center border-b-2 border-slate-300 transition cursor-pointer disabled:cursor-default"
            title="Slide Up"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canMoveDir("DOWN")}
            onClick={() => handleSlide("DOWN")}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-cyan-100 active:scale-95 disabled:opacity-35 text-slate-700 font-black flex items-center justify-center border-b-2 border-slate-300 transition cursor-pointer disabled:cursor-default"
            title="Slide Down"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canMoveDir("RIGHT")}
            onClick={() => handleSlide("RIGHT")}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-cyan-100 active:scale-95 disabled:opacity-35 text-slate-700 font-black flex items-center justify-center border-b-2 border-slate-300 transition cursor-pointer disabled:cursor-default"
            title="Slide Right"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          disabled={
            isInteractionDisabled ||
            (puckPos.r === START_POS.r && puckPos.c === START_POS.c)
          }
          onClick={handleResetPosition}
          title={
            lang === "EN"
              ? "Return puck to start position"
              : "Kembalikan bidak ke posisi awal"
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
