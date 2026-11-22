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
  RotateCcw,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  Orbit,
  Repeat,
  ShieldCheck,
} from "lucide-react";
import {
  OptionKey,
  OPTION_STYLES,
  QuestionData,
} from "@/components/ChessQuizBoard";
import { useLanguage } from "@/components/LanguageProvider";
import { sound } from "@/lib/sound";

type PortalColor = "CYAN" | "FUCHSIA";

interface Coord {
  r: number;
  c: number;
}

interface PortalPair {
  id: number;
  label: string;
  color: PortalColor;
  ends: [Coord, Coord];
}

interface PortalLinkInfo {
  pairId: number;
  label: string;
  color: PortalColor;
  dest: Coord;
}

interface TactiPortalBoardProps {
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

function buildPortalLookup(pairs: PortalPair[]): Map<string, PortalLinkInfo> {
  const map = new Map<string, PortalLinkInfo>();
  pairs.forEach((pair) => {
    const [pA, pB] = pair.ends;
    map.set(coordKey(pA.r, pA.c), {
      pairId: pair.id,
      label: pair.label,
      color: pair.color,
      dest: pB,
    });
    map.set(coordKey(pB.r, pB.c), {
      pairId: pair.id,
      label: pair.label,
      color: pair.color,
      dest: pA,
    });
  });
  return map;
}

function canReachPortalTarget(
  origin: Coord,
  targetCoord: Coord,
  otherTokenCoords: Set<string>,
  obstacles: Set<string>,
  portalMap: Map<string, PortalLinkInfo>,
): boolean {
  const startKey = coordKey(origin.r, origin.c);
  const targetKey = coordKey(targetCoord.r, targetCoord.c);

  if (obstacles.has(startKey) || obstacles.has(targetKey)) return false;

  const visited = new Set<string>([startKey]);
  const queue: Coord[] = [origin];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const currKey = coordKey(curr.r, curr.c);
    if (currKey === targetKey) return true;

    // 1. Jika berdiri di atas portal, bisa warp ke portal pasangannya
    const standingPortal = portalMap.get(currKey);
    if (standingPortal) {
      const twinKey = coordKey(standingPortal.dest.r, standingPortal.dest.c);
      if (!visited.has(twinKey)) {
        visited.add(twinKey);
        queue.push(standingPortal.dest);
      }
    }

    // 2. Langkah ortogonal 1 petak (jika menginjak portal, langsung berpindah ke portal pasangannya)
    for (const [dr, dc] of ORTHO_DIRS) {
      const nr = curr.r + dr;
      const nc = curr.c + dc;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;

      const nk = coordKey(nr, nc);
      if (obstacles.has(nk) || otherTokenCoords.has(nk)) continue;

      const enteredPortal = portalMap.get(nk);
      const landingCoord = enteredPortal
        ? enteredPortal.dest
        : { r: nr, c: nc };
      const landingKey = coordKey(landingCoord.r, landingCoord.c);

      if (!visited.has(landingKey)) {
        visited.add(landingKey);
        queue.push(landingCoord);
      }
    }
  }

  return false;
}

function isPortalLayoutPlayable(
  tokens: Record<OptionKey, Coord>,
  obstacles: Set<string>,
  pairs: PortalPair[],
): boolean {
  const portalMap = buildPortalLookup(pairs);
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
      !canReachPortalTarget(
        START_POS,
        tokens[targetOpt],
        others,
        obstacles,
        portalMap,
      )
    ) {
      return false;
    }
  }

  // 2. Pastikan antar opsi juga terhubung (untuk soal Multiple Answers)
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
        !canReachPortalTarget(
          tokens[fromOpt],
          tokens[toOpt],
          others,
          obstacles,
          portalMap,
        )
      ) {
        return false;
      }
    }
  }

  return true;
}

function generatePortalLayout(obstacleCount: number): {
  tokens: Record<OptionKey, Coord>;
  obstacles: Set<string>;
  portalPairs: PortalPair[];
} {
  const optionKeys: OptionKey[] = ["A", "B", "C", "D"];
  const clampedObstacles = Math.max(2, Math.min(5, obstacleCount || 3));
  const startKey = coordKey(START_POS.r, START_POS.c);

  for (let attempt = 0; attempt < 150; attempt++) {
    const occupied = new Set<string>([startKey]);
    const allCells: Coord[] = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (coordKey(r, c) === startKey) continue;
        allCells.push({ r, c });
      }
    }

    const shuffled = [...allCells].sort(() => Math.random() - 0.5);

    // 1. Pilih 4 titik untuk 2 pasang portal (jarak Manhattan antar ujung minimal 3 petak)
    const portalCells: Coord[] = [];
    for (const cell of shuffled) {
      if (portalCells.length >= 4) break;
      const tooClose = portalCells.some(
        (p) => Math.abs(p.r - cell.r) + Math.abs(p.c - cell.c) < 3,
      );
      if (tooClose) continue;
      portalCells.push(cell);
      occupied.add(coordKey(cell.r, cell.c));
    }
    if (portalCells.length < 4) continue;

    const portalPairs: PortalPair[] = [
      {
        id: 0,
        label: "α",
        color: "CYAN",
        ends: [portalCells[0], portalCells[1]],
      },
      {
        id: 1,
        label: "β",
        color: "FUCHSIA",
        ends: [portalCells[2], portalCells[3]],
      },
    ];

    // 2. Tempatkan 4 opsi jawaban (hindari petak tepat di sebelah start)
    const tokenCandidates = shuffled.filter((cell) => {
      const k = coordKey(cell.r, cell.c);
      if (occupied.has(k)) return false;
      return (
        Math.abs(cell.r - START_POS.r) + Math.abs(cell.c - START_POS.c) > 1
      );
    });
    if (tokenCandidates.length < 4) continue;

    const tokens = {} as Record<OptionKey, Coord>;
    optionKeys.forEach((opt, idx) => {
      tokens[opt] = tokenCandidates[idx];
      occupied.add(coordKey(tokenCandidates[idx].r, tokenCandidates[idx].c));
    });

    // 3. Tempatkan tembok penghalang yang lolos uji BFS
    const obsCandidates = shuffled.filter((cell) => {
      const k = coordKey(cell.r, cell.c);
      if (occupied.has(k)) return false;
      return (
        Math.abs(cell.r - START_POS.r) + Math.abs(cell.c - START_POS.c) > 1
      );
    });

    const obstacles = new Set<string>();
    for (const cand of obsCandidates) {
      if (obstacles.size >= clampedObstacles) break;
      const k = coordKey(cand.r, cand.c);
      obstacles.add(k);
      if (!isPortalLayoutPlayable(tokens, obstacles, portalPairs)) {
        obstacles.delete(k);
      }
    }

    if (isPortalLayoutPlayable(tokens, obstacles, portalPairs)) {
      return { tokens, obstacles, portalPairs };
    }
  }

  // Fallback terverifikasi 100% playable dengan ruang terpisah dinding
  return {
    tokens: {
      A: { r: 0, c: 0 },
      B: { r: 1, c: 4 },
      C: { r: 5, c: 4 },
      D: { r: 3, c: 1 },
    },
    obstacles: new Set<string>(["2,0", "2,1", "2,2", "3,4"]),
    portalPairs: [
      {
        id: 0,
        label: "α",
        color: "CYAN",
        ends: [
          { r: 4, c: 1 },
          { r: 1, c: 1 },
        ],
      },
      {
        id: 1,
        label: "β",
        color: "FUCHSIA",
        ends: [
          { r: 0, c: 2 },
          { r: 4, c: 5 },
        ],
      },
    ],
  };
}

export default function TactiPortalBoard({
  question,
  eliminatedOptions = [],
  disabled = false,
  onAnswer,
}: TactiPortalBoardProps) {
  const { lang } = useLanguage();

  const validCorrectKeys: OptionKey[] = useMemo(
    () =>
      parseBoardOptionKeys(question.correct_options, question.correct_option),
    [question.correct_options, question.correct_option],
  );

  const isMultiple =
    Boolean(question.allow_multiple) || validCorrectKeys.length > 1;

  const { tokens, obstacles, portalPairs } = useMemo(
    () => generatePortalLayout(question.obstacles),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [question.id],
  );

  const portalMap = useMemo(
    () => buildPortalLookup(portalPairs),
    [portalPairs],
  );

  const [playerPos, setPlayerPos] = useState<Coord>(START_POS);
  const playerPosRef = useRef<Coord>(START_POS);
  const [movesUsed, setMovesUsed] = useState<number>(0);
  const movesUsedRef = useRef<number>(0);
  const [selectedOptions, setSelectedOptions] = useState<OptionKey[]>([]);
  const selectedOptionsRef = useRef<OptionKey[]>([]);
  const [boardLocked, setBoardLocked] = useState<boolean>(false);
  const [hasWrongResult, setHasWrongResult] = useState<boolean>(false);
  const [warpNonce, setWarpNonce] = useState<number>(0);

  useEffect(() => {
    setPlayerPos(START_POS);
    playerPosRef.current = START_POS;
    setMovesUsed(0);
    movesUsedRef.current = 0;
    setSelectedOptions([]);
    selectedOptionsRef.current = [];
    setBoardLocked(false);
    setHasWrongResult(false);
    setWarpNonce(0);
  }, [question.id]);

  const isInteractionDisabled = disabled || boardLocked;

  const standingPortal = useMemo(() => {
    if (isInteractionDisabled) return null;
    return portalMap.get(coordKey(playerPos.r, playerPos.c)) || null;
  }, [playerPos, portalMap, isInteractionDisabled]);

  const validNeighbors = useMemo(() => {
    const set = new Set<string>();
    if (isInteractionDisabled) return set;

    for (const [dr, dc] of ORTHO_DIRS) {
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

  const handleManualWarp = useCallback(() => {
    if (isInteractionDisabled) return;
    const curr = playerPosRef.current;
    const portalHere = portalMap.get(coordKey(curr.r, curr.c));
    if (!portalHere) return;

    sound.playPowerUp();
    const nextMoves = movesUsedRef.current + 1;
    movesUsedRef.current = nextMoves;
    setMovesUsed(nextMoves);

    playerPosRef.current = portalHere.dest;
    setPlayerPos(portalHere.dest);
    setWarpNonce((n) => n + 1);
  }, [isInteractionDisabled, portalMap]);

  const handleStepTo = useCallback(
    (r: number, c: number) => {
      if (isInteractionDisabled) return;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return;

      const currPos = playerPosRef.current;
      const targetKey = coordKey(r, c);

      // Izinkan klik langsung ke portal kembaran saat sedang berdiri di atas portal
      const currPortal = portalMap.get(coordKey(currPos.r, currPos.c));
      if (currPortal && currPortal.dest.r === r && currPortal.dest.c === c) {
        handleManualWarp();
        return;
      }

      const dist = Math.abs(r - currPos.r) + Math.abs(c - currPos.c);
      if (dist !== 1 || obstacles.has(targetKey)) return;

      const nextMoves = movesUsedRef.current + 1;
      movesUsedRef.current = nextMoves;
      setMovesUsed(nextMoves);

      // Cek apakah menginjak ubin portal -> langsung teleportasi ke portal pasangannya
      const enteredPortal = portalMap.get(targetKey);
      if (enteredPortal) {
        sound.playPowerUp();
        playerPosRef.current = enteredPortal.dest;
        setPlayerPos(enteredPortal.dest);
        setWarpNonce((n) => n + 1);
        return;
      }

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

      // Mode Multiple Answers: non-blocking bila pilihan pertama salah
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
      portalMap,
      handleManualWarp,
      obstacles,
      eliminatedOptions,
      tokens,
      isMultiple,
      validCorrectKeys,
      onAnswer,
      finalizeMultipleSelection,
    ],
  );

  // Dukungan kontrol keyboard (WASD / Arrow untuk langkah, Spasi / E untuk Warp ulang)
  useEffect(() => {
    if (isInteractionDisabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === " " || e.key === "e" || e.key === "E") {
        const curr = playerPosRef.current;
        if (portalMap.has(coordKey(curr.r, curr.c))) {
          e.preventDefault();
          handleManualWarp();
        }
        return;
      }

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
  }, [isInteractionDisabled, portalMap, handleManualWarp, handleStepTo]);

  const handleResetPosition = () => {
    if (isInteractionDisabled) return;
    const curr = playerPosRef.current;
    if (curr.r === START_POS.r && curr.c === START_POS.c) return;
    sound.playMove();
    playerPosRef.current = START_POS;
    setPlayerPos(START_POS);
    setWarpNonce((n) => n + 1);
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
      {/* Quantum Wormhole HUD Header */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-slate-900 via-[#191338] to-slate-900 border border-indigo-500/40 text-white shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/45 flex items-center justify-center text-cyan-300 shrink-0">
            <Orbit className="w-5 h-5 animate-spin" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-black text-xs sm:text-sm text-white tracking-tight truncate">
                TactiPortal
              </p>
              <span className="px-1.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-200 text-[9px] font-black uppercase tracking-wider">
                Wormhole
              </span>
            </div>
            <p className="text-[11px] font-medium text-indigo-100/80 truncate">
              {lang === "EN"
                ? "Step onto α or β portals to warp across barriers!"
                : "Injak portal α atau β untuk berteleportasi menembus rintangan!"}
            </p>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-xl bg-white/10 border border-white/15 text-[11px] font-black text-indigo-100 shrink-0">
          {lang === "EN" ? `Moves: ${movesUsed}` : `Langkah: ${movesUsed}`}
        </span>
      </div>

      {/* HUD Khusus Multiple Answers */}
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

      {/* Arena Wormhole 6x6 dengan 60fps Glide + Warp Overlay */}
      <motion.div
        animate={hasWrongResult ? { x: [0, -7, 7, -5, 5, 0] } : { x: 0 }}
        transition={{ duration: 0.35 }}
        className={`relative aspect-square w-full max-w-[385px] mx-auto rounded-2xl overflow-hidden border-4 shadow-xl bg-[#080C1A] select-none transition-colors ${
          hasWrongResult ? "border-rose-500" : "border-slate-900"
        }`}
      >
        {/* Layer 1: SVG Wormhole Links (Garis penghubung pasangan portal α dan β) */}
        <svg
          viewBox="0 0 600 600"
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        >
          {portalPairs.map((pair) => {
            const [e1, e2] = pair.ends;
            const x1 = (e1.c + 0.5) * 100;
            const y1 = (e1.r + 0.5) * 100;
            const x2 = (e2.c + 0.5) * 100;
            const y2 = (e2.r + 0.5) * 100;
            const stroke = pair.color === "CYAN" ? "#22d3ee" : "#e879f9";

            return (
              <motion.line
                key={`wormhole-link-${pair.id}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={stroke}
                strokeWidth="3.5"
                strokeDasharray="8 10"
                strokeLinecap="round"
                animate={{ strokeDashoffset: [0, -36] }}
                transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
                opacity="0.38"
              />
            );
          })}
        </svg>

        {/* Layer 2: Grid Sel 6x6 */}
        <div className="w-full h-full grid grid-cols-6 grid-rows-6">
          {Array.from({ length: BOARD_SIZE }).map((_, r) =>
            Array.from({ length: BOARD_SIZE }).map((__, c) => {
              const key = coordKey(r, c);
              const isDark = (r + c) % 2 === 1;
              const isStartSafe = r === START_POS.r && c === START_POS.c;
              const isObstacle = obstacles.has(key);
              const portalHere = portalMap.get(key);
              const isNeighbor = validNeighbors.has(key);
              const isTwinTarget = Boolean(
                standingPortal &&
                standingPortal.dest.r === r &&
                standingPortal.dest.c === c,
              );
              const canClickCell =
                !isInteractionDisabled && (isNeighbor || isTwinTarget);

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

              let cellBg = isDark ? "bg-[#0C1226]" : "bg-[#111933]";
              if (isStartSafe) {
                cellBg = "bg-slate-800/80 ring-1 ring-inset ring-slate-600/45";
              } else if (portalHere) {
                cellBg =
                  portalHere.color === "CYAN"
                    ? "bg-cyan-950/65 ring-1 ring-inset ring-cyan-400/60"
                    : "bg-fuchsia-950/65 ring-1 ring-inset ring-fuchsia-400/60";
              } else if (isNeighbor && !isInteractionDisabled) {
                cellBg = "bg-emerald-950/65 hover:bg-emerald-900/75";
              }

              return (
                <button
                  key={key}
                  type="button"
                  disabled={!canClickCell}
                  onClick={() => handleStepTo(r, c)}
                  className={`relative flex items-center justify-center border border-slate-800/70 transition-colors duration-150 ${cellBg} ${
                    canClickCell ? "cursor-pointer" : "cursor-default"
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
                    !portalHere &&
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

                  {/* Pusaran Portal Wormhole (α / β) */}
                  {portalHere && (
                    <div className="relative z-10 flex items-center justify-center pointer-events-none">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          repeat: Infinity,
                          duration: 4,
                          ease: "linear",
                        }}
                        className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 border-dashed flex items-center justify-center ${
                          portalHere.color === "CYAN"
                            ? "border-cyan-300 bg-cyan-500/20 shadow-[0_0_16px_rgba(34,211,238,0.5)]"
                            : "border-fuchsia-300 bg-fuchsia-500/20 shadow-[0_0_16px_rgba(232,121,249,0.5)]"
                        } ${isNeighbor || isTwinTarget ? "scale-105" : ""}`}
                      />
                      <span
                        className={`absolute text-xs font-black ${
                          portalHere.color === "CYAN"
                            ? "text-cyan-200"
                            : "text-fuchsia-200"
                        }`}
                      >
                        {portalHere.label}
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

        {/* Layer 3: Karakter Penjelajah Pemain (60fps Glide + Quantum Warp Burst) */}
        <motion.div
          key={`portal-runner-${warpNonce}`}
          initial={warpNonce > 0 ? { scale: 0.35, opacity: 0.6 } : false}
          animate={{
            left: `${(playerPos.c / BOARD_SIZE) * 100}%`,
            top: `${(playerPos.r / BOARD_SIZE) * 100}%`,
            scale: 1,
            opacity: 1,
          }}
          transition={{
            type: "spring",
            stiffness: 420,
            damping: 26,
          }}
          style={{
            width: `${100 / BOARD_SIZE}%`,
            height: `${100 / BOARD_SIZE}%`,
          }}
          className="absolute z-20 p-1 flex items-center justify-center pointer-events-none"
        >
          <div className="w-full h-full rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-fuchsia-600 text-white flex items-center justify-center text-2xl sm:text-3xl shadow-[0_0_18px_rgba(168,85,247,0.65)] border-b-4 border-indigo-950 ring-2 ring-white/80">
            🧑‍🚀
          </div>
        </motion.div>
      </motion.div>

      {/* Tombol Warp Cepat saat Berdiri di Atas Portal */}
      {standingPortal && (
        <button
          type="button"
          onClick={handleManualWarp}
          className={`w-full py-2.5 px-4 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 border-b-4 text-white shadow-sm transition cursor-pointer active:translate-y-0.5 ${
            standingPortal.color === "CYAN"
              ? "bg-cyan-600 hover:bg-cyan-700 border-cyan-900"
              : "bg-fuchsia-600 hover:bg-fuchsia-700 border-fuchsia-900"
          }`}
        >
          <Repeat className="w-4 h-4" />
          <span>
            {lang === "EN"
              ? `Warp via Portal ${standingPortal.label} (Space)`
              : `Teleportasi Ulang Portal ${standingPortal.label} (Spasi)`}
          </span>
        </button>
      )}

      {/* Bar Kontrol D-Pad Taktis & Reset Posisi */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1">
          <button
            type="button"
            disabled={!canStepDir(0, -1)}
            onClick={() => handleStepTo(playerPos.r, playerPos.c - 1)}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-indigo-100 active:scale-95 disabled:opacity-35 text-slate-700 font-black flex items-center justify-center border-b-2 border-slate-300 transition cursor-pointer disabled:cursor-default"
            title="Move Left"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canStepDir(-1, 0)}
            onClick={() => handleStepTo(playerPos.r - 1, playerPos.c)}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-indigo-100 active:scale-95 disabled:opacity-35 text-slate-700 font-black flex items-center justify-center border-b-2 border-slate-300 transition cursor-pointer disabled:cursor-default"
            title="Move Up"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canStepDir(1, 0)}
            onClick={() => handleStepTo(playerPos.r + 1, playerPos.c)}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-indigo-100 active:scale-95 disabled:opacity-35 text-slate-700 font-black flex items-center justify-center border-b-2 border-slate-300 transition cursor-pointer disabled:cursor-default"
            title="Move Down"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canStepDir(0, 1)}
            onClick={() => handleStepTo(playerPos.r, playerPos.c + 1)}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-indigo-100 active:scale-95 disabled:opacity-35 text-slate-700 font-black flex items-center justify-center border-b-2 border-slate-300 transition cursor-pointer disabled:cursor-default"
            title="Move Right"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          disabled={
            isInteractionDisabled ||
            (playerPos.r === START_POS.r && playerPos.c === START_POS.c)
          }
          onClick={handleResetPosition}
          title={
            lang === "EN"
              ? "Return to start position"
              : "Kembalikan karakter ke posisi awal"
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
