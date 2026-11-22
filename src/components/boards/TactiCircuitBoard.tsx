"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Sparkles,
  Zap,
  AlertTriangle,
  RotateCcw,
  Send,
  Cpu,
  Check,
} from "lucide-react";
import {
  OptionKey,
  OPTION_STYLES,
  QuestionData,
} from "@/components/ChessQuizBoard";
import { useLanguage } from "@/components/LanguageProvider";
import { sound } from "@/lib/sound";

export type PipeShape = "STRAIGHT" | "ELBOW" | "TEE";
export type DirKey = "N" | "E" | "S" | "W";

interface Coord {
  r: number;
  c: number;
}

interface CircuitTile {
  r: number;
  c: number;
  shape: PipeShape;
}

interface TactiCircuitBoardProps {
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
const SOURCE_POS: Coord = { r: 2, c: 0 };

const TERMINALS: Record<OptionKey, Coord> = {
  A: { r: 0, c: 5 },
  B: { r: 1, c: 5 },
  C: { r: 4, c: 5 },
  D: { r: 5, c: 5 },
};

const DIR_DELTAS: Record<DirKey, { dr: number; dc: number; opposite: DirKey }> =
  {
    N: { dr: -1, dc: 0, opposite: "S" },
    E: { dr: 0, dc: 1, opposite: "W" },
    S: { dr: 1, dc: 0, opposite: "N" },
    W: { dr: 0, dc: -1, opposite: "E" },
  };

const ALL_DIRS: DirKey[] = ["N", "E", "S", "W"];

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

function rotateDir(dir: DirKey, steps: number): DirKey {
  const idx = ALL_DIRS.indexOf(dir);
  const normalizedSteps = ((steps % 4) + 4) % 4;
  return ALL_DIRS[(idx + normalizedSteps) % 4];
}

function getOpenPorts(shape: PipeShape, rotationStep: number): DirKey[] {
  const basePorts: Record<PipeShape, DirKey[]> = {
    STRAIGHT: ["E", "W"],
    ELBOW: ["N", "E"],
    TEE: ["W", "N", "E"],
  };
  return basePorts[shape].map((d) => rotateDir(d, rotationStep));
}

function computeCircuitFlow(
  tiles: Map<string, CircuitTile>,
  rotationSteps: Record<string, number>,
  obstacles: Set<string>,
  ignoredOptions: Set<OptionKey>,
): {
  poweredCells: Set<string>;
  poweredOptions: OptionKey[];
} {
  const poweredCells = new Set<string>([coordKey(SOURCE_POS.r, SOURCE_POS.c)]);
  const poweredOptionsSet = new Set<OptionKey>();

  const terminalByCoord = new Map<string, OptionKey>();
  (["A", "B", "C", "D"] as OptionKey[]).forEach((opt) => {
    const t = TERMINALS[opt];
    terminalByCoord.set(coordKey(t.r, t.c), opt);
  });

  const firstR = SOURCE_POS.r;
  const firstC = SOURCE_POS.c + 1;
  const firstKey = coordKey(firstR, firstC);
  const firstTile = tiles.get(firstKey);

  if (!firstTile || obstacles.has(firstKey)) {
    return { poweredCells, poweredOptions: [] };
  }

  const firstPorts = getOpenPorts(
    firstTile.shape,
    rotationSteps[firstKey] ?? 0,
  );
  if (!firstPorts.includes("W")) {
    return { poweredCells, poweredOptions: [] };
  }

  poweredCells.add(firstKey);
  const queue: Coord[] = [{ r: firstR, c: firstC }];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const currKey = coordKey(curr.r, curr.c);
    const currTile = tiles.get(currKey);
    if (!currTile) continue;

    const openPorts = getOpenPorts(currTile.shape, rotationSteps[currKey] ?? 0);

    for (const dir of openPorts) {
      const delta = DIR_DELTAS[dir];
      const nr = curr.r + delta.dr;
      const nc = curr.c + delta.dc;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;

      const nextKey = coordKey(nr, nc);
      if (obstacles.has(nextKey)) continue;

      const hitTerminal = terminalByCoord.get(nextKey);
      if (hitTerminal) {
        poweredCells.add(nextKey);
        if (!ignoredOptions.has(hitTerminal)) {
          poweredOptionsSet.add(hitTerminal);
        }
        continue;
      }

      const nextTile = tiles.get(nextKey);
      if (!nextTile || poweredCells.has(nextKey)) continue;

      const nextPorts = getOpenPorts(
        nextTile.shape,
        rotationSteps[nextKey] ?? 0,
      );
      if (nextPorts.includes(delta.opposite)) {
        poweredCells.add(nextKey);
        queue.push({ r: nr, c: nc });
      }
    }
  }

  const orderedPowered = (["A", "B", "C", "D"] as OptionKey[]).filter((opt) =>
    poweredOptionsSet.has(opt),
  );

  return { poweredCells, poweredOptions: orderedPowered };
}

function generateCircuitLayout(obstacleCount: number): {
  tilesList: CircuitTile[];
  initialSteps: Record<string, number>;
  obstacles: Set<string>;
} {
  const spineCol = 1 + Math.floor(Math.random() * 3);
  const branchRows = new Set([0, 1, 4, 5]);

  const requiredPorts = new Map<string, Set<DirKey>>();
  const addPort = (r: number, c: number, d: DirKey) => {
    const k = coordKey(r, c);
    if (!requiredPorts.has(k)) requiredPorts.set(k, new Set<DirKey>());
    requiredPorts.get(k)!.add(d);
  };

  for (let c = 1; c <= spineCol; c++) {
    addPort(SOURCE_POS.r, c, "W");
    if (c < spineCol) addPort(SOURCE_POS.r, c, "E");
  }

  for (let r = 0; r < BOARD_SIZE; r++) {
    if (r > 0) addPort(r, spineCol, "N");
    if (r < BOARD_SIZE - 1) addPort(r, spineCol, "S");
  }

  branchRows.forEach((r) => {
    for (let c = spineCol; c <= 4; c++) {
      if (c > spineCol) addPort(r, c, "W");
      addPort(r, c, "E");
    }
  });

  const tilesMap = new Map<string, CircuitTile>();
  const backboneKeys = new Set<string>();

  requiredPorts.forEach((portsSet, key) => {
    backboneKeys.add(key);
    const [rStr, cStr] = key.split(",");
    const r = Number(rStr);
    const c = Number(cStr);
    const ports = Array.from(portsSet);

    let shape: PipeShape = "STRAIGHT";
    if (ports.length >= 3) {
      shape = "TEE";
    } else if (ports.length === 2) {
      const isOpposite =
        (ports.includes("N") && ports.includes("S")) ||
        (ports.includes("E") && ports.includes("W"));
      shape = isOpposite ? "STRAIGHT" : "ELBOW";
    }

    tilesMap.set(key, { r, c, shape });
  });

  const nonBackboneCells: Coord[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 1; c <= 4; c++) {
      const k = coordKey(r, c);
      if (!backboneKeys.has(k)) {
        nonBackboneCells.push({ r, c });
      }
    }
  }

  const clampedObstacles = Math.max(0, Math.min(3, obstacleCount || 0));
  const shuffledFree = [...nonBackboneCells].sort(() => Math.random() - 0.5);
  const obstacles = new Set<string>();

  shuffledFree.slice(0, clampedObstacles).forEach((cell) => {
    obstacles.add(coordKey(cell.r, cell.c));
  });

  const decoyShapes: PipeShape[] = ["STRAIGHT", "ELBOW", "TEE"];
  shuffledFree.slice(clampedObstacles).forEach((cell) => {
    const k = coordKey(cell.r, cell.c);
    const randomShape =
      decoyShapes[Math.floor(Math.random() * decoyShapes.length)];
    tilesMap.set(k, { r: cell.r, c: cell.c, shape: randomShape });
  });

  const initialSteps: Record<string, number> = {};
  const emptyIgnored = new Set<OptionKey>();

  for (let attempt = 0; attempt < 30; attempt++) {
    tilesMap.forEach((_, k) => {
      initialSteps[k] = Math.floor(Math.random() * 4);
    });
    const check = computeCircuitFlow(
      tilesMap,
      initialSteps,
      obstacles,
      emptyIgnored,
    );
    if (check.poweredOptions.length === 0) {
      break;
    }
  }

  const entryKey = coordKey(SOURCE_POS.r, 1);
  const entryTile = tilesMap.get(entryKey);
  if (entryTile) {
    for (let rot = 0; rot < 4; rot++) {
      if (!getOpenPorts(entryTile.shape, rot).includes("W")) {
        initialSteps[entryKey] = rot;
        break;
      }
    }
  }

  return {
    tilesList: Array.from(tilesMap.values()),
    initialSteps,
    obstacles,
  };
}

function renderCyberPipeSvg(shape: PipeShape, isPowered: boolean) {
  const outerCasing = isPowered ? "#0284c7" : "#1e293b";
  const midTrace = isPowered ? "#38bdf8" : "#475569";
  const coreGlow = isPowered ? "#fef08a" : "#94a3b8";
  const pinColor = isPowered ? "#7dd3fc" : "#64748b";

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full pointer-events-none">
      {shape === "STRAIGHT" && (
        <>
          <rect x="0" y="36" width="8" height="28" rx="2" fill={pinColor} />
          <rect x="92" y="36" width="8" height="28" rx="2" fill={pinColor} />
          <line
            x1="0"
            y1="50"
            x2="100"
            y2="50"
            stroke={outerCasing}
            strokeWidth="26"
          />
          <line
            x1="0"
            y1="50"
            x2="100"
            y2="50"
            stroke={midTrace}
            strokeWidth="16"
          />
          <line
            x1="0"
            y1="50"
            x2="100"
            y2="50"
            stroke={coreGlow}
            strokeWidth="5"
          />
          {isPowered && (
            <motion.line
              x1="0"
              y1="50"
              x2="100"
              y2="50"
              stroke="#ffffff"
              strokeWidth="4"
              strokeDasharray="12 16"
              animate={{ strokeDashoffset: [0, -28] }}
              transition={{ repeat: Infinity, duration: 0.55, ease: "linear" }}
            />
          )}
        </>
      )}

      {shape === "ELBOW" && (
        <>
          <rect x="36" y="0" width="28" height="8" rx="2" fill={pinColor} />
          <rect x="92" y="36" width="8" height="28" rx="2" fill={pinColor} />
          <path
            d="M 50 0 L 50 50 L 100 50"
            fill="none"
            stroke={outerCasing}
            strokeWidth="26"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 50 0 L 50 50 L 100 50"
            fill="none"
            stroke={midTrace}
            strokeWidth="16"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 50 0 L 50 50 L 100 50"
            fill="none"
            stroke={coreGlow}
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {isPowered && (
            <motion.path
              d="M 50 0 L 50 50 L 100 50"
              fill="none"
              stroke="#ffffff"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="12 16"
              animate={{ strokeDashoffset: [0, -28] }}
              transition={{ repeat: Infinity, duration: 0.55, ease: "linear" }}
            />
          )}
        </>
      )}

      {shape === "TEE" && (
        <>
          <rect x="0" y="36" width="8" height="28" rx="2" fill={pinColor} />
          <rect x="36" y="0" width="28" height="8" rx="2" fill={pinColor} />
          <rect x="92" y="36" width="8" height="28" rx="2" fill={pinColor} />
          <line
            x1="0"
            y1="50"
            x2="100"
            y2="50"
            stroke={outerCasing}
            strokeWidth="26"
          />
          <line
            x1="50"
            y1="0"
            x2="50"
            y2="50"
            stroke={outerCasing}
            strokeWidth="26"
          />
          <line
            x1="0"
            y1="50"
            x2="100"
            y2="50"
            stroke={midTrace}
            strokeWidth="16"
          />
          <line
            x1="50"
            y1="0"
            x2="50"
            y2="50"
            stroke={midTrace}
            strokeWidth="16"
          />
          <line
            x1="0"
            y1="50"
            x2="100"
            y2="50"
            stroke={coreGlow}
            strokeWidth="5"
          />
          <line
            x1="50"
            y1="0"
            x2="50"
            y2="50"
            stroke={coreGlow}
            strokeWidth="5"
          />
          {isPowered && (
            <>
              <motion.line
                x1="0"
                y1="50"
                x2="100"
                y2="50"
                stroke="#ffffff"
                strokeWidth="4"
                strokeDasharray="12 16"
                animate={{ strokeDashoffset: [0, -28] }}
                transition={{
                  repeat: Infinity,
                  duration: 0.55,
                  ease: "linear",
                }}
              />
              <motion.line
                x1="50"
                y1="0"
                x2="50"
                y2="50"
                stroke="#ffffff"
                strokeWidth="4"
                strokeDasharray="12 16"
                animate={{ strokeDashoffset: [0, -28] }}
                transition={{
                  repeat: Infinity,
                  duration: 0.55,
                  ease: "linear",
                }}
              />
            </>
          )}
        </>
      )}

      <circle
        cx="50"
        cy="50"
        r="12"
        fill={outerCasing}
        stroke={midTrace}
        strokeWidth="2.5"
      />
      <circle cx="50" cy="50" r="5" fill={coreGlow} />
    </svg>
  );
}

export default function TactiCircuitBoard({
  question,
  eliminatedOptions = [],
  disabled = false,
  onAnswer,
}: TactiCircuitBoardProps) {
  const { lang } = useLanguage();

  const validCorrectKeys: OptionKey[] = useMemo(
    () =>
      parseBoardOptionKeys(question.correct_options, question.correct_option),
    [question.correct_options, question.correct_option],
  );

  const isMultiple =
    Boolean(question.allow_multiple) || validCorrectKeys.length > 1;

  const { tilesList, initialSteps, obstacles } = useMemo(
    () => generateCircuitLayout(question.obstacles),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [question.id],
  );

  const tilesMap = useMemo(() => {
    const map = new Map<string, CircuitTile>();
    tilesList.forEach((t) => map.set(coordKey(t.r, t.c), t));
    return map;
  }, [tilesList]);

  const [rotationSteps, setRotationSteps] =
    useState<Record<string, number>>(initialSteps);
  const [rotationsUsed, setRotationsUsed] = useState<number>(0);
  const [selectedOptions, setSelectedOptions] = useState<OptionKey[]>([]);
  const [boardLocked, setBoardLocked] = useState<boolean>(false);
  const [hasWrongResult, setHasWrongResult] = useState<boolean>(false);
  const [surgeNonce, setSurgeNonce] = useState<number>(0);

  useEffect(() => {
    setRotationSteps(initialSteps);
    setRotationsUsed(0);
    setSelectedOptions([]);
    setBoardLocked(false);
    setHasWrongResult(false);
    setSurgeNonce(0);
  }, [question.id, initialSteps]);

  const isInteractionDisabled = disabled || boardLocked;

  const ignoredOptions = useMemo(() => {
    const set = new Set<OptionKey>(eliminatedOptions);
    selectedOptions.forEach((opt) => set.add(opt));
    return set;
  }, [eliminatedOptions, selectedOptions]);

  const { poweredCells, poweredOptions } = useMemo(
    () =>
      computeCircuitFlow(tilesMap, rotationSteps, obstacles, ignoredOptions),
    [tilesMap, rotationSteps, obstacles, ignoredOptions],
  );

  const remainingNeededCount = Math.max(
    1,
    validCorrectKeys.length - selectedOptions.length,
  );

  // Anti-spoiler: tidak mengecek kebenaran sebelum dikirim; hanya membatasi jumlah sesuai kuota sisa
  const canDeliverSurge = useMemo(() => {
    if (isInteractionDisabled || poweredOptions.length === 0) return false;
    return poweredOptions.length <= remainingNeededCount;
  }, [isInteractionDisabled, poweredOptions, remainingNeededCount]);

  const hasTooManyBranches =
    !isInteractionDisabled && poweredOptions.length > remainingNeededCount;

  const handleRotateTile = (key: string, delta: 1 | -1 = 1) => {
    if (isInteractionDisabled) return;
    sound.playMove();
    setRotationsUsed((prev) => prev + 1);
    setRotationSteps((prev) => ({
      ...prev,
      [key]: (prev[key] ?? 0) + delta,
    }));
  };

  const handleResetCircuit = () => {
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

  const handleSubmitPower = useCallback(() => {
    if (!canDeliverSurge || poweredOptions.length === 0) return;

    setSurgeNonce((n) => n + 1);
    const movesScore = Math.max(1, rotationsUsed);

    if (!isMultiple) {
      const targetOpt = poweredOptions[0];
      const isCorrect = validCorrectKeys.includes(targetOpt);
      if (isCorrect) {
        sound.playCorrect();
      } else {
        sound.playWrong();
        setHasWrongResult(true);
      }
      setSelectedOptions([targetOpt]);
      setBoardLocked(true);
      onAnswer(targetOpt, isCorrect, movesScore);
      return;
    }

    // Mode Multiple Answers: simpan pilihan (bertahap maupun serentak) tanpa berhenti lebih awal
    const nextSelected = Array.from(
      new Set([...selectedOptions, ...poweredOptions]),
    );
    setSelectedOptions(nextSelected);

    if (nextSelected.length >= validCorrectKeys.length) {
      finalizeMultipleSelection(nextSelected, movesScore);
    } else {
      sound.playPowerUp();
    }
  }, [
    canDeliverSurge,
    poweredOptions,
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
    if (!canDeliverSurge) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleSubmitPower();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canDeliverSurge, handleSubmitPower]);

  return (
    <div className="flex flex-col gap-3">
      {/* Cyber-PCB HUD Header */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-slate-900 via-[#0B172A] to-slate-900 border border-slate-700/80 text-white shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-xl shrink-0">
            <span>⚡</span>
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-400" />
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-black text-xs sm:text-sm text-white tracking-tight truncate">
                TactiCircuit
              </p>
              <span className="px-1.5 py-0.5 rounded-md bg-sky-500/20 text-sky-300 text-[9px] font-black uppercase tracking-wider">
                Cyber-PCB
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-300 truncate">
              {lang === "EN"
                ? "Rotate circuit tiles to route power from ⚡ to target node"
                : "Putar ubin kabel untuk mengalirkan daya dari ⚡ ke terminal"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {canDeliverSurge ? (
            <span className="px-2.5 py-1 rounded-xl bg-sky-500 text-white text-[11px] font-black shadow-xs animate-pulse">
              ⚡ {poweredOptions.join(" & ")}
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

      {/* Peringatan hanya jika jumlah cabang melebihi sisa kuota pilihan */}
      {hasTooManyBranches && (
        <div className="px-3.5 py-2 rounded-2xl bg-amber-100 border-2 border-amber-300 text-amber-900 text-xs font-black flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            {lang === "EN"
              ? `Power split to ${poweredOptions.join(" & ")}! Rotate a T-junction to select at most ${remainingNeededCount} terminal(s).`
              : `Arus bercabang ke ${poweredOptions.join(" & ")}! Putar pertigaan T agar maksimal ${remainingNeededCount} terminal saja.`}
          </span>
        </div>
      )}

      {/* HUD Khusus Multiple Answers */}
      {isMultiple && (
        <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50/80 border-2 border-amber-300 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              {lang === "EN"
                ? `Select ${validCorrectKeys.length} Terminals (${selectedOptions.length}/${validCorrectKeys.length})`
                : `Pilih ${validCorrectKeys.length} Terminal Jawaban (${selectedOptions.length}/${validCorrectKeys.length})`}
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

      {/* Papan Grid 6x6 Cyber-PCB */}
      <motion.div
        key={`circuit-pulse-${surgeNonce}`}
        animate={
          hasWrongResult
            ? { x: [0, -7, 7, -5, 5, 0] }
            : surgeNonce > 0
              ? { scale: [1, 1.015, 1] }
              : { scale: 1 }
        }
        transition={{ duration: 0.3 }}
        className={`aspect-square w-full max-w-[385px] mx-auto grid grid-cols-6 grid-rows-6 rounded-2xl overflow-hidden border-4 shadow-xl bg-[#070D19] select-none transition-colors ${
          hasWrongResult
            ? "border-rose-500"
            : canDeliverSurge
              ? "border-sky-400/90"
              : "border-slate-900"
        }`}
      >
        {Array.from({ length: BOARD_SIZE }).map((_, r) =>
          Array.from({ length: BOARD_SIZE }).map((__, c) => {
            const key = coordKey(r, c);
            const isDark = (r + c) % 2 === 1;
            const isSource = r === SOURCE_POS.r && c === SOURCE_POS.c;
            const isObstacle = obstacles.has(key);
            const tileHere = tilesMap.get(key);
            const isPowered = poweredCells.has(key);
            const rotStep = rotationSteps[key] ?? 0;

            const terminalOpt = (["A", "B", "C", "D"] as OptionKey[]).find(
              (opt) => {
                const t = TERMINALS[opt];
                return t.r === r && t.c === c;
              },
            );

            const isEliminated = terminalOpt
              ? eliminatedOptions.includes(terminalOpt)
              : false;
            const isAlreadySelected = terminalOpt
              ? selectedOptions.includes(terminalOpt)
              : false;
            const isEnergizedTarget =
              terminalOpt &&
              !isEliminated &&
              !isAlreadySelected &&
              poweredOptions.includes(terminalOpt);

            const baseBg = isPowered
              ? "bg-sky-950/70"
              : isDark
                ? "bg-[#0A1120]"
                : "bg-[#0E172A]";

            return (
              <div
                key={key}
                className={`relative flex items-center justify-center border border-slate-800/75 transition-colors duration-200 ${baseBg} ${
                  isEnergizedTarget
                    ? "ring-2 ring-inset ring-sky-400 bg-sky-900/60"
                    : ""
                }`}
              >
                {!isSource && !tileHere && !terminalOpt && !isObstacle && (
                  <div className="flex flex-col items-center justify-center opacity-25 pointer-events-none">
                    {c === 0 || c === 5 ? (
                      <Cpu className="w-3.5 h-3.5 text-slate-500" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                    )}
                  </div>
                )}

                {isSource && (
                  <div className="w-full h-full flex items-center justify-center relative">
                    <div className="absolute right-0 w-1/2 h-4 bg-sky-500/40" />
                    <div className="absolute right-0 w-1/2 h-2 bg-amber-300" />
                    <div className="z-10 w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 text-slate-950 flex items-center justify-center text-xl font-black shadow-[0_0_18px_rgba(251,191,36,0.75)] border-b-4 border-amber-700">
                      ⚡
                    </div>
                  </div>
                )}

                {isObstacle && (
                  <div className="w-[82%] h-[82%] rounded-xl bg-gradient-to-b from-slate-700 to-slate-800 border border-slate-500/60 shadow-inner flex items-center justify-center pointer-events-none">
                    <span className="text-base sm:text-lg drop-shadow-xs">
                      🧱
                    </span>
                  </div>
                )}

                {tileHere && (
                  <button
                    type="button"
                    disabled={isInteractionDisabled}
                    onClick={() => handleRotateTile(key, 1)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      handleRotateTile(key, -1);
                    }}
                    title={
                      lang === "EN"
                        ? "Left-click rotate +90°, Right-click -90°"
                        : "Klik kiri putar +90°, Klik kanan -90°"
                    }
                    className={`group relative w-full h-full flex items-center justify-center transition ${
                      isInteractionDisabled
                        ? "cursor-default"
                        : "cursor-pointer hover:bg-sky-900/35 active:bg-sky-800/40"
                    }`}
                  >
                    <motion.div
                      animate={{ rotate: rotStep * 90 }}
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 26,
                      }}
                      className="w-full h-full"
                    >
                      {renderCyberPipeSvg(tileHere.shape, isPowered)}
                    </motion.div>
                  </button>
                )}

                {terminalOpt && (
                  <div className="w-full h-full flex items-center justify-center relative">
                    <div
                      className={`absolute left-0 w-1/2 h-4 transition-colors ${
                        isPowered ? "bg-sky-500/40" : "bg-slate-800"
                      }`}
                    />
                    <div
                      className={`absolute left-0 w-1/2 h-1.5 transition-colors ${
                        isPowered ? "bg-amber-300" : "bg-slate-600"
                      }`}
                    />

                    {isAlreadySelected ? (
                      <motion.span
                        initial={{ scale: 0.75, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`z-10 w-8 h-8 sm:w-9 sm:h-9 rounded-xl border-2 font-black text-xs flex items-center justify-center ${
                          !boardLocked
                            ? "bg-indigo-500/30 border-indigo-400 text-indigo-200 shadow-[0_0_14px_rgba(99,102,241,0.5)]"
                            : validCorrectKeys.includes(terminalOpt)
                              ? "bg-emerald-500/30 border-emerald-400 text-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.5)]"
                              : "bg-rose-500/35 border-rose-400 text-rose-200 shadow-[0_0_14px_rgba(244,63,94,0.5)]"
                        }`}
                      >
                        {!boardLocked
                          ? `●${terminalOpt}`
                          : validCorrectKeys.includes(terminalOpt)
                            ? `✓${terminalOpt}`
                            : `✗${terminalOpt}`}
                      </motion.span>
                    ) : isEliminated ? (
                      <span className="z-10 w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-800/90 border border-slate-700 text-slate-600 line-through font-black text-xs flex items-center justify-center">
                        {terminalOpt}
                      </span>
                    ) : (
                      <div className="relative z-10 flex items-center justify-center">
                        {isEnergizedTarget && (
                          <span className="absolute -inset-1.5 rounded-xl border-2 border-amber-300 animate-ping" />
                        )}
                        <span
                          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${OPTION_STYLES[terminalOpt].badgeBg} text-white font-black text-sm sm:text-base flex items-center justify-center shadow-lg border-b-2 border-black/30 transition-transform ${
                            isEnergizedTarget
                              ? "scale-110 ring-2 ring-amber-300 shadow-[0_0_18px_#38bdf8]"
                              : ""
                          }`}
                        >
                          {terminalOpt}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          }),
        )}
      </motion.div>

      {/* Bar Tombol Aksi */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canDeliverSurge}
          onClick={handleSubmitPower}
          className={`flex-1 py-3.5 px-4 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2 border-b-4 transition ${
            canDeliverSurge
              ? "bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 active:translate-y-0.5 text-white border-blue-800 shadow-md cursor-pointer"
              : "bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed"
          }`}
        >
          <Zap className="w-5 h-5 fill-current" />
          <span>
            {canDeliverSurge
              ? lang === "EN"
                ? `Deliver Power to ${poweredOptions.join(" & ")}!`
                : `Alirkan Energi ke ${poweredOptions.join(" & ")}!`
              : hasTooManyBranches
                ? lang === "EN"
                  ? `Isolate at Most ${remainingNeededCount} Terminal(s)`
                  : `Pisahkan Maksimal ${remainingNeededCount} Terminal`
                : lang === "EN"
                  ? "Connect Circuit to a Terminal"
                  : "Sambungkan Sirkuit ke Terminal"}
          </span>
        </button>

        <button
          type="button"
          disabled={isInteractionDisabled || rotationsUsed === 0}
          onClick={handleResetCircuit}
          title={
            lang === "EN" ? "Reset circuit tiles" : "Reset semua ubin kabel"
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
