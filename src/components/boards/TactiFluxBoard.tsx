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
  RefreshCw,
  Send,
  Check,
  Atom,
} from "lucide-react";
import {
  OptionKey,
  OPTION_STYLES,
  QuestionData,
} from "@/components/ChessQuizBoard";
import { useLanguage } from "@/components/LanguageProvider";
import { sound } from "@/lib/sound";

type Polarity = "N" | "S"; // 'N' = Utara (+), 'S' = Selatan (-)
type PulseDir = "UP" | "DOWN" | "LEFT" | "RIGHT";

interface Coord {
  r: number;
  c: number;
}

interface MagnetPillar {
  r: number;
  c: number;
  pole: Polarity;
}

interface PulseOutcome {
  dir: PulseDir;
  path: Coord[];
  dest: Coord;
  hitOption: OptionKey | null;
  deflected: boolean;
}

interface TactiFluxBoardProps {
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

const PULSE_DELTAS: Record<
  PulseDir,
  { dr: number; dc: number; arrow: string }
> = {
  UP: { dr: -1, dc: 0, arrow: "▲" },
  DOWN: { dr: 1, dc: 0, arrow: "▼" },
  LEFT: { dr: 0, dc: -1, arrow: "◄" },
  RIGHT: { dr: 0, dc: 1, arrow: "►" },
};

const ALL_DIRS: PulseDir[] = ["UP", "DOWN", "LEFT", "RIGHT"];
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

function getVectorArrow(dr: number, dc: number): string {
  if (dr === -1) return "▲";
  if (dr === 1) return "▼";
  if (dc === -1) return "◄";
  return "►";
}

function simulateFluxPulse(
  start: Coord,
  dir: PulseDir,
  polarity: Polarity,
  obstacles: Set<string>,
  pillarMap: Map<string, MagnetPillar>,
  activeTokenMap: Map<string, OptionKey>,
): PulseOutcome {
  const { dr, dc } = PULSE_DELTAS[dir];
  const path: Coord[] = [{ ...start }];
  let r = start.r;
  let c = start.c;

  // Prioritaskan pengecekan pilar sesuai arah gerak bola: depan, lalu sisi tegak lurus, lalu belakang
  const orderedChecks: [number, number][] = [
    [dr, dc],
    [-dc, -dr],
    [dc, dr],
    [-dr, -dc],
  ];

  for (let step = 0; step < BOARD_SIZE; step++) {
    const nr = r + dr;
    const nc = c + dc;

    // Mentok batas papan
    if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) {
      return { dir, path, dest: { r, c }, hitOption: null, deflected: false };
    }

    const nextKey = coordKey(nr, nc);

    // Mentok tembok bata atau tubuh pilar magnet
    if (obstacles.has(nextKey) || pillarMap.has(nextKey)) {
      return { dir, path, dest: { r, c }, hitOption: null, deflected: false };
    }

    r = nr;
    c = nc;
    path.push({ r, c });

    // Cek apakah langsung mengenai opsi aktif
    const directHit = activeTokenMap.get(nextKey);
    if (directHit) {
      return {
        dir,
        path,
        dest: { r, c },
        hitOption: directHit,
        deflected: false,
      };
    }

    // Cek apakah petak ini masuk area medan magnet (1 petak ortogonal dari pilar magnet)
    let adjacentPillar: MagnetPillar | null = null;
    for (const [adr, adc] of orderedChecks) {
      const p = pillarMap.get(coordKey(r + adr, c + adc));
      if (p) {
        adjacentPillar = p;
        break;
      }
    }

    if (adjacentPillar) {
      // Kutub berlawanan -> TARIK (mengunci posisi bola berhenti di medan magnet)
      if (adjacentPillar.pole !== polarity) {
        return {
          dir,
          path,
          dest: { r, c },
          hitOption: null,
          deflected: false,
        };
      }

      // Kutub senama -> TOLAK (mendorong bola 1 petak menjauhi pilar magnet ke segala arah sesuai posisi pilar)
      const pushDr = r - adjacentPillar.r;
      const pushDc = c - adjacentPillar.c;
      const kr = r + pushDr;
      const kc = c + pushDc;

      if (kr >= 0 && kr < BOARD_SIZE && kc >= 0 && kc < BOARD_SIZE) {
        const kickKey = coordKey(kr, kc);
        if (!obstacles.has(kickKey) && !pillarMap.has(kickKey)) {
          r = kr;
          c = kc;
          path.push({ r, c });
          const kickHit = activeTokenMap.get(kickKey);
          if (kickHit) {
            return {
              dir,
              path,
              dest: { r, c },
              hitOption: kickHit,
              deflected: true,
            };
          }
          return {
            dir,
            path,
            dest: { r, c },
            hitOption: null,
            deflected: true,
          };
        }
      }

      return {
        dir,
        path,
        dest: { r, c },
        hitOption: null,
        deflected: false,
      };
    }
  }

  return { dir, path, dest: { r, c }, hitOption: null, deflected: false };
}

function canReachFluxTarget(
  origin: Coord,
  targetOpt: OptionKey,
  tokens: Record<OptionKey, Coord>,
  obstacles: Set<string>,
  pillarMap: Map<string, MagnetPillar>,
  ignoredOpts: Set<OptionKey>,
): boolean {
  const activeMap = new Map<string, OptionKey>();
  (["A", "B", "C", "D"] as OptionKey[]).forEach((opt) => {
    if (!ignoredOpts.has(opt)) {
      activeMap.set(coordKey(tokens[opt].r, tokens[opt].c), opt);
    }
  });

  const visited = new Set<string>([`${origin.r},${origin.c},N`]);
  const queue: { r: number; c: number; pole: Polarity }[] = [
    { r: origin.r, c: origin.c, pole: "N" },
  ];

  while (queue.length > 0) {
    const curr = queue.shift()!;

    // 1. Transisi balik polaritas (+ <-> -)
    const flippedPole: Polarity = curr.pole === "N" ? "S" : "N";
    const flipSig = `${curr.r},${curr.c},${flippedPole}`;
    if (!visited.has(flipSig)) {
      visited.add(flipSig);
      queue.push({ r: curr.r, c: curr.c, pole: flippedPole });
    }

    // 2. Transisi pulsa 4 arah
    for (const dir of ALL_DIRS) {
      const outcome = simulateFluxPulse(
        { r: curr.r, c: curr.c },
        dir,
        curr.pole,
        obstacles,
        pillarMap,
        activeMap,
      );

      if (outcome.hitOption === targetOpt) {
        return true;
      }
      if (outcome.hitOption !== null) {
        continue;
      }

      const nextSig = `${outcome.dest.r},${outcome.dest.c},${curr.pole}`;
      if (!visited.has(nextSig)) {
        visited.add(nextSig);
        queue.push({ r: outcome.dest.r, c: outcome.dest.c, pole: curr.pole });
      }
    }
  }

  return false;
}

function isFluxLayoutPlayable(
  tokens: Record<OptionKey, Coord>,
  obstacles: Set<string>,
  pillars: MagnetPillar[],
): boolean {
  const pillarMap = new Map<string, MagnetPillar>();
  pillars.forEach((p) => pillarMap.set(coordKey(p.r, p.c), p));

  const keys: OptionKey[] = ["A", "B", "C", "D"];
  const emptyIgnored = new Set<OptionKey>();

  // 1. Pastikan keempat opsi bisa dicapai dari titik awal
  const allFromStart = keys.every((opt) =>
    canReachFluxTarget(
      START_POS,
      opt,
      tokens,
      obstacles,
      pillarMap,
      emptyIgnored,
    ),
  );
  if (!allFromStart) return false;

  // 2. Pastikan antar opsi juga terhubung (untuk soal Multiple Answers)
  for (const fromOpt of keys) {
    const ignoredAfterFirst = new Set<OptionKey>([fromOpt]);
    for (const toOpt of keys) {
      if (fromOpt === toOpt) continue;
      if (
        !canReachFluxTarget(
          tokens[fromOpt],
          toOpt,
          tokens,
          obstacles,
          pillarMap,
          ignoredAfterFirst,
        )
      ) {
        return false;
      }
    }
  }

  return true;
}

function generateFluxLayout(obstacleCount: number): {
  tokens: Record<OptionKey, Coord>;
  obstacles: Set<string>;
  pillars: MagnetPillar[];
} {
  const optionKeys: OptionKey[] = ["A", "B", "C", "D"];
  const clampedObstacles = Math.max(1, Math.min(3, obstacleCount || 2));
  const startKey = coordKey(START_POS.r, START_POS.c);

  for (let attempt = 0; attempt < 200; attempt++) {
    const occupied = new Set<string>([startKey]);

    // 1. Tempatkan 3 Pilar Magnet di area tengah
    const innerCandidates: Coord[] = [];
    for (let r = 1; r <= 4; r++) {
      for (let c = 1; c <= 4; c++) {
        innerCandidates.push({ r, c });
      }
    }
    const shuffledInner = [...innerCandidates].sort(() => Math.random() - 0.5);
    const pillars: MagnetPillar[] = [];

    for (const cell of shuffledInner) {
      if (pillars.length >= 3) break;
      const tooClose = pillars.some(
        (p) => Math.abs(p.r - cell.r) + Math.abs(p.c - cell.c) < 2,
      );
      if (tooClose) continue;

      const pole: Polarity = pillars.length % 2 === 0 ? "N" : "S";
      pillars.push({ r: cell.r, c: cell.c, pole });
      occupied.add(coordKey(cell.r, cell.c));
    }

    if (pillars.length < 3) continue;

    // 2. Tempatkan tembok bata pada sel tersisa
    const remainingCells: Coord[] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const k = coordKey(r, c);
        if (!occupied.has(k)) {
          remainingCells.push({ r, c });
        }
      }
    }
    const shuffledRem = [...remainingCells].sort(() => Math.random() - 0.5);
    const obstacles = new Set<string>();

    for (const cell of shuffledRem) {
      if (obstacles.size >= clampedObstacles) break;
      if (Math.abs(cell.r - START_POS.r) + Math.abs(cell.c - START_POS.c) <= 1)
        continue;
      const k = coordKey(cell.r, cell.c);
      obstacles.add(k);
      occupied.add(k);
    }

    // 3. Tempatkan 4 opsi jawaban (A, B, C, D) di sel kosong
    const tokenCandidates = shuffledRem.filter((cell) => {
      const k = coordKey(cell.r, cell.c);
      if (occupied.has(k)) return false;
      if (attempt < 100 && (cell.r === START_POS.r || cell.c === START_POS.c)) {
        return false;
      }
      return true;
    });

    if (tokenCandidates.length < 4) continue;

    const tokens = {} as Record<OptionKey, Coord>;
    optionKeys.forEach((opt, idx) => {
      tokens[opt] = tokenCandidates[idx];
    });

    if (isFluxLayoutPlayable(tokens, obstacles, pillars)) {
      return { tokens, obstacles, pillars };
    }
  }

  // Fallback terverifikasi 100% playable
  return {
    tokens: {
      A: { r: 1, c: 2 },
      B: { r: 0, c: 5 },
      C: { r: 3, c: 4 },
      D: { r: 4, c: 1 },
    },
    obstacles: new Set(["2,0", "5,4"]),
    pillars: [
      { r: 2, c: 2, pole: "N" },
      { r: 4, c: 3, pole: "S" },
      { r: 1, c: 4, pole: "N" },
    ],
  };
}

export default function TactiFluxBoard({
  question,
  eliminatedOptions = [],
  disabled = false,
  onAnswer,
}: TactiFluxBoardProps) {
  const { lang } = useLanguage();

  const validCorrectKeys: OptionKey[] = useMemo(
    () =>
      parseBoardOptionKeys(question.correct_options, question.correct_option),
    [question.correct_options, question.correct_option],
  );

  const isMultiple =
    Boolean(question.allow_multiple) || validCorrectKeys.length > 1;

  const { tokens, obstacles, pillars } = useMemo(
    () => generateFluxLayout(question.obstacles),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [question.id],
  );

  const pillarMap = useMemo(() => {
    const map = new Map<string, MagnetPillar>();
    pillars.forEach((p) => map.set(coordKey(p.r, p.c), p));
    return map;
  }, [pillars]);

  // Peta medan magnet + info posisi pilar induk untuk menggambar vektor gaya
  const auraMap = useMemo(() => {
    const map = new Map<string, MagnetPillar>();
    pillars.forEach((p) => {
      ORTHO_DIRS.forEach(([dr, dc]) => {
        const nr = p.r + dr;
        const nc = p.c + dc;
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) return;
        const k = coordKey(nr, nc);
        if (!obstacles.has(k) && !pillarMap.has(k)) {
          map.set(k, p);
        }
      });
    });
    return map;
  }, [pillars, obstacles, pillarMap]);

  const [orbPos, setOrbPos] = useState<Coord>(START_POS);
  const orbPosRef = useRef<Coord>(START_POS);
  const [activePath, setActivePath] = useState<Coord[]>([START_POS]);
  const [polarity, setPolarity] = useState<Polarity>("N");
  const polarityRef = useRef<Polarity>("N");
  const [lastTrail, setLastTrail] = useState<{
    path: Coord[];
    pole: Polarity;
    id: number;
  } | null>(null);
  const [movesUsed, setMovesUsed] = useState<number>(0);
  const movesUsedRef = useRef<number>(0);
  const [selectedOptions, setSelectedOptions] = useState<OptionKey[]>([]);
  const selectedOptionsRef = useRef<OptionKey[]>([]);
  const [boardLocked, setBoardLocked] = useState<boolean>(false);
  const [hasWrongResult, setHasWrongResult] = useState<boolean>(false);

  useEffect(() => {
    setOrbPos(START_POS);
    orbPosRef.current = START_POS;
    setActivePath([START_POS]);
    setPolarity("N");
    polarityRef.current = "N";
    setLastTrail(null);
    setMovesUsed(0);
    movesUsedRef.current = 0;
    setSelectedOptions([]);
    selectedOptionsRef.current = [];
    setBoardLocked(false);
    setHasWrongResult(false);
  }, [question.id]);

  const isInteractionDisabled = disabled || boardLocked;

  const activeTokenMap = useMemo(() => {
    const map = new Map<string, OptionKey>();
    (["A", "B", "C", "D"] as OptionKey[]).forEach((opt) => {
      if (eliminatedOptions.includes(opt) || selectedOptions.includes(opt)) {
        return;
      }
      const tPos = tokens[opt];
      if (tPos) map.set(coordKey(tPos.r, tPos.c), opt);
    });
    return map;
  }, [tokens, eliminatedOptions, selectedOptions]);

  const pulseOutcomes = useMemo(() => {
    const map = {} as Record<PulseDir, PulseOutcome>;
    ALL_DIRS.forEach((dir) => {
      map[dir] = simulateFluxPulse(
        orbPos,
        dir,
        polarity,
        obstacles,
        pillarMap,
        activeTokenMap,
      );
    });
    return map;
  }, [orbPos, polarity, obstacles, pillarMap, activeTokenMap]);

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

  const handleFlipPolarity = useCallback(() => {
    if (isInteractionDisabled) return;
    sound.playPowerUp();
    const nextPole: Polarity = polarityRef.current === "N" ? "S" : "N";
    polarityRef.current = nextPole;
    setPolarity(nextPole);
    setActivePath([orbPosRef.current]);

    const nextMoves = movesUsedRef.current + 1;
    movesUsedRef.current = nextMoves;
    setMovesUsed(nextMoves);
  }, [isInteractionDisabled]);

  const handlePulse = useCallback(
    (dir: PulseDir) => {
      if (isInteractionDisabled) return;

      const currentPos = orbPosRef.current;
      const currentPole = polarityRef.current;
      const outcome = simulateFluxPulse(
        currentPos,
        dir,
        currentPole,
        obstacles,
        pillarMap,
        activeTokenMap,
      );

      if (outcome.dest.r === currentPos.r && outcome.dest.c === currentPos.c) {
        return;
      }

      const nextMoves = movesUsedRef.current + 1;
      movesUsedRef.current = nextMoves;
      setMovesUsed(nextMoves);

      setLastTrail({
        path: outcome.path,
        pole: currentPole,
        id: nextMoves,
      });

      setActivePath(outcome.path);
      orbPosRef.current = outcome.dest;
      setOrbPos(outcome.dest);

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
        onAnswer(hitOpt, isCorrect, nextMoves);
        return;
      }

      // Mode Multiple Answers: biarkan lanjut meski pilihan pertama salah
      const currSelected = selectedOptionsRef.current;
      const nextSelected = currSelected.includes(hitOpt)
        ? currSelected
        : [...currSelected, hitOpt];
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
      pillarMap,
      activeTokenMap,
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
      Math.max(1, movesUsedRef.current),
    );
  };

  const handleResetPosition = () => {
    if (isInteractionDisabled) return;
    const curr = orbPosRef.current;
    if (
      curr.r === START_POS.r &&
      curr.c === START_POS.c &&
      polarityRef.current === "N"
    ) {
      return;
    }
    sound.playMove();
    setLastTrail(null);
    setActivePath([START_POS]);
    orbPosRef.current = START_POS;
    setOrbPos(START_POS);
    polarityRef.current = "N";
    setPolarity("N");
    const nextMoves = movesUsedRef.current + 1;
    movesUsedRef.current = nextMoves;
    setMovesUsed(nextMoves);
  };

  useEffect(() => {
    if (isInteractionDisabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "f" || e.key === "F" || e.key === " ") {
        e.preventDefault();
        handleFlipPolarity();
        return;
      }

      let dir: PulseDir | null = null;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") dir = "UP";
      else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S")
        dir = "DOWN";
      else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A")
        dir = "LEFT";
      else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D")
        dir = "RIGHT";
      else return;

      e.preventDefault();
      handlePulse(dir);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isInteractionDisabled, handleFlipPolarity, handlePulse]);

  const landingByCell = useMemo(() => {
    const map = new Map<string, PulseOutcome>();
    if (isInteractionDisabled) return map;

    ALL_DIRS.forEach((dir) => {
      const out = pulseOutcomes[dir];
      if (out.dest.r !== orbPos.r || out.dest.c !== orbPos.c) {
        map.set(coordKey(out.dest.r, out.dest.c), out);
      }
    });
    return map;
  }, [pulseOutcomes, orbPos, isInteractionDisabled]);

  const validLandingsList = useMemo(
    () => Array.from(landingByCell.values()),
    [landingByCell],
  );

  const canMoveDir = (dir: PulseDir) => {
    if (isInteractionDisabled) return false;
    const out = pulseOutcomes[dir];
    return out.dest.r !== orbPos.r || out.dest.c !== orbPos.c;
  };

  const leftKeyframes = activePath.map((p) => `${(p.c / BOARD_SIZE) * 100}%`);
  const topKeyframes = activePath.map((p) => `${(p.r / BOARD_SIZE) * 100}%`);

  return (
    <div className="flex flex-col gap-3">
      {/* Electromagnetic Flux HUD Header */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-slate-900 via-[#1E1035] to-slate-900 border border-violet-500/35 text-white shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-400/45 flex items-center justify-center text-violet-200 shrink-0">
            <Atom className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-black text-xs sm:text-sm text-white tracking-tight truncate">
                TactiFlux
              </p>
              <span className="px-1.5 py-0.5 rounded-md bg-violet-500/25 text-violet-200 text-[9px] font-black uppercase tracking-wider">
                Flux Lab
              </span>
            </div>
            <p className="text-[11px] font-medium text-violet-100/80 truncate">
              {lang === "EN"
                ? "Arrows around magnets show push (same) or pull (opposite)!"
                : "Panah di sekitar magnet menunjukkan arah dorong atau tarik!"}
            </p>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-xl bg-white/10 border border-white/15 text-[11px] font-black text-violet-100 shrink-0">
          {lang === "EN" ? `Moves: ${movesUsed}` : `Aksi: ${movesUsed}`}
        </span>
      </div>

      {/* HUD Khusus Multiple Answers */}
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

      {/* Arena Medan Magnet 6x6 */}
      <motion.div
        animate={hasWrongResult ? { x: [0, -7, 7, -5, 5, 0] } : { x: 0 }}
        transition={{ duration: 0.35 }}
        className={`relative aspect-square w-full max-w-[385px] mx-auto rounded-2xl overflow-hidden border-4 shadow-xl bg-[#090D1A] select-none transition-colors ${
          hasWrongResult ? "border-rose-500" : "border-slate-900"
        }`}
      >
        {/* Layer 1: SVG Multi-Segment Trajectory & Plasma Trail */}
        <svg
          viewBox="0 0 600 600"
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        >
          {/* Jejak pulsa magnet terakhir (mengikuti titik belok) */}
          {lastTrail && lastTrail.path.length > 1 && (
            <motion.polyline
              key={`flux-trail-${lastTrail.id}`}
              points={lastTrail.path
                .map((pt) => `${(pt.c + 0.5) * 100},${(pt.r + 0.5) * 100}`)
                .join(" ")}
              fill="none"
              stroke={lastTrail.pole === "N" ? "#fb7185" : "#38bdf8"}
              strokeWidth="16"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ opacity: 0.65 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
            />
          )}

          {/* Garis panduan lintasan lengkap beserta belokan pantulan magnet */}
          {!isInteractionDisabled &&
            validLandingsList.map((out) => (
              <g key={`flux-guide-${out.dir}`}>
                <polyline
                  points={out.path
                    .map((pt) => `${(pt.c + 0.5) * 100},${(pt.r + 0.5) * 100}`)
                    .join(" ")}
                  fill="none"
                  stroke={
                    out.hitOption
                      ? "#fbbf24"
                      : polarity === "N"
                        ? "#fb7185"
                        : "#38bdf8"
                  }
                  strokeWidth="3.5"
                  strokeDasharray="7 8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={out.hitOption ? "0.65" : "0.35"}
                />
                {out.deflected && out.path.length >= 3 && (
                  <circle
                    cx={(out.path[out.path.length - 2].c + 0.5) * 100}
                    cy={(out.path[out.path.length - 2].r + 0.5) * 100}
                    r="8"
                    fill="#fbbf24"
                    opacity="0.7"
                  />
                )}
              </g>
            ))}
        </svg>

        {/* Layer 2: Grid Sel Medan Magnet 6x6 */}
        <div className="w-full h-full grid grid-cols-6 grid-rows-6">
          {Array.from({ length: BOARD_SIZE }).map((_, r) =>
            Array.from({ length: BOARD_SIZE }).map((__, c) => {
              const key = coordKey(r, c);
              const isDark = (r + c) % 2 === 1;
              const isObstacle = obstacles.has(key);
              const pillarHere = pillarMap.get(key);
              const parentPillar = auraMap.get(key);
              const landingOutcome = landingByCell.get(key);

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

              // Hitung arah vektor gaya pada petak medan magnet (menjauh jika kutub sama, mendekat jika kutub beda)
              let fieldVectorArrow: string | null = null;
              let isRepelField = false;
              if (parentPillar) {
                isRepelField = parentPillar.pole === polarity;
                const vecDr = isRepelField
                  ? r - parentPillar.r
                  : parentPillar.r - r;
                const vecDc = isRepelField
                  ? c - parentPillar.c
                  : parentPillar.c - c;
                fieldVectorArrow = getVectorArrow(vecDr, vecDc);
              }

              let cellBg = isDark ? "bg-[#0D1326]" : "bg-[#121A33]";
              if (parentPillar?.pole === "N") {
                cellBg = "bg-rose-950/55 ring-1 ring-inset ring-rose-500/25";
              } else if (parentPillar?.pole === "S") {
                cellBg = "bg-sky-950/60 ring-1 ring-inset ring-sky-500/25";
              }

              if (landingOutcome && showActiveToken) {
                cellBg = "bg-amber-400/25 ring-2 ring-inset ring-amber-400";
              } else if (landingOutcome) {
                cellBg =
                  "bg-violet-500/25 hover:bg-violet-500/35 ring-1 ring-inset ring-violet-400/75";
              }

              return (
                <button
                  key={key}
                  type="button"
                  disabled={!landingOutcome || isInteractionDisabled}
                  onClick={() =>
                    landingOutcome && handlePulse(landingOutcome.dir)
                  }
                  className={`relative flex items-center justify-center border border-slate-800/75 transition-colors duration-150 ${cellBg} ${
                    landingOutcome && !isInteractionDisabled
                      ? "cursor-pointer"
                      : "cursor-default"
                  }`}
                >
                  {/* Panah Vektor Medan Magnet (Menunjukkan arah dorong / tarik sesuai polaritas bola) */}
                  {fieldVectorArrow &&
                    !(orbPos.r === r && orbPos.c === c) &&
                    !showActiveToken &&
                    !landingOutcome && (
                      <span
                        className={`text-[10px] font-black pointer-events-none ${
                          isRepelField
                            ? "text-amber-300/65"
                            : "text-emerald-300/65"
                        }`}
                      >
                        {fieldVectorArrow}
                      </span>
                    )}

                  {/* Indikator Panah Titik Henti Pulsa */}
                  {landingOutcome &&
                    !showActiveToken &&
                    !(orbPos.r === r && orbPos.c === c) && (
                      <span className="z-10 w-6 h-6 rounded-full bg-violet-400/30 border border-violet-300/40 text-violet-100 font-black text-[10px] flex items-center justify-center pointer-events-none">
                        {PULSE_DELTAS[landingOutcome.dir].arrow}
                      </span>
                    )}

                  {/* Tembok Penghalang */}
                  {isObstacle && (
                    <div className="z-10 w-[82%] h-[82%] rounded-xl bg-gradient-to-b from-slate-700 to-slate-800 border border-slate-500/60 shadow-inner flex items-center justify-center pointer-events-none">
                      <span className="text-base sm:text-lg drop-shadow-xs">
                        🧱
                      </span>
                    </div>
                  )}

                  {/* Pilar Magnet Tetap (N+ / S−) */}
                  {pillarHere && (
                    <div
                      className={`z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex flex-col items-center justify-center font-black text-white shadow-lg border-b-4 pointer-events-none ${
                        pillarHere.pole === "N"
                          ? "bg-gradient-to-br from-rose-500 to-red-700 border-rose-950 shadow-[0_0_14px_rgba(244,63,94,0.45)]"
                          : "bg-gradient-to-br from-sky-500 to-blue-700 border-sky-950 shadow-[0_0_14px_rgba(14,165,233,0.45)]"
                      }`}
                    >
                      <span className="text-xs leading-none">
                        {pillarHere.pole === "N" ? "N+" : "S−"}
                      </span>
                      <span className="text-[8px] opacity-85 leading-none mt-0.5">
                        {pillarHere.pole === polarity
                          ? lang === "EN"
                            ? "PUSH"
                            : "TOLAK"
                          : lang === "EN"
                            ? "PULL"
                            : "TARIK"}
                      </span>
                    </div>
                  )}

                  {/* Badge Opsi Sudah Dipilih */}
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
                      {landingOutcome && (
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

        {/* Layer 3: Inti Energi Bermuatan Pemain (Multi-Waypoint 60fps Glide) */}
        <motion.div
          initial={false}
          animate={{
            left: leftKeyframes.length > 1 ? leftKeyframes : leftKeyframes[0],
            top: topKeyframes.length > 1 ? topKeyframes : topKeyframes[0],
          }}
          transition={{
            duration: activePath.length > 2 ? 0.34 : 0.22,
            ease: "easeOut",
          }}
          style={{
            width: `${100 / BOARD_SIZE}%`,
            height: `${100 / BOARD_SIZE}%`,
          }}
          className="absolute z-20 p-1 flex items-center justify-center pointer-events-none"
        >
          <div
            className={`w-full h-full rounded-full text-white flex flex-col items-center justify-center shadow-lg border-b-4 ring-2 ring-white/80 transition-colors duration-200 ${
              polarity === "N"
                ? "bg-gradient-to-br from-rose-500 to-red-600 border-red-900 shadow-[0_0_18px_rgba(244,63,94,0.7)]"
                : "bg-gradient-to-br from-sky-500 to-blue-600 border-blue-900 shadow-[0_0_18px_rgba(14,165,233,0.7)]"
            }`}
          >
            <span className="text-sm sm:text-base font-black leading-none">
              {polarity === "N" ? "N+" : "S−"}
            </span>
            <span className="text-[8px] font-extrabold uppercase tracking-wider opacity-85 mt-0.5">
              ORB
            </span>
          </div>
        </motion.div>
      </motion.div>

      {/* Tombol Flip Polaritas (+ <-> -) */}
      <button
        type="button"
        disabled={isInteractionDisabled}
        onClick={handleFlipPolarity}
        className={`w-full py-2.5 px-4 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-between border-2 border-b-4 transition cursor-pointer disabled:opacity-50 ${
          polarity === "N"
            ? "bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-800"
            : "bg-sky-50 hover:bg-sky-100 border-sky-300 text-sky-800"
        }`}
      >
        <span className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          <span>
            {lang === "EN"
              ? "Flip Orb Polarity (F / Space)"
              : "Balik Polaritas Bola (F / Spasi)"}
          </span>
        </span>
        <span
          className={`px-2.5 py-0.5 rounded-lg text-white text-xs font-black ${
            polarity === "N" ? "bg-rose-600" : "bg-sky-600"
          }`}
        >
          {polarity === "N"
            ? lang === "EN"
              ? "North (N+)"
              : "Utara (N+)"
            : lang === "EN"
              ? "South (S−)"
              : "Selatan (S−)"}
        </span>
      </button>

      {/* Bar Kontrol Pulsa 4 Arah & Reset */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1">
          <button
            type="button"
            disabled={!canMoveDir("LEFT")}
            onClick={() => handlePulse("LEFT")}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-violet-100 active:scale-95 disabled:opacity-35 text-slate-700 font-black flex items-center justify-center border-b-2 border-slate-300 transition cursor-pointer disabled:cursor-default"
            title="Pulse Left"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canMoveDir("UP")}
            onClick={() => handlePulse("UP")}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-violet-100 active:scale-95 disabled:opacity-35 text-slate-700 font-black flex items-center justify-center border-b-2 border-slate-300 transition cursor-pointer disabled:cursor-default"
            title="Pulse Up"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canMoveDir("DOWN")}
            onClick={() => handlePulse("DOWN")}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-violet-100 active:scale-95 disabled:opacity-35 text-slate-700 font-black flex items-center justify-center border-b-2 border-slate-300 transition cursor-pointer disabled:cursor-default"
            title="Pulse Down"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canMoveDir("RIGHT")}
            onClick={() => handlePulse("RIGHT")}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-violet-100 active:scale-95 disabled:opacity-35 text-slate-700 font-black flex items-center justify-center border-b-2 border-slate-300 transition cursor-pointer disabled:cursor-default"
            title="Pulse Right"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          disabled={
            isInteractionDisabled ||
            (orbPos.r === START_POS.r &&
              orbPos.c === START_POS.c &&
              polarity === "N")
          }
          onClick={handleResetPosition}
          className="px-3.5 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 disabled:opacity-40 text-amber-800 border border-amber-200 border-b-2 font-black text-xs inline-flex items-center gap-1 transition cursor-pointer disabled:cursor-default shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{lang === "EN" ? "Reset" : "Awal"}</span>
        </button>
      </div>
    </div>
  );
}
