"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Sparkles,
  Crosshair,
  RotateCcw,
  Send,
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

interface MirrorNode {
  id: number;
  r: number;
  c: number;
}

interface LaserTraceResult {
  points: Coord[];
  hitOption: OptionKey | null;
  endType: "EDGE" | "OBSTACLE" | "OPTION" | "EMITTER" | "LOOP";
}

interface TactiMirrorBoardProps {
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
const EMITTER_POS: Coord = { r: 5, c: 0 };
const INITIAL_DIR = { dr: 0, dc: 1 }; // Menembak ke kanan

function coordKey(r: number, c: number): string {
  return `${r},${c}`;
}

function normalizeAngleDeg(step: number): number {
  const mod = ((step % 8) + 8) % 8;
  return mod * 45;
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

function reflectDirection(
  dr: number,
  dc: number,
  rotationStep: number,
): { dr: number; dc: number } {
  const mod = ((rotationStep % 4) + 4) % 4;

  if (mod === 0) {
    return dr === 0 ? { dr, dc } : { dr: -dr, dc: 0 };
  }
  if (mod === 1) {
    return { dr: dc, dc: dr };
  }
  if (mod === 2) {
    return dc === 0 ? { dr, dc } : { dr: 0, dc: -dc };
  }
  return { dr: -dc, dc: -dr };
}

function traceLaserOptionIndexFast(
  mirrorGrid: Int8Array,
  steps: Int8Array,
  tokenGrid: Int8Array,
  obsGrid: Uint8Array,
  visitedBuf: Uint8Array,
): number {
  visitedBuf.fill(0);
  let r = EMITTER_POS.r;
  let c = EMITTER_POS.c;
  let dr = INITIAL_DIR.dr;
  let dc = INITIAL_DIR.dc;

  for (let step = 0; step < 54; step++) {
    const nr = r + dr;
    const nc = c + dc;

    if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) return -1;
    if (nr === EMITTER_POS.r && nc === EMITTER_POS.c) return -1;

    const dirCode = dc === 1 ? 0 : dr === 1 ? 1 : dc === -1 ? 2 : 3;
    const cellIdx = nr * BOARD_SIZE + nc;
    const stateIdx = cellIdx * 4 + dirCode;

    if (visitedBuf[stateIdx]) return -1;
    visitedBuf[stateIdx] = 1;

    if (obsGrid[cellIdx]) return -1;

    const tok = tokenGrid[cellIdx];
    if (tok >= 0) return tok;

    const mId = mirrorGrid[cellIdx];
    if (mId >= 0) {
      const mod = steps[mId] & 3;
      if (mod === 0) {
        if (dr !== 0) dr = -dr;
      } else if (mod === 1) {
        const tmp = dr;
        dr = dc;
        dc = tmp;
      } else if (mod === 2) {
        if (dc !== 0) dc = -dc;
      } else {
        const tmp = dr;
        dr = -dc;
        dc = -tmp;
      }
    }

    r = nr;
    c = nc;
  }

  return -1;
}

function traceLaserBeamDetailed(
  mirrorMap: Map<string, MirrorNode>,
  rotationSteps: Record<number, number>,
  tokenMap: Map<string, OptionKey>,
  obstacles: Set<string>,
): LaserTraceResult {
  const points: Coord[] = [{ ...EMITTER_POS }];
  let r = EMITTER_POS.r;
  let c = EMITTER_POS.c;
  let dr = INITIAL_DIR.dr;
  let dc = INITIAL_DIR.dc;

  const visitedStates = new Set<string>();

  for (let step = 0; step < 54; step++) {
    const nr = r + dr;
    const nc = c + dc;

    if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) {
      points.push({ r: r + dr * 0.48, c: c + dc * 0.48 });
      return { points, hitOption: null, endType: "EDGE" };
    }

    if (nr === EMITTER_POS.r && nc === EMITTER_POS.c) {
      points.push({ r: nr, c: nc });
      return { points, hitOption: null, endType: "EMITTER" };
    }

    const stateSig = `${nr},${nc},${dr},${dc}`;
    if (visitedStates.has(stateSig)) {
      points.push({ r: nr, c: nc });
      return { points, hitOption: null, endType: "LOOP" };
    }
    visitedStates.add(stateSig);

    const k = coordKey(nr, nc);
    points.push({ r: nr, c: nc });

    if (obstacles.has(k)) {
      return { points, hitOption: null, endType: "OBSTACLE" };
    }

    const hitOpt = tokenMap.get(k);
    if (hitOpt) {
      return { points, hitOption: hitOpt, endType: "OPTION" };
    }

    const mirror = mirrorMap.get(k);
    if (mirror) {
      const nextDir = reflectDirection(dr, dc, rotationSteps[mirror.id] ?? 0);
      dr = nextDir.dr;
      dc = nextDir.dc;
    }

    r = nr;
    c = nc;
  }

  return { points, hitOption: null, endType: "LOOP" };
}

function generateMirrorLayout(obstacleCount: number): {
  mirrors: MirrorNode[];
  initialSteps: Record<number, number>;
  tokens: Record<OptionKey, Coord>;
  obstacles: Set<string>;
} {
  const optionKeys: OptionKey[] = ["A", "B", "C", "D"];
  const clampedObstacles = Math.max(0, Math.min(4, obstacleCount || 0));

  const mirrorGrid = new Int8Array(36);
  const tokenGrid = new Int8Array(36);
  const obsGrid = new Uint8Array(36);
  const stepsBuf = new Int8Array(6);
  const visitedBuf = new Uint8Array(36 * 4);

  for (let attempt = 0; attempt < 90; attempt++) {
    const occupied = new Set<string>([coordKey(EMITTER_POS.r, EMITTER_POS.c)]);
    const mirrors: MirrorNode[] = [];

    const firstCol = 1 + Math.floor(Math.random() * 5);
    mirrors.push({ id: 0, r: 5, c: firstCol });
    occupied.add(coordKey(5, firstCol));

    const innerCells: Coord[] = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (!occupied.has(coordKey(r, c))) {
          innerCells.push({ r, c });
        }
      }
    }
    const shuffledForMirrors = [...innerCells].sort(() => Math.random() - 0.5);
    for (let i = 0; i < 5; i++) {
      const cell = shuffledForMirrors[i];
      mirrors.push({ id: i + 1, r: cell.r, c: cell.c });
      occupied.add(coordKey(cell.r, cell.c));
    }

    const tokenCandidates: Coord[] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (r === 5 && c <= firstCol) continue;
        if (!occupied.has(coordKey(r, c))) {
          tokenCandidates.push({ r, c });
        }
      }
    }
    if (tokenCandidates.length < 4) continue;

    const shuffledTokens = [...tokenCandidates].sort(() => Math.random() - 0.5);
    const tokens = {} as Record<OptionKey, Coord>;

    mirrorGrid.fill(-1);
    tokenGrid.fill(-1);
    obsGrid.fill(0);

    mirrors.forEach((m) => {
      mirrorGrid[m.r * BOARD_SIZE + m.c] = m.id;
    });

    optionKeys.forEach((opt, idx) => {
      tokens[opt] = shuffledTokens[idx];
      occupied.add(coordKey(shuffledTokens[idx].r, shuffledTokens[idx].c));
      tokenGrid[shuffledTokens[idx].r * BOARD_SIZE + shuffledTokens[idx].c] =
        idx;
    });

    let reachableMask = 0;
    let validInitialMask = -1;

    for (let mask = 0; mask < 4096; mask++) {
      for (let id = 0; id < 6; id++) {
        stepsBuf[id] = (mask >> (id * 2)) & 3;
      }

      const hitIdx = traceLaserOptionIndexFast(
        mirrorGrid,
        stepsBuf,
        tokenGrid,
        obsGrid,
        visitedBuf,
      );
      if (hitIdx >= 0) {
        reachableMask |= 1 << hitIdx;
      } else if (validInitialMask < 0) {
        validInitialMask = mask;
      }
    }

    if (reachableMask !== 15 || validInitialMask < 0) {
      continue;
    }

    const obstacleCandidates: Coord[] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (r === 5 && c <= firstCol) continue;
        if (!occupied.has(coordKey(r, c))) {
          obstacleCandidates.push({ r, c });
        }
      }
    }
    const shuffledObs = [...obstacleCandidates].sort(() => Math.random() - 0.5);
    const obstacles = new Set<string>();

    for (const obsCell of shuffledObs) {
      if (obstacles.size >= clampedObstacles) break;
      const cellIdx = obsCell.r * BOARD_SIZE + obsCell.c;
      obsGrid[cellIdx] = 1;

      let testMask = 0;
      for (let mask = 0; mask < 4096; mask++) {
        for (let id = 0; id < 6; id++) {
          stepsBuf[id] = (mask >> (id * 2)) & 3;
        }
        const hitIdx = traceLaserOptionIndexFast(
          mirrorGrid,
          stepsBuf,
          tokenGrid,
          obsGrid,
          visitedBuf,
        );
        if (hitIdx >= 0) testMask |= 1 << hitIdx;
      }

      if (testMask === 15) {
        obstacles.add(coordKey(obsCell.r, obsCell.c));
      } else {
        obsGrid[cellIdx] = 0;
      }
    }

    const initialSteps: Record<number, number> = {};
    mirrors.forEach((m) => {
      initialSteps[m.id] = (validInitialMask >> (m.id * 2)) & 3;
    });

    return { mirrors, initialSteps, tokens, obstacles };
  }

  return {
    mirrors: [
      { id: 0, r: 5, c: 2 },
      { id: 1, r: 2, c: 2 },
      { id: 2, r: 2, c: 4 },
      { id: 3, r: 4, c: 4 },
      { id: 4, r: 1, c: 2 },
      { id: 5, r: 1, c: 4 },
    ],
    initialSteps: {
      0: 2,
      1: 3,
      2: 3,
      3: 1,
      4: 3,
      5: 0,
    },
    tokens: {
      A: { r: 2, c: 0 },
      B: { r: 4, c: 5 },
      C: { r: 1, c: 0 },
      D: { r: 1, c: 5 },
    },
    obstacles: new Set(),
  };
}

export default function TactiMirrorBoard({
  question,
  eliminatedOptions = [],
  disabled = false,
  onAnswer,
}: TactiMirrorBoardProps) {
  const { lang } = useLanguage();

  const validCorrectKeys: OptionKey[] = useMemo(
    () =>
      parseBoardOptionKeys(question.correct_options, question.correct_option),
    [question.correct_options, question.correct_option],
  );

  const isMultiple =
    Boolean(question.allow_multiple) || validCorrectKeys.length > 1;

  const { mirrors, initialSteps, tokens, obstacles } = useMemo(
    () => generateMirrorLayout(question.obstacles),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [question.id],
  );

  const [rotationSteps, setRotationSteps] =
    useState<Record<number, number>>(initialSteps);
  const [rotationsUsed, setRotationsUsed] = useState<number>(0);
  const [selectedOptions, setSelectedOptions] = useState<OptionKey[]>([]);
  const [boardLocked, setBoardLocked] = useState<boolean>(false);
  const [hasWrongResult, setHasWrongResult] = useState<boolean>(false);
  const [firePulseNonce, setFirePulseNonce] = useState<number>(0);

  useEffect(() => {
    setRotationSteps(initialSteps);
    setRotationsUsed(0);
    setSelectedOptions([]);
    setBoardLocked(false);
    setHasWrongResult(false);
    setFirePulseNonce(0);
  }, [question.id, initialSteps]);

  const isInteractionDisabled = disabled || boardLocked;

  const mirrorMap = useMemo(() => {
    const map = new Map<string, MirrorNode>();
    mirrors.forEach((m) => map.set(coordKey(m.r, m.c), m));
    return map;
  }, [mirrors]);

  // Opsi yang sudah dipilih ditembus sinar laser agar tidak menghalangi bidikan opsi berikutnya
  const activeTokenMap = useMemo(() => {
    const map = new Map<string, OptionKey>();
    (["A", "B", "C", "D"] as OptionKey[]).forEach((opt) => {
      if (eliminatedOptions.includes(opt) || selectedOptions.includes(opt)) {
        return;
      }
      const tPos = tokens[opt];
      if (tPos) {
        map.set(coordKey(tPos.r, tPos.c), opt);
      }
    });
    return map;
  }, [tokens, eliminatedOptions, selectedOptions]);

  const laserTrace = useMemo(
    () =>
      traceLaserBeamDetailed(
        mirrorMap,
        rotationSteps,
        activeTokenMap,
        obstacles,
      ),
    [mirrorMap, rotationSteps, activeTokenMap, obstacles],
  );

  const lockedTarget = laserTrace.hitOption;

  const handleRotateMirror = (mirrorId: number, delta: 1 | -1 = 1) => {
    if (isInteractionDisabled) return;
    sound.playMove();
    setRotationsUsed((prev) => prev + 1);
    setRotationSteps((prev) => ({
      ...prev,
      [mirrorId]: (prev[mirrorId] ?? 0) + delta,
    }));
  };

  const handleResetMirrors = () => {
    if (isInteractionDisabled || rotationsUsed === 0) return;
    sound.playMove();
    setRotationSteps(initialSteps);
    setRotationsUsed((prev) => prev + 1);
  };

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

  const handleFireLaser = useCallback(() => {
    if (isInteractionDisabled || !lockedTarget) return;

    setFirePulseNonce((n) => n + 1);
    const hitOpt = lockedTarget;
    const movesScore = Math.max(1, rotationsUsed);

    if (!isMultiple) {
      const isCorrect = validCorrectKeys.includes(hitOpt);
      if (isCorrect) {
        sound.playCorrect();
      } else {
        sound.playWrong();
        setHasWrongResult(true);
      }
      setSelectedOptions([hitOpt]);
      setBoardLocked(true);
      onAnswer(hitOpt, isCorrect, movesScore);
      return;
    }

    // Mode Multiple Answers: biarkan siswa lanjut memilih meski pilihan pertama salah
    const nextSelected = selectedOptions.includes(hitOpt)
      ? selectedOptions
      : [...selectedOptions, hitOpt];
    setSelectedOptions(nextSelected);

    if (nextSelected.length >= validCorrectKeys.length) {
      finalizeMultipleSelection(nextSelected, movesScore);
    } else {
      sound.playPowerUp();
    }
  }, [
    isInteractionDisabled,
    lockedTarget,
    rotationsUsed,
    isMultiple,
    validCorrectKeys,
    selectedOptions,
    onAnswer,
    finalizeMultipleSelection,
  ]);

  const handleManualSubmitMultiple = () => {
    if (isInteractionDisabled || !isMultiple || selectedOptions.length === 0)
      return;
    finalizeMultipleSelection(selectedOptions, Math.max(1, rotationsUsed));
  };

  useEffect(() => {
    if (isInteractionDisabled || !lockedTarget) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleFireLaser();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isInteractionDisabled, lockedTarget, handleFireLaser]);

  const svgPolylinePoints = useMemo(() => {
    return laserTrace.points
      .map((pt) => `${(pt.c + 0.5) * 100},${(pt.r + 0.5) * 100}`)
      .join(" ");
  }, [laserTrace.points]);

  const beamEndPoint =
    laserTrace.points[laserTrace.points.length - 1] || EMITTER_POS;

  return (
    <div className="flex flex-col gap-3">
      {/* Cyber-Optics HUD Header */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-slate-900 via-[#0F172A] to-slate-900 border border-slate-700/80 text-white shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-xl shrink-0">
            <span>🔦</span>
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-black text-xs sm:text-sm text-white tracking-tight truncate">
                TactiMirror
              </p>
              <span className="px-1.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 text-[9px] font-black uppercase tracking-wider">
                360° Optics
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-300 truncate">
              {lang === "EN"
                ? "Tap mirrors to aim the laser beam & lock onto target"
                : "Ketuk cermin untuk membelokkan sinar laser ke target"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {lockedTarget ? (
            <span
              className={`px-2.5 py-1 rounded-xl ${OPTION_STYLES[lockedTarget].badgeBg} text-white text-[11px] font-black shadow-xs animate-pulse`}
            >
              🎯 {lockedTarget}
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-xl bg-white/10 border border-white/15 text-[11px] font-black text-slate-300">
              {lang === "EN"
                ? `Turns: ${rotationsUsed}`
                : `Putar: ${rotationsUsed}`}
            </span>
          )}
        </div>
      </div>

      {/* HUD Khusus Multiple Answers (Netral sebelum selesai, lalu evaluasi di akhir) */}
      {isMultiple && (
        <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50/80 border-2 border-amber-300 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              {lang === "EN"
                ? `Select ${validCorrectKeys.length} Targets (${selectedOptions.length}/${validCorrectKeys.length})`
                : `Pilih ${validCorrectKeys.length} Target Jawaban (${selectedOptions.length}/${validCorrectKeys.length})`}
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

      {/* Papan Arena Optik 6x6 */}
      <motion.div
        key={`board-pulse-${firePulseNonce}`}
        animate={
          hasWrongResult
            ? { x: [0, -7, 7, -5, 5, 0] }
            : firePulseNonce > 0
              ? { scale: [1, 1.015, 1] }
              : { scale: 1 }
        }
        transition={{ duration: 0.3 }}
        className={`relative aspect-square w-full max-w-[385px] mx-auto rounded-2xl overflow-hidden border-4 shadow-xl bg-[#070D19] select-none transition-colors ${
          hasWrongResult
            ? "border-rose-500"
            : lockedTarget
              ? "border-rose-400/90"
              : "border-slate-900"
        }`}
      >
        <div className="w-full h-full grid grid-cols-6 grid-rows-6">
          {Array.from({ length: BOARD_SIZE }).map((_, r) =>
            Array.from({ length: BOARD_SIZE }).map((__, c) => {
              const key = coordKey(r, c);
              const isDark = (r + c) % 2 === 1;
              const isEmitter = r === EMITTER_POS.r && c === EMITTER_POS.c;
              const isObstacle = obstacles.has(key);
              const mirrorHere = mirrors.find((m) => m.r === r && m.c === c);

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
              const isLockedByLaser =
                tokenHere &&
                !isEliminated &&
                !isAlreadySelected &&
                lockedTarget === tokenHere;

              const currentStep = mirrorHere
                ? (rotationSteps[mirrorHere.id] ?? 0)
                : 0;
              const displayAngle = normalizeAngleDeg(currentStep);

              const cellBaseBg = isDark ? "bg-[#0A1120]" : "bg-[#0F182C]";

              if (mirrorHere) {
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={isInteractionDisabled}
                    onClick={() => handleRotateMirror(mirrorHere.id, 1)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      handleRotateMirror(mirrorHere.id, -1);
                    }}
                    title={
                      lang === "EN"
                        ? `Mirror ${displayAngle}° — Click to rotate +45° (Right-click -45°)`
                        : `Cermin ${displayAngle}° — Klik putar +45° (Klik kanan -45°)`
                    }
                    className={`group relative flex items-center justify-center border border-slate-800/75 transition-colors ${cellBaseBg} ${
                      isInteractionDisabled
                        ? "cursor-default"
                        : "cursor-pointer hover:bg-cyan-950/50 active:bg-cyan-900/60"
                    }`}
                  >
                    <div className="z-20 w-[82%] h-[82%] rounded-2xl bg-gradient-to-b from-cyan-500/15 to-sky-900/25 border border-cyan-400/55 group-hover:border-cyan-300 group-hover:shadow-[0_0_14px_rgba(34,211,238,0.3)] flex items-center justify-center transition-all">
                      <motion.div
                        animate={{ rotate: currentStep * 45 }}
                        transition={{
                          type: "spring",
                          stiffness: 340,
                          damping: 22,
                        }}
                        className="relative w-9 h-2.5 rounded-full bg-gradient-to-r from-cyan-300 via-white to-cyan-300 shadow-[0_0_12px_#22d3ee] flex items-center justify-center"
                      >
                        <span className="w-2 h-2 rounded-full bg-cyan-500 border border-white" />
                      </motion.div>
                    </div>

                    <span className="z-20 text-[8px] font-black text-cyan-200/90 bg-slate-950/75 px-1 rounded absolute bottom-1 right-1 leading-tight pointer-events-none">
                      {displayAngle}°
                    </span>
                  </button>
                );
              }

              return (
                <div
                  key={key}
                  className={`relative flex items-center justify-center border border-slate-800/75 transition-colors duration-200 ${cellBaseBg} ${
                    isLockedByLaser
                      ? "bg-rose-950/75 ring-2 ring-inset ring-rose-400"
                      : ""
                  }`}
                >
                  <span className="w-1 h-1 rounded-full bg-slate-700/60 pointer-events-none" />

                  {isEmitter && (
                    <div className="z-20 w-[84%] h-[84%] rounded-2xl bg-gradient-to-br from-rose-500 to-red-700 text-white flex items-center justify-center shadow-[0_0_16px_rgba(244,63,94,0.65)] border-b-4 border-rose-950">
                      <span className="text-xl leading-none">🔦</span>
                      <span className="absolute right-0.5 w-2 h-3 rounded-r-full bg-amber-300 shadow-[0_0_8px_#fcd34d]" />
                    </div>
                  )}

                  {isObstacle && (
                    <div className="z-20 w-[82%] h-[82%] rounded-xl bg-gradient-to-b from-slate-700 to-slate-800 border border-slate-500/60 shadow-inner flex items-center justify-center pointer-events-none">
                      <span className="text-base sm:text-lg drop-shadow-xs">
                        🧱
                      </span>
                    </div>
                  )}

                  {/* Opsi yang sudah dipilih (Netral saat berlangsung, Hijau/Merah setelah babak selesai) */}
                  {tokenHere && isAlreadySelected && (
                    <motion.div
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-xl border-2 font-black text-xs flex items-center justify-center pointer-events-none ${
                        !boardLocked
                          ? "bg-indigo-500/30 border-indigo-400 text-indigo-200 shadow-[0_0_14px_rgba(99,102,241,0.45)]"
                          : validCorrectKeys.includes(tokenHere)
                            ? "bg-emerald-500/30 border-emerald-400 text-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.5)]"
                            : "bg-rose-500/35 border-rose-400 text-rose-200 shadow-[0_0_14px_rgba(244,63,94,0.5)]"
                      }`}
                    >
                      {!boardLocked ? (
                        <>●{tokenHere}</>
                      ) : validCorrectKeys.includes(tokenHere) ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-0.5" />
                          {tokenHere}
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 mr-0.5" />
                          {tokenHere}
                        </>
                      )}
                    </motion.div>
                  )}

                  {/* Target Pilihan Jawaban Aktif (A, B, C, D) */}
                  {tokenHere && !isEliminated && !isAlreadySelected && (
                    <div className="relative z-20 flex items-center justify-center pointer-events-none">
                      {isLockedByLaser && (
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{
                            repeat: Infinity,
                            duration: 3,
                            ease: "linear",
                          }}
                          className="absolute -inset-1.5 rounded-xl border-2 border-dashed border-amber-300"
                        />
                      )}
                      <span
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${OPTION_STYLES[tokenHere].badgeBg} text-white font-black text-sm sm:text-base flex items-center justify-center shadow-lg border-b-2 border-black/30 transition-transform ${
                          isLockedByLaser ? "scale-110 ring-2 ring-white" : ""
                        }`}
                      >
                        {tokenHere}
                      </span>
                    </div>
                  )}
                </div>
              );
            }),
          )}
        </div>

        {/* SVG Laser Beam Overlay */}
        <svg
          viewBox="0 0 600 600"
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        >
          <defs>
            <filter
              id="tacti-laser-glow"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <polyline
            points={svgPolylinePoints}
            fill="none"
            stroke={lockedTarget ? "#fbbf24" : "#fb7185"}
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.28"
            filter="url(#tacti-laser-glow)"
          />

          <polyline
            points={svgPolylinePoints}
            fill="none"
            stroke={lockedTarget ? "#f59e0b" : "#f43f5e"}
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <motion.polyline
            points={svgPolylinePoints}
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="10 18"
            animate={{ strokeDashoffset: [0, -56] }}
            transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
            opacity="0.9"
          />

          <g
            transform={`translate(${(beamEndPoint.c + 0.5) * 100}, ${(beamEndPoint.r + 0.5) * 100})`}
          >
            <motion.circle
              r="14"
              fill={lockedTarget ? "#fbbf24" : "#fb7185"}
              animate={{ scale: [0.8, 1.35, 0.8], opacity: [0.65, 0.15, 0.65] }}
              transition={{ repeat: Infinity, duration: 0.9 }}
            />
            <circle r="5" fill="#ffffff" />
          </g>
        </svg>
      </motion.div>

      {/* Bar Tombol Aksi: Tembak Laser + Reset Cermin */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isInteractionDisabled || !lockedTarget}
          onClick={handleFireLaser}
          className={`flex-1 py-3.5 px-4 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2 border-b-4 transition ${
            lockedTarget && !isInteractionDisabled
              ? "bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 active:translate-y-0.5 text-white border-rose-800 shadow-md cursor-pointer"
              : "bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed"
          }`}
        >
          <Crosshair className="w-5 h-5" />
          <span>
            {lockedTarget
              ? lang === "EN"
                ? `Fire Laser at Target ${lockedTarget}!`
                : `Tembak Laser ke Target ${lockedTarget}!`
              : lang === "EN"
                ? "Aim Laser at Any Option"
                : "Arahkan Laser ke Pilihan"}
          </span>
        </button>

        <button
          type="button"
          disabled={isInteractionDisabled || rotationsUsed === 0}
          onClick={handleResetMirrors}
          title={
            lang === "EN" ? "Reset mirror angles" : "Reset sudut semua cermin"
          }
          className="px-3.5 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 border border-slate-200 border-b-4 font-black text-xs inline-flex items-center gap-1 transition cursor-pointer disabled:cursor-default shrink-0"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="hidden sm:inline">Reset</span>
        </button>
      </div>
    </div>
  );
}
